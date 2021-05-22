#!/usr/bin/env node
// @ts-check
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import * as leprosorium from './transport/index.js';
import { ask } from './utils/ask.js';


(async () => {
  // check auth
  const owner = await leprosorium.auth();

  // profile loading
  const username = (await ask('Username: ')) ?? owner.login;
  const profile = (await leprosorium.getUserProfile(username));
  if (!profile) {
    throw new Error('USER_NOT_FOUND');
  }

  // data loading
  const series = await getSeries(profile);

  // display chart
  const screen = blessed.screen();
  const line = contrib.line({
    label: `Статистика ${profile.user_info.login} на сайте leprosorium.ru`,
    style: {
      text: 'green',
      baseline: 'black'
    },
    xLabelPadding: 5,
    xPadding: 10,
    showLegend: true,
    legend: { width: 30 },
    wholeNumbersOnly: false
  });
  screen.append(line);
  line.setData(series);
  screen.key(
    ['escape', 'q', 'C-c'],
    () => process.exit(0)
  );
  screen.render();

})();

/**
 *
 *
 * @param { Record<string, any> } profile
 * @returns { Promise<Array<{title: string; x: string[]; y: number[]; style: Record<string, any>}>> }
 */
async function getSeries(profile) {
  const [posts, comments] = await Promise.all([
    leprosorium.getUserPosts(profile.user_info.login),
    leprosorium.getUserComments(profile.user_info.login)
  ]);

  const itemsReducer = (acc, item, idx, arr) => {
    let { created } = item;
    if (!created && idx > 0) {
      let i = 0;
      do {
        i += 1;
        created = arr[idx - i].created;
      } while (!created && (idx - i) >= 0);
    }
    if (created) {
      const year = new Date(1000 * created).getFullYear();
      acc[year] = acc[year] || { items: 0, votes: 0 };
      acc[year].items += 1;
      acc[year].votes += +item.rating;
    }
    return acc;
  };
  const postsStatistics = posts.reduce(itemsReducer, {});
  const commentsStatistics = comments.reduce(itemsReducer, {});

  const years = Array.from(new Set([...Object.keys(postsStatistics), ...Object.keys(commentsStatistics)]))
    .sort((a, b) => +a - +b)
    .reduce((acc, x) => {
      const year = +x;
      if (acc.length === 0) {
        acc.push(year);
      } else {
        do {
          acc.push(acc[acc.length - 1] + 1);
        } while (acc[acc.length - 1] !== year);
      }
      return acc;
    }, []);
  if (years.length > 0) {
    years.unshift(years[0] - 1);
  }

  const seriesReducer = (data, part, acc, key) => {
    acc.x = [...acc.x || [], `${key}`];
    acc.y = [...acc.y || [], data[key]?.[part] || 0];
    return acc;
  };
  const series = [
    {
      title: 'Количество постов',
      ...years.reduce(seriesReducer.bind(null, postsStatistics, 'items'), {}),
      style: { line: 'red' },
    },
    {
      title: 'Количество комментариев',
      ...years.reduce(seriesReducer.bind(null, commentsStatistics, 'items'), {}),
      style: { line: 'blue' },
    },
  ];

  return series;
}
