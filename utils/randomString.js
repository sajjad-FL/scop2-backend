/**
 * Creates a random string and returns it
 * @author Aniket
 * @param {Integer} length Length of the string to be required
 * @return {String}
 */
export const createRandomString = (chars, length) => {
  let stringChars;
  let stringLength;
  let randomString = '';

  if (chars) {
    stringChars = chars;
  } else {
    stringChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
  }

  if (length) {
    stringLength = length;
  } else {
    stringLength = 8;
  }

  // Loop for creating random string
  for (let i = 0; i < stringLength; i += 1) {
    const rnum = Math.floor(Math.random() * stringChars.length);
    randomString += stringChars.substring(rnum, rnum + 1);
  }

  return randomString;
};
