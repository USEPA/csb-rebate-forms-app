const { resolve } = require("node:path");
const express = require("express");
const jwt = require("jsonwebtoken");
const ObjectId = require("mongodb").ObjectId;
// ---
const { createJwt, jwtAlgorithm } = require("./utilities/createJwt");
const log = require("./utilities/logger");
const { getBapComboKeys } = require("./utilities/bap");

const cookieName = "csb-token";

/**
 * Middleware to check for JWT, add user object to request, and create new JWT to keep alive for 15 minutes from request
 * Default to rejectRequest function if jwt is invalid, but allow for a custom override function on reject
 * (required for auto-redirect to SAML)
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function ensureAuthenticated(req, res, next, rejectCallback = rejectRequest) {
  // If no JWT passed in token cookie, send Unauthorized response or redirect
  if (!req.cookies[cookieName]) {
    log({ level: "warn", message: "No jwt cookie present in request", req });
    return rejectCallback(req, res);
  }

  jwt.verify(
    req.cookies[cookieName],
    process.env.JWT_PUBLIC_KEY,
    { algorithms: [jwtAlgorithm] },
    function (err, user) {
      if (err) {
        // Change log levels depending on jwt error received
        if (err instanceof jwt.TokenExpiredError) {
          log({ level: "warn", message: "JWT expired.", req });
        } else if (err instanceof jwt.JsonWebTokenError) {
          log({ level: "error", message: "An invalid JWT was used.", req });
        } else {
          const message =
            typeof err.toString === "function" ? err.toString() : err;
          log({ level: "error", message, req });
        }

        // if err is TokenExpiredError, expired will be true and user will see inactive message instead of error
        return rejectCallback(req, res, err instanceof jwt.TokenExpiredError);
      }

      // Add user to the request object
      req.user = user;

      // Create new token to update expiration to 15 min from now
      const newToken = createJwt(user);

      // Add JWT in cookie and proceed with request
      res.cookie(cookieName, newToken, {
        httpOnly: true,
        overwrite: true,
        sameSite: "lax",
        secure: true,
      });
      next();
    }
  );
}

/**
 * Confirm user has either "csb_admin" or "csb_helpdesk" role.
 * Log message and send 401 Unauthorized if user does not have either role
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function ensureHelpdesk(req, res, next) {
  const userRoles = req.user.memberof ? req.user.memberof.split(",") : [];

  if (!userRoles.includes("csb_admin") && !userRoles.includes("csb_helpdesk")) {
    if (!req.originalUrl.includes("/helpdesk-access")) {
      log({
        level: "error",
        message: `User with email ${req.user.mail} attempted to perform an admin/helpdesk action without correct privileges.`,
        req,
      });
    }

    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

/**
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {boolean} expired
 */
function rejectRequest(req, res, expired) {
  // Clear token cookie if there was an error verifying (e.g. expired)
  res.clearCookie(cookieName);

  if (req.originalUrl.includes("/api")) {
    // Send JSON Unauthorized message if request is for an API endpoint
    return res.status(401).json({ message: "Unauthorized" });
  }
  // For non-API requests (e.g. on logout), redirect to front-end if token is non-existent or invalid
  // If expired, display timeout info message instead of auth error
  return res.redirect(
    `${process.env.CLIENT_URL || process.env.SERVER_URL}/welcome?${
      expired ? "info=timeout" : "error=auth"
    }`
  );
}

/**
 * Auto-redirect to SAML login for any non-logged-in user on any route except base "/" or "/welcome"
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function protectClientRoutes(req, res, next) {
  const subPath = process.env.SERVER_BASE_PATH || "";
  const unprotectedRoutes = ["/", "/welcome", "/manifest.json"].map(
    (route) => `${subPath}${route}`
  );
  if (!unprotectedRoutes.includes(req.path) && !req.path.includes("/static")) {
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
}

/**
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function checkClientRouteExists(req, res, next) {
  const subPath = process.env.SERVER_BASE_PATH || "";
  const clientRoutes = ["/", "/welcome", "/helpdesk", "/rebate/new"].map(
    (route) => `${subPath}${route}`
  );
  if (!clientRoutes.includes(req.path) && !req.path.includes("/rebate/")) {
    return res.status(404).sendFile(resolve(__dirname, "public/404.html"));
  }
  next();
}

/**
 * Global middleware on dev/staging to send 200 status on all server endpoints (required for ZAP scan)
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function appScan(req, res, next) {
  // OpenAPI def must use global "scan" param and enum to "true"
  if (req.query.scan === "true") {
    return res.json({ status: 200 });
  }
  next();
}

/**
 * Fetch user's SAM.gov unique combo keys from the BAP and add "bapComboKeys"
 * to request object if successful.
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function storeBapComboKeys(req, res, next) {
  getBapComboKeys(req, req.user.mail)
    .then((bapComboKeys) => {
      req.bapComboKeys = bapComboKeys;
      next();
    })
    .catch(() => {
      return res.status(401).json({ message: "Error getting SAM.gov data" });
    });
}

/**
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
function verifyMongoObjectId(req, res, next) {
  const id = req.params.id;

  if (id && !ObjectId.isValid(id)) {
    const message = `MongoDB ObjectId validation error for: ${id}`;
    return res.status(400).json({ message });
  }

  next();
}

module.exports = {
  ensureAuthenticated,
  ensureHelpdesk,
  appScan,
  protectClientRoutes,
  checkClientRouteExists,
  storeBapComboKeys,
  verifyMongoObjectId,
};
