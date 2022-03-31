const express = require("express");
const passport = require("passport");
const samlStrategy = require("../config/samlStrategy");
const { ensureAuthenticated } = require("../middleware");
const { createJwt } = require("../utilities/createJwt");
const logger = require("../utilities/logger");
const jsforce = require("jsforce");

const log = logger.logger;

const router = express.Router();

const getSamData = async (email) => {
  const conn = new jsforce.Connection({
    oauth2: {
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: process.env.BAP_URL,
      clientId: process.env.BAP_CLIENT_ID,
      clientSecret: process.env.BAP_CLIENT_SECRET,
      redirectUri: process.env.SERVER_URL,
    },
  });

  return conn
    .login(process.env.BAP_USER, process.env.BAP_PASSWORD)
    .then(() => {
      // After successful login, query for SAM data
      return conn
        .query(
          `
          SELECT UEI__c, ENTITY_EFT_INDICATOR__c, CAGE_CODE__c, Name, Id
          FROM Account
          WHERE RecordType.Name = 'SAM.gov'
            AND Id IN (
              SELECT AccountId
              FROM contact
              WHERE RecordType.Name = 'SAM.gov'
                AND email = '${email}'
            )
          `
        )
        .then((res) => {
          return res.records;
        })
        .catch((err) => {
          console.error(err);
          throw err;
        });
    })
    .catch((err) => {
      console.error(err);
      throw err;
    });
};

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

    getSamData(req.user.mail)
      .then((samUserData) => {
        // Create JWT, set as cookie, then redirect to client
        const token = createJwt({ epaUserData, samUserData });
        res.cookie("token", token, { httpOnly: true });

        // If user has Admin or Helpdesk role, log to INFO
        log.info(
          `User with email ${epaUserData.mail} and member of ${
            epaUserData.memberof || "no"
          } groups logged in.`
        );

        // "RelayState" will be the path that the user initially tried to access before being sent to /login
        res.redirect(
          `${process.env.CLIENT_URL || process.env.SERVER_URL}${
            req.body.RelayState || "/"
          }`
        );
      })
      .catch((err) => {
        console.error(err);
        // TODO: Create front-end page to explain that user does not have access
        res.redirect(`${process.env.CLIENT_URL || ""}/access-error`);
      });
  }
);

router.get("/login/fail", (req, res) => {
  res.status(401).json({ message: "Login failed" });
});

router.get("/logout", ensureAuthenticated, (req, res) => {
  samlStrategy.logout(req, function (err, requestUrl) {
    if (err) {
      console.error(err);
      res.redirect(`${process.env.CLIENT_URL || process.env.SERVER_URL}/`);
    } else {
      // Send request to SAML logout url
      res.redirect(requestUrl);
    }
  });
});

const logoutCallback = (req, res) => {
  // Clear token cookie so client no longer passes JWT after logout
  res.clearCookie("token");
  res.redirect(`${process.env.CLIENT_URL || process.env.SERVER_URL}/`);
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
