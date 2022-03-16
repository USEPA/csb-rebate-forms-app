const express = require("express");
const passport = require("passport");
const samlStrategy = require("../config/samlStrategy");
const { ensureAuthenticated } = require("../middleware");
const { createJwt } = require("../utils");

const router = express.Router();

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
    const token = createJwt(req.user.attributes);
    res.cookie("token", token, { httpOnly: true });
    // "RelayState" will be the path that the user initially tried to access before being sent to /login
    res.redirect(`${process.env.CLIENT_URL || ""}${req.body.RelayState}`);
  }
);

router.get("/login/fail", (req, res) => {
  res.status(401).json({ message: "Login failed" });
});

router.get("/logout", ensureAuthenticated, (req, res) => {
  samlStrategy.logout(req, function (err, requestUrl) {
    if (err) {
      console.error(err);
      res.redirect(process.env.CLIENT_URL || "/");
    } else {
      // Send request to SAML logout url
      res.redirect(requestUrl);
    }
  });
});

router.get("/logout/callback", (req, res) => {
  // Clear token cookie so client no longer passes JWT after logout
  res.clearCookie("token");
  res.redirect(process.env.CLIENT_URL || "/");
});

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
