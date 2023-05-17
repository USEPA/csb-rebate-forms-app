const express = require("express");
const passport = require("passport");
const samlStrategy = require("../config/samlStrategy");
const { ensureAuthenticated } = require("../middleware");
const { createJWT, jwtCookieName } = require("../utilities/createJwt");
const log = require("../utilities/logger");

const { CLIENT_URL, SERVER_URL, SAML_PUBLIC_KEY } = process.env;

const router = express.Router();

/**
 * NOTE: SERVER_URL is needed as fallback when using sub path, e.g. /csb
 */
const baseUrl = CLIENT_URL || SERVER_URL;

router.get(
  "/login",
  passport.authenticate("saml", {
    successRedirect: "/",
    failureRedirect: "/login/fail",
    session: false,
  })
);

router.post(
  "/login/assert",
  passport.authenticate("saml", {
    failureRedirect: "/login/fail",
    session: false,
  }),
  (req, res) => {
    const { body } = req;
    const { attributes } = req.user;
    const userGroups = attributes.memberof || "no";

    /**
     * Create JWT, set as cookie, then redirect to client.
     * NOTE: nameID and nameIDFormat are required to send with logout request.
     */

    const token = createJWT({
      ...req.user,
      ...attributes,
    });

    res.cookie(jwtCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });

    const logMessage = `User with email '${attributes.mail}' and member of ${userGroups} groups logged in.`;
    log({ level: "info", message: logMessage, req });

    /**
     * "RelayState" will be the path that the user initially tried to access
     * before being sent to /login
     */
    res.redirect(`${baseUrl}${body.RelayState || "/"}`);
  }
);

router.get("/login/fail", (req, res) => {
  const logMessage = `SAML Error - Login failed.`;
  log({ level: "error", message: logMessage, req });

  res.redirect(`${baseUrl}/welcome?error=saml`);
});

router.get("/logout", ensureAuthenticated, (req, res) => {
  const { mail, memberof } = req.user;
  const userGroups = memberof || "no";

  samlStrategy.logout(req, function (err, requestUrl) {
    if (err) {
      const logMessage = `SAML Error - Passport logout failed - ${err}`;
      log({ level: "error", message: logMessage, req });

      res.redirect(`${baseUrl}/`);
    } else {
      const logMessage = `User with email '${mail}' and member of ${userGroups} groups logged out.`;
      log({ level: "info", message: logMessage, req });

      /** Send request to SAML logout url. */
      res.redirect(requestUrl);
    }
  });
});

const logoutCallback = (req, res) => {
  /** Clear token cookie so client no longer passes JWT after logout. */
  res.clearCookie(jwtCookieName);

  /**
   * If "RelayState" was passed in original logout request (either querystring
   * or post body), redirect to below.
   */
  const relayState = req.query?.RelayState || req.body?.RelayState;
  res.redirect(`${baseUrl}${relayState || "/welcome?success=logout"}`);
};

/**
 * Local SAML config sends GET for logout callback, while EPA config sends POST.
 */
router.get("/logout/callback", logoutCallback);
router.post("/logout/callback", logoutCallback);

/** Return SAML metadata. */
router.get("/metadata", (req, res) => {
  res.type("application/xml");
  res
    .status(200)
    .send(samlStrategy.generateServiceProviderMetadata(null, SAML_PUBLIC_KEY));
});

module.exports = router;
