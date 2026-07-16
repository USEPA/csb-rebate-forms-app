const jwt = require("jsonwebtoken");

const { NODE_ENV, JWT_PRIVATE_KEY, JWT_EXPIRATION_MINUTES } = process.env;

const jwtAlgorithm = NODE_ENV === "development" ? "HS256" : "RS256";

const jwtCookieName = "csb-token";

const jwtExpirationMinutes = JWT_EXPIRATION_MINUTES
  ? Number(JWT_EXPIRATION_MINUTES)
  : 15;

const jwtExpirationSeconds = jwtExpirationMinutes * 60;

function createJWT(userData) {
  const payload = {
    mail: userData.mail,
    memberof: userData.memberof || "",
    nameID: userData.nameID,
    nameIDFormat: userData.nameIDFormat,
    nameQualifier: userData.nameQualifier,
    spNameQualifier: userData.spNameQualifier,
    sessionIndex: userData.sessionIndex,
  };

  return jwt.sign(payload, JWT_PRIVATE_KEY, {
    algorithm: jwtAlgorithm,
    expiresIn: jwtExpirationSeconds,
  });
}

module.exports = {
  createJWT,
  jwtAlgorithm,
  jwtCookieName,
  jwtExpirationSeconds,
};
