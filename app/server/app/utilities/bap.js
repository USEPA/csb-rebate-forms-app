const jsforce = require("jsforce");
const log = require("../utilities/logger");

// Utilities to fetch data from EPA's Business Automation Platform (BAP)

const setupConnection = (app) => {
  const bapConnection = new jsforce.Connection({
    oauth2: {
      loginUrl: process.env.BAP_URL,
      clientId: process.env.BAP_CLIENT_ID,
      clientSecret: process.env.BAP_CLIENT_SECRET,
      redirectUri: process.env.SERVER_URL,
    },
  });

  return bapConnection
    .loginByOAuth2(process.env.BAP_USER, process.env.BAP_PASSWORD)
    .then(() => {
      log({ level: "info", message: "Initializing BAP Connection." });
      // Store bapConnection in global express object using app.locals
      app.locals.bapConnection = bapConnection;
    })
    .catch((err) => {
      throw err;
    });
};

const queryBap = (email, req) => {
  // query BAP for SAM data
  return req.app.locals.bapConnection
    .query(
      `
        SELECT
            ENTITY_COMBO_KEY__c,
            ENTITY_STATUS__c,
            UNIQUE_ENTITY_ID__c,
            ENTITY_EFT_INDICATOR__c,
            CAGE_CODE__c,
            LEGAL_BUSINESS_NAME__c,
            GOVT_BUS_POC_NAME__c,
            GOVT_BUS_POC_EMAIL__c,
            GOVT_BUS_POC_TITLE__c,
            ALT_GOVT_BUS_POC_NAME__c,
            ALT_GOVT_BUS_POC_EMAIL__c,
            ALT_GOVT_BUS_POC_TITLE__c,
            ELEC_BUS_POC_NAME__c,
            ELEC_BUS_POC_EMAIL__c,
            ELEC_BUS_POC_TITLE__c,
            ALT_ELEC_BUS_POC_NAME__c,
            ALT_ELEC_BUS_POC_EMAIL__c,
            ALT_ELEC_BUS_POC_TITLE__c,
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
      throw err;
    });
};

const getSamData = (email, req) => {
  // Make sure bap connection has been initialized
  if (!req.app.locals.bapConnection) {
    log({
      level: "info",
      message: "BAP Connection has not yet been initialized.",
    });
    return setupConnection(req.app)
      .then(() => queryBap(email, req))
      .catch((err) => {
        log({ level: "error", message: `BAP Error: ${err}`, req });
        throw err;
      });
  }
  return queryBap(email, req).catch((initialError) => {
    if (
      initialError?.toString() === "invalid_grant: expired access/refresh token"
    ) {
      log({ level: "info", message: "BAP access token expired", req });
    } else {
      log({ level: "error", message: `BAP Error: ${initialError}`, req });
    }
    return setupConnection(req.app)
      .then(() => queryBap(email, req))
      .catch((retryError) => {
        log({ level: "error", message: `BAP Error: ${retryError}`, req });
        throw retryError;
      });
  });
};

const getComboKeys = (email, req) => {
  return getSamData(email, req)
    .then((samUserData) => {
      return samUserData.map((samObject) => samObject.ENTITY_COMBO_KEY__c);
    })
    .catch((err) => {
      throw err;
    });
};

module.exports = { getSamData, getComboKeys };
