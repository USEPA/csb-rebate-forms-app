const express = require("express");
const passport = require("passport");
const samlStrategy = require("../config/samlStrategy");
const { ensureAuthenticated } = require("../middleware");
const { createJwt } = require("../utilities/createJwt");
const logger = require("../utilities/logger");
const jsforce = require("jsforce");

const log = logger.logger;

const router = express.Router();

// For redirects below, set const for base url (SERVER_URL is needed as fallback when using sub path, e.g. /csb)
const baseUrl = process.env.CLIENT_URL || process.env.SERVER_URL;

const getSamData = (email) => {
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
            SELECT
                ENTITY_COMBO_KEY__c,
                ENTITY_STATUS__c,
                UNIQUE_ENTITY_ID__c,
                ENTITY_EFT_INDICATOR__c,
                CAGE_CODE__c,
                NAME,
                GOVT_BUS_POC_NAME__c,
                GOVT_BUS_POC_EMAIL__c,
                ALT_GOVT_BUS_POC_NAME__c,
                ALT_GOVT_BUS_POC_EMAIL__c,
                ELEC_BUS_POC_NAME__c,
                ELEC_BUS_POC_EMAIL__c,
                ALT_ELEC_BUS_POC_NAME__c,
                ALT_ELEC_BUS_POC_EMAIL__c,
                PHYSICAL_ADDRESS_LINE_1__c,
                PHYSICAL_ADDRESS_LINE_2__c,
                PHYSICAL_ADDRESS_CITY__c,
                PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
                PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
                PHYSICAL_ADDRESS_ZIP_CODE_4__c
            FROM ${process.env.BAP_TABLE}
            WHERE
                ALT_ELEC_BUS_POC_EMAIL__c = '${email}' or
                GOVT_BUS_POC_EMAIL__c = '${email}' or
                ALT_GOVT_BUS_POC_EMAIL__c = '${email}' or
                ELEC_BUS_POC_EMAIL__c = '${email}'
          `
        )
        .then((res) => {
          return res.records;
        })
        .catch((err) => {
          log.error(err);
          throw err;
        });
    })
    .catch((err) => {
      log.error(err);
      throw err;
    });
};

// TODO: pass RelayState from front-end if necessary?
router.get(
  "/auth/login",
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
        // First check if user has at least one associated UEI before completing login process
        if (samUserData && !samUserData.length) {
          res.redirect(`${baseUrl}/login?error=uei`);
        }

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
        res.redirect(`${baseUrl}${req.body.RelayState || "/"}`);
      })
      .catch((err) => {
        log.error(err);
        res.redirect(`${baseUrl}/login?error=bap`);
      });
  }
);

router.get("/login/fail", (req, res) => {
  res.status(401).json({ message: "Login failed" });
});

router.get("/auth/logout", ensureAuthenticated, (req, res) => {
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
  res.clearCookie("token");
  res.redirect(`${baseUrl}/`);
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
