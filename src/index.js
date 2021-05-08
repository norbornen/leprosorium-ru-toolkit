#!/usr/bin/env node
// @ts-check
import dotenv from 'dotenv';
import PQueue from 'p-queue';
import leprosorium from './leprosorium.js';

dotenv.config();

(async () => {
  // data loading
  console.log('loading posts...');
  const posts = await leprosorium.getUserPosts(process.env['USERNAME']);
  console.log('loading comments...');
  const comments = []; //await leprosorium.getUserLastComments(process.env['USERNAME']);

  // data handling
  const queue = new PQueue({
    concurrency: 1,
    interval: ((60 / 12) * 1000) + Math.trunc(Math.random() * 100), // 12 действий в минуту
    intervalCap: 1
  });
  const voteFn = (fn) => queue.add(fn)
    .then(() => console.log(`item ${fn.item_id} voted`))
    .catch((err) => {
      console.error(`item ${fn.item_id} vote fail: ${err}, ${err.response?.statusCode || '-'}`);
      
      const errors = err.response?.body?.errors || [];
      if (errors.some((x) => x?.description?.code === 'voting_disabled')) {
        return;
      }
      if (errors.length > 0) {
        console.error(JSON.stringify(errors));
      }

      voteFn(fn);
    });

  for (const item of posts) {
    if ((item.user_vote === null || item.user_vote === 0) && item.domain?.is_voting_disabled !== true) {
      const fn = leprosorium.votePost.bind(undefined, item.id, -1);
      fn.item_id = `p-${item.id}`;
      voteFn(fn);
    }
  }
  for (const item of comments) {
    if ((item.user_vote === null || item.user_vote === 0) && item.domain?.is_voting_disabled !== true) {
      const fn = () => leprosorium.voteComment(item.id, -1);
      fn.item_id = `c-${item.id}`;
      voteFn(fn);
    }
  }

})();
