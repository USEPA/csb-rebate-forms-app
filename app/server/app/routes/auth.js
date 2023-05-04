const express = require("express");
const passport = require("passport");
const samlStrategy = require("../config/samlStrategy");
const { ensureAuthenticated } = require("../middleware");
const { createJWT, jwtCookieName } = require("../utilities/createJwt");
const log = require("../utilities/logger");

const router = express.Router();

// For redirects below, set const for base url (SERVER_URL is needed as fallback when using sub path, e.g. /csb)
const baseUrl = process.env.CLIENT_URL || process.env.SERVER_URL;

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
    // Create JWT, set as cookie, then redirect to client
    // Note: nameID and nameIDFormat are required to send with logout request
    const token = createJWT({
      ...req.user,
      ...req.user.attributes,
    });
    res.cookie(jwtCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });

    // If user has Admin or Helpdesk role, log to INFO
    log({
      level: "info",
      message: `User with email ${req.user.attributes.mail} and member of ${
        req.user.attributes.memberof || "no"
      } groups logged in.`,
      req,
    });

    // "RelayState" will be the path that the user initially tried to access before being sent to /login
    res.redirect(`${baseUrl}${req.body.RelayState || "/"}`);
  }
);

router.get("/login/fail", (req, res) => {
  log({
    level: "error",
    message: "SAML Error - Login failed",
    req,
  });
  res.redirect(`${baseUrl}/welcome?error=saml`);
});

router.get("/logout", ensureAuthenticated, (req, res) => {
  samlStrategy.logout(req, function (err, requestUrl) {
    if (err) {
      log({
        level: "error",
        message: `SAML Error - Passport logout failed - ${err}`,
        req,
      });
      res.redirect(`${baseUrl}/`);
    } else {
      // Send request to SAML logout url
      res.redirect(requestUrl);
    }
  });
});

const logoutCallback = (req, res) => {
  // Clear token cookie so client no longer passes JWT after logout
  res.clearCookie(jwtCookieName);

  // If "RelayState" was passed in original logout request (either querystring or post body), redirect to below
  const RelayState = req.query?.RelayState || req.body?.RelayState;
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
