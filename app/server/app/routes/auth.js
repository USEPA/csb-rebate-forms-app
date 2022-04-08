const express = require("express");
const passport = require("passport");
const samlStrategy = require("../config/samlStrategy");
const { ensureAuthenticated } = require("../middleware");
const { createJwt } = require("../utilities/createJwt");
const logger = require("../utilities/logger");

const log = logger.logger;

const router = express.Router();

// For redirects below, set const for base url (SERVER_URL is needed as fallback when using sub path, e.g. /csb)
const baseUrl = process.env.CLIENT_URL || process.env.SERVER_URL;
const cookieName = "csb-token";

// TODO: pass RelayState from front-end if necessary?
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
    const epaUserData = req.user.attributes;

    // Create JWT, set as cookie, then redirect to client
    const token = createJwt(epaUserData);
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    // If user has Admin or Helpdesk role, log to INFO
    log.info(
      `User with email ${epaUserData.mail} and member of ${
        epaUserData.memberof || "no"
      } groups logged in.`
    );

    // "RelayState" will be the path that the user initially tried to access before being sent to /login
    res.redirect(`${baseUrl}${req.body.RelayState || "/"}`);
  }
);

router.get("/login/fail", (req, res) => {
  log.error("SAML login failed");
  res.redirect(`${baseUrl}/welcome?error=saml`);
});

router.get("/logout", ensureAuthenticated, (req, res) => {
  samlStrategy.logout(req, function (err, requestUrl) {
    if (err) {
      log.error(err);
      res.redirect(`${baseUrl}/`);
    } else {
      // Send request to SAML logout url
      res.redirect(requestUrl);
    }
  });
});

const logoutCallback = (req, res) => {
  // Clear token cookie so client no longer passes JWT after logout
  res.clearCookie(cookieName);

  // If "RelayState" was passed in original logout request (either querystring or post body), redirect to below
  const { RelayState } = req.query || req.body;
  res.redirect(`${baseUrl}${RelayState || "/welcome?success=logout"}`);
};

// Local saml config sends GET for logout callback, while EPA config sends POST. Handle both
router.get("/logout/callback", logoutCallback);
router.post("/logout/callback", logoutCallback);

// Return SAML metadata
router.get("/metadata", (req, res) => {
  res.type("application/xml");
  res
    .status(200)
    .send(
      samlStrategy.generateServiceProviderMetadata(
        null,
        process.env.SAML_PUBLIC_KEY
      )
    );
});

module.exports = router;
