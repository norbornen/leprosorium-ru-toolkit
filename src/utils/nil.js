/**
 * @param {any} x
 * @returns {boolean}
 */
function isNil(x) {
  return x === null || x === undefined || (typeof x === 'string' && x === '');
}

/**
 * @param {any} x
 * @returns {boolean}
 */
function isNilOrEmpty(x) {
  let bool = isNil(x);
  if (bool === false) {
    if (Array.isArray(x)) {
      bool = x.length === 0;
    }
    if (typeof x === 'object') {
      bool = Object.keys(x).length === 0;
    }
  }
  return bool;
}

export {
  isNil,
  isNilOrEmpty
};
