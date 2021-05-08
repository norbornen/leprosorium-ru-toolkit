// @ts-check
import path from 'path';
import levelup from 'levelup';
import leveldown from 'leveldown';

const dbname = 'localdb';
const db = levelup(
  leveldown(path.join(process.cwd(), dbname)),
  {
    createIfMissing: true,
    cacheSize: 80 * 1024 * 1024
  }
);

export default class leveldbCollection {
  /**
   * @param {string} collectionPrefix
   * @memberof leveldbCollection
   */
  constructor(collectionPrefix) {
    this.prefix = Buffer.from(`${collectionPrefix}-`);
  }

  /**
   * @param {string | Buffer} key
   * @param {string | Buffer} value
   * @param {import('leveldown').LevelDownPutOptions} [options]
   * @returns {Promise<void>}
   */
  async put(key, value, options) {
    const collectionKey = Buffer.concat([this.prefix, Buffer.from(key)]);
    return db.put(collectionKey, value, options);
  }

  /**
   * @param {string | Buffer} key
   * @param {import('leveldown').LevelDownGetOptions} [options]
   * @returns {Promise<string | Buffer>}
   */
  async get(key, options) {
    const collectionKey = Buffer.concat([this.prefix, Buffer.from(key)]);
    return db.get(collectionKey, options);
  }

  /**
   * @param {string | Buffer} key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    return this.get(key).then(() => true).catch(() => false);
  }

}


/*
(async () => {

  console.log(await db.put('key1', 'value'));
  console.log((await db.get('key1')).toString());
  console.log(await db.put('key2', 'value1'));
  console.log((await db.get('key2')).toString());
  console.log(await db.get('key3'));
  await db.close();
})();
*/

/*
(async () => {
  const db = leveldown('./mydb');
  await new Promise((resolve, reject) => {
    db.open(
      {
        // createIfMissing: true,
        cacheSize: 80 * 1024 * 1024
      },
      (err) => (err ? reject(err) : resolve())
    );
  });
  // await new Promise((resolve, reject) => {
  //   db.put('key1', 'value', (err) => (err ? reject(err) : resolve()));
  // });
  db.get('key1', (err, value) => {
    if (err) {
      return console.log('Ooops!', err); // likely the key was not found
    }
    console.log(`key1=${value}`);
  });
  // await new Promise((resolve, reject) => {
  //   db.put('key2', 'value1', (err) => (err ? reject(err) : resolve()));
  // });
  db.get('key2', (err, value) => {
    if (err) {
      return console.log('Ooops!', err); // likely the key was not found
    }
    console.log(`key2=${value}`);
  });
  await new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
})();
*/

/*
const db = levelup(leveldown('./mydb'));

db.put('name', 'levelup', (err) => {
  if (err) {
    return console.log('Ooops!', err); // some kind of I/O error
  }

  // 3) Fetch by key
  db.get('name', (err, value) => {
    if (err) {
      return console.log('Ooops!', err); // likely the key was not found
    }

    // Ta da!
    console.log(`name=${value}`);
  });
});
*/
