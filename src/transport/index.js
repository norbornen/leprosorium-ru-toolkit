/* eslint-disable no-param-reassign */
// @ts-check
import got from 'got';
import ora from 'ora';
import dotenv from 'dotenv';
import LocalDB from '../store/index.js';
import { ask } from '../utils/ask.js';
import { isNil } from '../utils/nil.js';

dotenv.config();

const ENDPOINT = 'https://leprosorium.ru/api/';

const AGENT = got.extend({
  prefixUrl: ENDPOINT,
  headers: {
    'X-Futuware-SID': process.env['X-Futuware-SID'],
    'X-Futuware-UID': process.env['X-Futuware-UID'],
    'user-agent': 'Mozilla/5.0'
  },
  hooks: {
    beforeRequest: [
      async (options) => {
        const existsHeaders = Object.keys(options.headers || {}).reduce(
          (acc, key) => {
            if (options.headers[key]) {
              acc.push(key.toLowerCase());
            }
            return acc;
          },
          []
        );
        if (!(existsHeaders.includes('x-futuware-sid') && existsHeaders.includes('x-futuware-uid'))) {
          const localdb = new LocalDB('x-futuware');
          /** @type {string} */
          let sid;
          /** @type {string} */
          let uid;

          try {
            sid = (await localdb.get('sid'))?.toString();
            uid = (await localdb.get('uid'))?.toString();
          } catch (err) {
            const [username, password] = await ask('Ваш логин на leprosorium.ru: ')
              .then((res) => {
                if (isNil(res)) {
                  throw new Error('USERNAME_IS_EMPTY');
                }
                return Promise.all([res, ask('Ваш пароль на leprosorium.ru: ')]);
              })
              .then((res) => {
                if (res.some((x) => isNil(x))) {
                  throw new Error('PASSWORD_IS_EMPTY');
                }
                console.log('');
                return res;
              });

            const { body } = await got.post(
              `${ENDPOINT}auth/login/`,
              {
                json: { username, password },
                responseType: 'json'
              }
            );

            localdb.put('sid', sid = body.sid);
            localdb.put('uid', uid = body.uid);
          }

          options.headers['X-Futuware-SID'] = sid;
          options.headers['X-Futuware-UID'] = uid;
        }
      }
    ]
  },
  responseType: 'json',
  timeout: 15 * 1000
});

/**
 * @returns { Promise<{ [key: string]: any; id: number; } | null> }
 */
async function checkAuth() {
  try {
    const { body } = await AGENT.get('my/mini/', { responseType: 'json' });
    return body;
  } catch (error) {
    console.error(error.message);
  }
}

/**
 * @param { string } userName
 * @returns { Promise<{ [key: string]: any; user_info: Record<string, any>; } | null> }
 */
async function getUserProfile(userName) {
  try {
    const { body } = await AGENT.get(`users/${userName}/info/`, { responseType: 'json' });
    return body;
  } catch (error) {
    console.error(error.message);
  }
}

/**
 * @param { string } userName
 * @param { number } [limit]
 * @returns { Promise<Array<Record<string, any>>> }
 */
async function getUserPosts(userName, limit) {
  return getUserRecords(userName, 'posts', limit);
}

/**
 * @param { string } userName
 * @param { number } [limit]
 * @returns { Promise<Array<Record<string, any>>> }
 */
async function getUserComments(userName, limit) {
  return getUserRecords(userName, 'comments', limit);
}

/**
 * @param { number } item_id
 * @param { number } [vote]
 * @returns { Promise<any> }
 */
async function votePost(item_id, vote) {
  return voteRecord('posts', item_id, vote);
}

/**
 * @param { number } item_id
 * @param { number } [vote]
 * @returns { Promise<any> }
 */
async function voteComment(item_id, vote) {
  return voteRecord('comments', item_id, vote);
}

/**
 * @param { string } userName
 * @param { string } endpoint
 * @param { number } [limit]
 * @returns { Promise<Array<Record<string, any>>> }
 */
async function getUserRecords(userName, endpoint, limit) {
  const spinner = ora('page 1').start();
  const iterator = AGENT.paginate(`users/${userName}/${endpoint}/`, {
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

        if (currentItems?.length < previousPerPage) {
          return false;
        }

        spinner.text = `page ${previousPage + 1}`;

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

  spinner.succeed('done');
  return records;
}

/**
 * @param { string } endpoint
 * @param { number } item_id
 * @param { number } [vote=0]
 * @returns { Promise<void> }
 */
async function voteRecord(endpoint, item_id, vote = 0) {
  try {
    await AGENT.post(`${endpoint}/${item_id}/vote/`, { json: { vote } });
  } catch (err) {
    if (err.response?.body?.errors?.some((x) => x?.description?.code === 'voting_disabled')) {
      return;
    }
    throw err;
  }
}

export {
  getUserProfile,
  getUserPosts,
  getUserComments,
  votePost,
  voteComment,
};
export const auth = checkAuth;
