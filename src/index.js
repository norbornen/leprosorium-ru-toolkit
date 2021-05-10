#!/usr/bin/env node
// @ts-check
import dotenv from 'dotenv';
import PQueue from 'p-queue';
import { ask, loopAsk } from './ask.js';
import leprosorium from './leprosorium.js';
import LocalDB from './localdb.js';

dotenv.config();

(async () => {
  // profile loading
  const username = await loopAsk('Username: ');
  const profile = await leprosorium.getUserProfile(username);
  if (!profile) {
    throw new Error('USER_NOT_FOUND');
  }

  const localdb = new LocalDB(profile.user_info.id);

  // data loading
  /** @type {Array<Record<string, any>>} */
  let posts;
  /** @type {Array<Record<string, any>>} */
  let comments;

  const needPostsVoting = await ask(`\nУ пользователя ${profile.user_info.login} ${profile.posts_count} постов, минусовать посты? [Y/n] `);
  if (/^Y/i.test(needPostsVoting ?? '')) {
    const limit = await ask('Cколько постов минуснуть?: ');
    console.log(`загрузка постов пользователя ${profile.user_info.login}...`);
    posts = await leprosorium.getUserPosts(username, limit && /^\d+$/.test(limit) ? +limit : null);
  }
  const needCommentsVoting = await ask(`\nУ пользователя ${profile.user_info.login} ${profile.comments_count} комментариев, минусовать комментарии? [Y/n] `);
  if (/^Y/i.test(needCommentsVoting ?? '')) {
    const limit = await ask('Cколько комментариев минуснуть?: ');
    console.log(`загрузка комментариев пользователя ${profile.user_info.login}...`);
    comments = await leprosorium.getUserComments(username, limit && /^\d+$/.test(limit) ? +limit : null);
  }

  // data handling
  const queue = new PQueue({
    concurrency: 1,
    interval: ((60 / 12) * 1000) + Math.trunc(Math.random() * 100), // 12 действий в минуту
    intervalCap: 1
  });
  const votingQueueFn = (fn) => queue.add(fn)
    .then(() => console.log(`item ${fn.voting_key} voted`))
    .catch((err) => {
      console.error(`item ${fn.voting_key} vote fail: ${err}, ${err.response?.statusCode || '-'}`);

      const errors = err.response?.body?.errors;
      if (errors?.length > 0) {
        console.error(JSON.stringify(errors));
      }

      votingQueueFn(fn);
    });

  for (const item of posts || []) {
    const allowVoting = (item.user_vote === null || item.user_vote === 0) && item.domain?.is_voting_disabled !== true;
    const votingKey = `p-${item.id}`;
    if (allowVoting && !(await localdb.has(votingKey))) {
      const fn = () => leprosorium.votePost(item.id, -1).then(() => localdb.put(votingKey, '1'));
      fn.voting_key = votingKey;
      votingQueueFn(fn);
    }
  }
  for (const item of comments || []) {
    const allowVoting = (item.user_vote === null || item.user_vote === 0) && item.domain?.is_voting_disabled !== true;
    const votingKey = `c-${item.id}`;
    if (allowVoting && !(await localdb.has(votingKey))) {
      const fn = () => leprosorium.voteComment(item.id, -1).then(() => localdb.put(votingKey, '1'));
      fn.voting_key = votingKey;
      votingQueueFn(fn);
    }
  }

})();
