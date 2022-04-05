const jwt = require("jsonwebtoken");
const { createJwt, jwtAlgorithm } = require("./utilities/createJwt");
const logger = require("./utilities/logger");

const log = logger.logger;

const cookieName = "csb-token";

/**
 * Middleware to check for JWT, add user object to request, and create new JWT to keep alive for 15 minutes from request
 * Default to rejectRequest function if jwt is invalid, but allow for a custom override function on reject
 * (required for auto-redirect to SAML)
 */
const ensureAuthenticated = (
  req,
  res,
  next,
  rejectCallback = rejectRequest
) => {
  // If no JWT passed in token cookie, send Unauthorized response or redirect
  if (!req.cookies[cookieName]) {
    log.error("No jwt cookie present in request");
    return rejectCallback(req, res);
  }
  jwt.verify(
    req.cookies[cookieName],
    process.env.JWT_PUBLIC_KEY,
    { algorithms: [jwtAlgorithm] },
    function (err, user) {
      if (err) {
        log.error(err);
        return rejectCallback(req, res);
      }

      // Add user to the request object
      req.user = user;

      // Create new token to update expiration to 15 min from now
      const newToken = createJwt(user);

      // Add JWT in cookie and proceed with request
      res.cookie(cookieName, newToken, { httpOnly: true, overwrite: true });
      next();
    }
  );
};

const rejectRequest = (req, res) => {
  // Clear token cookie if there was an error verifying (e.g. expired)
  res.clearCookie(cookieName);

  if (req.originalUrl.includes("/api")) {
    // Send JSON Unauthorized message if request is for an API endpoint
    return res.status(401).json({ message: "Unauthorized" });
  }
  // For non-API requests (e.g. on logout), redirect to front-end if token is non-existent or invalid
  return res.redirect(
    `${process.env.CLIENT_URL || process.env.SERVER_URL}/welcome?error=auth`
  );
};

// Auto-redirect to SAML login for any non-logged-in user on any route except base "/" or "/welcome"
const protectClientRoutes = (req, res, next) => {
  const subPath = process.env.SERVER_BASE_PATH || "";
  const unprotectedRoutes = ["/", "/welcome"].map(
    (route) => `${subPath}${route}`
  );
  if (!unprotectedRoutes.includes(req.path)) {
    return ensureAuthenticated(req, res, next, (req, res) => {
      // If ensureAuthenticated does not find valid jwt, this redirect will occur so user is auto-redirected to SAML
      return res.redirect(
        `${process.env.SERVER_URL}/login?RelayState=${req.originalUrl.replace(
          subPath,
          ""
        )}`
      );
    });
  }
  next();
};

// Global middleware on dev/staging to send 200 status on all server endpoints (required for ZAP scan)
const appScan = (req, res, next) => {
  // OpenAPI def must use global "scan" param and enum to "true"
  if (req.query.scan === "true") {
    return res.json({ status: 200 });
  }
  next();
};

module.exports = { ensureAuthenticated, appScan, protectClientRoutes };
