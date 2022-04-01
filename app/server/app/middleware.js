const jwt = require("jsonwebtoken");
const { createJwt, jwtAlgorithm } = require("./utilities/createJwt");
const logger = require("./utilities/logger");

const log = logger.logger;

// Middleware to check for JWT, add user object to request, and create new JWT to keep alive for 15 minutes from request
const ensureAuthenticated = (req, res, next) => {
  // If no JWT passed in token cookie, send Unauthorized response or redirect
  if (!req.cookies.token) {
    log.error("No jwt cookie present in request");
    return rejectRequest(req, res);
  }
  jwt.verify(
    req.cookies.token,
    process.env.JWT_PUBLIC_KEY,
    { algorithms: [jwtAlgorithm] },
    function (err, user) {
      if (err) {
        log.error(err);
        return rejectRequest(req, res);
      }

      // Add user to the request object
      req.user = user;

      // Create new token to update expiration to 15 min from now
      const newToken = createJwt(user);

      // Add JWT in cookie and proceed with request
      res.cookie("token", newToken, { httpOnly: true, overwrite: true });
      next();
    }
  );
};

const rejectRequest = (req, res) => {
  // Clear token cookie if there was an error verifying (e.g. expired)
  res.clearCookie("token");

  if (req.originalUrl.includes("/api")) {
    // Send JSON Unauthorized message if request is for an API endpoint
    return res.status(401).json({ message: "Unauthorized" });
  }
  // For non-API requests (e.g. on logout), redirect to front-end if token is non-existent or invalid
  return res.redirect(
    `${process.env.CLIENT_URL || process.env.SERVER_URL}/welcome?error=auth`
  );
};

module.exports = { ensureAuthenticated };
