const jwt = require('jsonwebtoken');

const createJwt = (userObject) => {
  return jwt.sign(userObject, process.env.JWT_PRIVATE_KEY, { expiresIn: process.env.JWT_EXPIRE || '15m' });
};

module.exports = { createJwt };
