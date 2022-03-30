const jwt = require("jsonwebtoken");
const jwtAlgorithm = process.env.NODE_ENV === "development" ? "HS256" : "RS256";

const createJwt = (userObject) => {
  return jwt.sign(userObject, process.env.JWT_PRIVATE_KEY, {
    algorithm: jwtAlgorithm,
    expiresIn: process.env.JWT_EXPIRE || "15m",
  });
};

module.exports = { createJwt, jwtAlgorithm };
