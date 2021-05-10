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
