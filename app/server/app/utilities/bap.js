/**
 * Utilities to fetch data from EPA's Business Automation Platform (BAP)
 */

const jsforce = require("jsforce");
const express = require("express");
const log = require("../utilities/logger");

/**
 * @typedef {Object} BapSamEntity
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
 * @typedef {Object} BapApplicationSubmission
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
    .then((userInfo) => {
      const message = `Initializing BAP Connection: ${userInfo.url}.`;
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
 * @param {express.Request} req
 * @param {string} email
 * @returns {Promise<BapSamEntity[]>} collection of SAM.gov entity data
 */
async function queryForSamEntities(req, email) {
  const message = `Querying BAP for SAM.gov entities for user with email: ${email}.`;
  log({ level: "info", message });

  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;

  /* SOQL: */
  // `SELECT
  //   ENTITY_COMBO_KEY__c,
  //   ENTITY_STATUS__c,
  //   UNIQUE_ENTITY_ID__c,
  //   ENTITY_EFT_INDICATOR__c,
  //   CAGE_CODE__c,
  //   LEGAL_BUSINESS_NAME__c,
  //   GOVT_BUS_POC_NAME__c,
  //   GOVT_BUS_POC_EMAIL__c,
  //   GOVT_BUS_POC_TITLE__c,
  //   ALT_GOVT_BUS_POC_NAME__c,
  //   ALT_GOVT_BUS_POC_EMAIL__c,
  //   ALT_GOVT_BUS_POC_TITLE__c,
  //   ELEC_BUS_POC_NAME__c,
  //   ELEC_BUS_POC_EMAIL__c,
  //   ELEC_BUS_POC_TITLE__c,
  //   ALT_ELEC_BUS_POC_NAME__c,
  //   ALT_ELEC_BUS_POC_EMAIL__c,
  //   ALT_ELEC_BUS_POC_TITLE__c,
  //   PHYSICAL_ADDRESS_LINE_1__c,
  //   PHYSICAL_ADDRESS_LINE_2__c,
  //   PHYSICAL_ADDRESS_CITY__c,
  //   PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
  //   PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
  //   PHYSICAL_ADDRESS_ZIP_CODE_4__c
  // FROM
  //   ${BAP_SAM_TABLE}
  // WHERE
  //   ALT_ELEC_BUS_POC_EMAIL__c = '${email}' OR
  //   GOVT_BUS_POC_EMAIL__c = '${email}' OR
  //   ALT_GOVT_BUS_POC_EMAIL__c = '${email}' OR
  //   ELEC_BUS_POC_EMAIL__c = '${email}'`

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
 * Uses cached JSforce connection to query the BAP for application form submissions.
 * @param {express.Request} req
 * @param {string[]} comboKeys
 * @returns {Promise<BapApplicationSubmission[]>} collection of fields associated with each application form submission
 */
async function queryForApplicationSubmissions(req, comboKeys) {
  const message = `Querying BAP for Application form submissions associated with combokeys: ${comboKeys}.`;
  log({ level: "info", message });

  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;

  /* SOQL: */
  // `SELECT
  //   CSB_Form_ID__c,
  //   CSB_Modified_Full_String__c,
  //   CSB_Review_Item_ID__c,
  //   Parent_Rebate_ID__c,
  //   Parent_CSB_Rebate__r.CSB_Rebate_Status__c
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   ${comboKeys
  //     .map((key) => `UEI_EFTI_Combo_Key__c = '${key}'`)
  //     .join(" OR ")}
  // ORDER BY
  //   CreatedDate DESC`

  return await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      { UEI_EFTI_Combo_Key__c: { $in: comboKeys } },
      {
        // "*": 1,
        CSB_Form_ID__c: 1, // MongoDB ObjectId string
        CSB_Modified_Full_String__c: 1, // ISO 8601 date string
        CSB_Review_Item_ID__c: 1, // CSB Rebate ID w/ form/version ID (9 digits)
        Parent_Rebate_ID__c: 1, // CSB Rebate ID (6 digits)
        "Parent_CSB_Rebate__r.CSB_Rebate_Status__c": 1,
      }
    )
    .sort({ CreatedDate: -1 })
    .execute(async (err, records) => ((await err) ? err : records));
}

/**
 * Verifies the BAP connection has been setup, then calls the provided callback function with the provided arguments.
 * @param {express.Request} req
 * @param {Object} callback callback function name and arguments to call after BAP connection has been verified
 * @param {function} callback.name name of the callback function
 * @param {any[]} callback.args arguments to pass to the callback function
 */
function verifyBapConnection(req, { name, args }) {
  // BAP connection has not yet been initialized, so set set it up and call
  // callback function
  if (!req.app.locals.bapConnection) {
    const message = `BAP Connection has not yet been initialized.`;
    log({ level: "info", message });

    return setupConnection(req.app)
      .then(() => name(...args))
      .catch((err) => {
        const message = `BAP Error: ${err}`;
        log({ level: "error", message, req });
        throw err;
      });
  }

  // BAP connection has already been initialized, so call callback function
  return name(...args).catch((err) => {
    // in case of errors, log appropriate error, attempt to setup connection
    // once more, and then call callback function
    if (err?.toString() === "invalid_grant: expired access/refresh token") {
      const message = `BAP access token expired`;
      log({ level: "info", message, req });
    } else {
      const message = `BAP Error: ${err}`;
      log({ level: "error", message, req });
    }

    return setupConnection(req.app)
      .then(() => name(...args))
      .catch((retryErr) => {
        const message = `BAP Error: ${retryErr}`;
        log({ level: "error", message, req });
        throw retryErr;
      });
  });
}

/**
 * Fetches SAM.gov entities associated with a provided user.
 * @param {express.Request} req
 * @param {string} email
 */
function getSamEntities(req, email) {
  return verifyBapConnection(req, {
    name: queryForSamEntities,
    args: [req, email],
  });
}

/**
 * Fetches SAM.gov entity combo keys data associated with a provided user.
 * @param {express.Request} req
 * @param {string} email
 */
function getBapComboKeys(req, email) {
  return getSamEntities(req, email)
    .then((entities) => entities.map((entity) => entity.ENTITY_COMBO_KEY__c))
    .catch((err) => {
      throw err;
    });
}

/**
 * Fetches application form submissions associated with a provided set of combo keys.
 * @param {express.Request} req
 * @param {string[]} comboKeys
 */
function getApplicationSubmissions(req, comboKeys) {
  return verifyBapConnection(req, {
    name: queryForApplicationSubmissions,
    args: [req, comboKeys],
  });
}

module.exports = {
  getSamEntities,
  getBapComboKeys,
  getApplicationSubmissions,
};
