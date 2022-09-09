/**
 * Utilities to fetch data from EPA's Business Automation Platform (BAP)
 */

const jsforce = require("jsforce");
const express = require("express");
const log = require("../utilities/logger");

/**
 * @typedef {Object} SamEntity
 * @property {string} ENTITY_COMBO_KEY__c
 * @property {string} ENTITY_STATUS__c
 * @property {string} UNIQUE_ENTITY_ID__c
 * @property {?string} ENTITY_EFT_INDICATOR__c
 * @property {string} LEGAL_BUSINESS_NAME__c
 * @property {?string} GOVT_BUS_POC_NAME__c
 * @property {?string} GOVT_BUS_POC_EMAIL__c
 * @property {?string} GOVT_BUS_POC_TITLE__c
 * @property {?string} ALT_GOVT_BUS_POC_NAME__c
 * @property {?string} ALT_GOVT_BUS_POC_EMAIL__c
 * @property {?string} ALT_GOVT_BUS_POC_TITLE__c
 * @property {?string} ELEC_BUS_POC_NAME__c
 * @property {?string} ELEC_BUS_POC_EMAIL__c
 * @property {?string} ELEC_BUS_POC_TITLE__c
 * @property {?string} ALT_ELEC_BUS_POC_NAME__c
 * @property {?string} ALT_ELEC_BUS_POC_EMAIL__c
 * @property {?string} ALT_ELEC_BUS_POC_TITLE__c
 * @property {string} PHYSICAL_ADDRESS_LINE_1__c
 * @property {?string} PHYSICAL_ADDRESS_LINE_2__c
 * @property {string} PHYSICAL_ADDRESS_CITY__c
 * @property {string} PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c
 * @property {string} PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c
 * @property {string} PHYSICAL_ADDRESS_ZIP_CODE_4__c
 * @property {Object} attributes
 * @property {string} attributes.type
 * @property {string} attributes.url
 */

/**
 * @typedef {Object} ApplicationFormSubmission
 * @property {string} CSB_Form_ID__c
 * @property {string} CSB_Modified_Full_String__c
 * @property {string} UEI_EFTI_Combo_Key__c
 * @property {string} Parent_Rebate_ID__c
 * @property {Object} Parent_CSB_Rebate__r
 * @property {string} Parent_CSB_Rebate__r.CSB_Rebate_Status__c
 * @property {Object} attributes
 * @property {string} attributes.type
 * @property {string} attributes.url
 */

const {
  SERVER_URL,
  BAP_CLIENT_ID,
  BAP_CLIENT_SECRET,
  BAP_URL,
  BAP_USER,
  BAP_PASSWORD,
  BAP_SAM_TABLE,
  BAP_FORMS_TABLE,
} = process.env;

/**
 * Sets up the BAP connection and stores it in the Express app's locals object.
 * @param {express.Application} app
 */
function setupConnection(app) {
  const bapConnection = new jsforce.Connection({
    oauth2: {
      clientId: BAP_CLIENT_ID,
      clientSecret: BAP_CLIENT_SECRET,
      loginUrl: BAP_URL,
      redirectUri: SERVER_URL,
    },
  });

  return bapConnection
    .loginByOAuth2(BAP_USER, BAP_PASSWORD)
    .then(() => {
      const message = `Initializing BAP Connection.`;
      log({ level: "info", message });
      // Store bapConnection in global express object using app.locals
      app.locals.bapConnection = bapConnection;
    })
    .catch((err) => {
      throw err;
    });
}

/**
 * Uses cached JSforce connection to query the BAP for SAM.gov entities.
 * @param {string} email
 * @param {express.Request} req
 * @returns {Promise<SamEntity[]>} collection of SAM.gov entities
 */
async function queryForSamEntities(email, req) {
  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;
  return await bapConnection
    .sobject(BAP_SAM_TABLE)
    .find(
      {
        $or: [
          { ALT_ELEC_BUS_POC_EMAIL__c: email },
          { GOVT_BUS_POC_EMAIL__c: email },
          { ALT_GOVT_BUS_POC_EMAIL__c: email },
          { ELEC_BUS_POC_EMAIL__c: email },
        ],
      },
      {
        // "*": 1,
        ENTITY_COMBO_KEY__c: 1,
        ENTITY_STATUS__c: 1,
        UNIQUE_ENTITY_ID__c: 1,
        ENTITY_EFT_INDICATOR__c: 1,
        LEGAL_BUSINESS_NAME__c: 1,
        GOVT_BUS_POC_NAME__c: 1,
        GOVT_BUS_POC_EMAIL__c: 1,
        GOVT_BUS_POC_TITLE__c: 1,
        ALT_GOVT_BUS_POC_NAME__c: 1,
        ALT_GOVT_BUS_POC_EMAIL__c: 1,
        ALT_GOVT_BUS_POC_TITLE__c: 1,
        ELEC_BUS_POC_NAME__c: 1,
        ELEC_BUS_POC_EMAIL__c: 1,
        ELEC_BUS_POC_TITLE__c: 1,
        ALT_ELEC_BUS_POC_NAME__c: 1,
        ALT_ELEC_BUS_POC_EMAIL__c: 1,
        ALT_ELEC_BUS_POC_TITLE__c: 1,
        PHYSICAL_ADDRESS_LINE_1__c: 1,
        PHYSICAL_ADDRESS_LINE_2__c: 1,
        PHYSICAL_ADDRESS_CITY__c: 1,
        PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c: 1,
        PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c: 1,
        PHYSICAL_ADDRESS_ZIP_CODE_4__c: 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));
}

/**
 * Fetches SAM.gov data associated with a provided user.
 * @param {string} email
 * @param {express.Request} req
 */
function getSamData(email, req) {
  // Make sure BAP connection has been initialized
  if (!req.app.locals.bapConnection) {
    const message = `BAP Connection has not yet been initialized.`;
    log({ level: "info", message });

    return setupConnection(req.app)
      .then(() => queryForSamEntities(email, req))
      .catch((err) => {
        const message = `BAP Error: ${err}`;
        log({ level: "error", message, req });
        throw err;
      });
  }

  return queryForSamEntities(email, req).catch((err) => {
    if (err?.toString() === "invalid_grant: expired access/refresh token") {
      const message = `BAP access token expired`;
      log({ level: "info", message, req });
    } else {
      const message = `BAP Error: ${err}`;
      log({ level: "error", message, req });
    }

    return setupConnection(req.app)
      .then(() => queryForSamEntities(email, req))
      .catch((retryErr) => {
        const message = `BAP Error: ${retryErr}`;
        log({ level: "error", message, req });
        throw retryErr;
      });
  });
}

/**
 * Fetches SAM.gov entity combo keys data associated with a provided user.
 * @param {string} email
 * @param {express.Request} req
 */
function getComboKeys(email, req) {
  return getSamData(email, req)
    .then((samEntities) => {
      return samEntities.map((samEntity) => samEntity.ENTITY_COMBO_KEY__c);
    })
    .catch((err) => {
      throw err;
    });
}

/**
 * Uses cached JSforce connection to query the BAP for application form submissions.
 * @param {string[]} comboKeys
 * @param {express.Request} req
 * @returns {Promise<ApplicationFormSubmission[]>} collection of application form submissions
 */
async function queryForApplicationFormSubmissions(comboKeys, req) {
  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;
  return await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      { UEI_EFTI_Combo_Key__c: { $in: comboKeys } },
      {
        // "*": 1,
        CSB_Form_ID__c: 1,
        CSB_Modified_Full_String__c: 1,
        UEI_EFTI_Combo_Key__c: 1,
        Parent_Rebate_ID__c: 1,
        "Parent_CSB_Rebate__r.CSB_Rebate_Status__c": 1,
      }
    )
    .sort({ CreatedDate: -1 })
    .execute(async (err, records) => ((await err) ? err : records));
}

/**
 * Fetches application form submissions associated with a provided set of combo keys.
 * @param {string[]} comboKeys
 * @param {express.Request} req
 */
function getApplicationSubmissionsData(comboKeys, req) {
  // Make sure BAP connection has been initialized
  if (!req.app.locals.bapConnection) {
    const message = `BAP Connection has not yet been initialized.`;
    log({ level: "info", message });

    return setupConnection(req.app)
      .then(() => queryForApplicationFormSubmissions(comboKeys, req))
      .catch((err) => {
        const message = `BAP Error: ${err}`;
        log({ level: "error", message, req });
        throw err;
      });
  }

  return queryForApplicationFormSubmissions(comboKeys, req).catch((err) => {
    if (err?.toString() === "invalid_grant: expired access/refresh token") {
      const message = `BAP access token expired`;
      log({ level: "info", message, req });
    } else {
      const message = `BAP Error: ${err}`;
      log({ level: "error", message, req });
    }

    return setupConnection(req.app)
      .then(() => queryForApplicationFormSubmissions(comboKeys, req))
      .catch((retryErr) => {
        const message = `BAP Error: ${retryErr}`;
        log({ level: "error", message, req });
        throw retryErr;
      });
  });
}

module.exports = { getSamData, getComboKeys, getApplicationSubmissionsData };
