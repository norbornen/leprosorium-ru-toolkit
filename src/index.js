#!/usr/bin/env node
// @ts-check
import { setTimeout } from 'timers/promises';
import dotenv from 'dotenv';
import PQueue from 'p-queue';
import got from 'got';

dotenv.config();

(async () => {
  const agent = got.extend({
    prefixUrl: 'https://leprosorium.ru/api/',
    headers: {
      'X-Futuware-SID': process.env['X-Futuware-SID'],
      'X-Futuware-UID': process.env['X-Futuware-UID'],
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36'
    },
    responseType: 'json',
    timeout: 15 * 1000
  });

  // data loading
  console.log('loading posts...');
  const posts = await getUserPosts(agent, process.env['USERNAME']);
  console.log('loading comments...');
  const comments = await getUserLastComments(agent, process.env['USERNAME']);

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
      const fn = votePost.bind(undefined, agent, item.id, -1);
      fn.item_id = `p-${item.id}`;
      voteFn(fn);
    }
  }
  for (const item of comments) {
    if ((item.user_vote === null || item.user_vote === 0) && item.domain?.is_voting_disabled !== true) {
      const fn = () => voteComment(agent, item.id, -1);
      fn.item_id = `c-${item.id}`;
      voteFn(fn);
    }
  }

})();

/**
 * @param { got } agent
 * @param { string } userName
 * @returns { Promise<Array<Record<string, any>>> }
 */
 async function getUserPosts(agent, userName) {
  return getUserRecords(agent, userName, 'posts');
}

/**
 * @param { got } agent
 * @param { string } userName
 * @returns { Promise<Array<Record<string, any>>> }
 */
async function getUserLastComments(agent, userName) {
  return getUserRecords(agent, userName, 'comments', 2500);
}

/**
 * @param { got } agent
 * @param { string } userName
 * @param { string } endpoint
 * @param { number } [limit]
 * @returns { Promise<Array<Record<string, any>>> }
 */
async function getUserRecords(agent, userName, endpoint, limit) {
  const iterator = agent.paginate(`users/${userName}/${endpoint}/`, {
    searchParams: {
      page: 1,
      per_page: 25
    },
    pagination: {
      transform: (response) => (response?.body?.[endpoint] || []),
      paginate: (response, allItems, currentItems) => {
        const previousSearchParams = response.request.options.searchParams;
        const previousPerPage = +previousSearchParams.get('per_page');
        const previousPage = +previousSearchParams.get('page');

        if (!currentItems || currentItems.length < previousPerPage) {
          return false;
        }

        console.log(`page ${previousPage + 1}`);
        return {
          searchParams: { per_page: previousPerPage, page: previousPage + 1 }
        };
      }
    }
  });

  const records = [];
  for await (const item of iterator) {
    if (item) {
      records.push(item);
    }
    if (limit && limit <= records.length) {
      break;
    }
  }

  return records;
}

/**
 * @param { got } agent
 * @param { number } item_id
 * @param { number } [vote]
 * @returns { Promise<any> }
 */
async function votePost(agent, item_id, vote) {
  return voteRecord(agent, 'posts', item_id, vote);
}

/**
 * @param { got } agent
 * @param { number } item_id
 * @param { number } [vote]
 * @returns { Promise<any> }
 */
 async function voteComment(agent, item_id, vote) {
  return voteRecord(agent, 'comments', item_id, vote);
}

/**
 * @param { got } agent
 * @param { string } endpoint
 * @param { number } item_id
 * @param { number } [vote=0]
 * @returns { Promise<any> }
 */
 async function voteRecord(agent, endpoint, item_id, vote = 0) {
  return agent.post(`${endpoint}/${item_id}/vote/`, { json: { vote } });
}
