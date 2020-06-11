#!/usr/bin/env node
// @ts-check
require('dotenv').config();

const { default: got } = require('got');
const { default: PQueue } = require('p-queue');


(async () => {
    const agent = got.extend({
        prefixUrl: 'https://leprosorium.ru/api/',
        headers: {
            'X-Futuware-SID': process.env['X-Futuware-SID'],
            'X-Futuware-UID': process.env['X-Futuware-UID'],
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36'
        },
        responseType: 'json'
    });

    const posts = await getUserPosts(agent, process.env['USERNAME']);

    console.log(`\nsleep...\n`);
    await new Promise((resolve) => setTimeout(resolve, 60000));
    

    const queue = new PQueue({
        concurrency: 1,
        interval: 3900,
        intervalCap: 1
    });
    const voteFn = (post_id) => queue.add(() => postVote(agent, post_id, -1))
        .then(() => console.log(`post ${post_id} vote`))
        .catch((err) => {
            console.error(`post ${post_id} fail`, err);
            voteFn(post_id);
        });
    for (const post of posts) {
        if (post.user_vote === null) {
            voteFn(post.id);
        }
    }

})();

/**
 * @param { got } agent
 * @param { string } userName
 * @returns { Promise<{[key: string]: any}[]> }
 */
async function getUserPosts(agent, userName) {

    const iterator = agent.paginate(`users/${userName}/posts/`, {
        searchParams: { page: 1, per_page: 25 },
        pagination: {
            transform: (response) => {
                // @ts-ignore
                return ((response.body || {}).posts || []);
            },
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

    const posts = [];
    for await (const post of iterator) {
        if (post) {
            posts.push(post);
        }
    }
    
    return posts;
}

/**
 * @param { got } agent
 * @param { number } post_id
 * @param { number } [vote=0]
 * @returns { Promise<any> }
 */
async function postVote(agent, post_id, vote = 0) {
    return agent.post(`posts/${post_id}/vote/`, { json: { vote } });
}
