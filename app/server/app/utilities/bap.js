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
 * @typedef {Object} BapFormSubmission
 * @property {string} UEI_EFTI_Combo_Key__c
 * @property {string} CSB_Form_ID__c
 * @property {string} CSB_Modified_Full_String__c
 * @property {string} CSB_Review_Item_ID__c
 * @property {string} Parent_Rebate_ID__c
 * @property {string} Record_Type_Name__c
 * @property {Object} Parent_CSB_Rebate__r
 * @property {string} Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c
 * @property {string} Parent_CSB_Rebate__r.CSB_Payment_Request_Status__c
 * @property {string} Parent_CSB_Rebate__r.CSB_Closeout_Request_Status__c
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
  BAP_BUS_TABLE,
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
      const message = `Initializing BAP connection: ${userInfo.url}.`;
      log({ level: "info", message });
      // Store bapConnection in global express object using app.locals
      app.locals.bapConnection = bapConnection;
    })
    .catch((err) => {
      const message = `Error initializing BAP connection.`;
      log({ level: "info", message });
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
 * Uses cached JSforce connection to query the BAP for form submissions statuses and related metadata.
 * @param {express.Request} req
 * @param {string[]} comboKeys
 * @returns {Promise<BapFormSubmission[]>} collection of fields associated with each form submission
 */
async function queryForBapFormSubmissionsStatuses(req, comboKeys) {
  const message = `Querying BAP for form submissions statuses associated with combokeys: ${comboKeys}.`;
  log({ level: "info", message });

  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;

  // `SELECT
  //   Parent_Rebate_ID__c,
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   (${comboKeys
  //     .map((key) => `UEI_EFTI_Combo_Key__c = '${key}'`)
  //     .join(" OR ")}) AND
  //   Latest_Version__c = TRUE`

  const parentRebateIdsQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        UEI_EFTI_Combo_Key__c: { $in: comboKeys },
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        Parent_Rebate_ID__c: 1, // CSB Rebate ID (6 digits)
      }
    )
    .sort({ CreatedDate: -1 })
    .execute(async (err, records) => ((await err) ? err : records));

  const parentRebateIds = parentRebateIdsQuery.map((item) => {
    return item.Parent_Rebate_ID__c;
  });

  if (parentRebateIds.length === 0) return [];

  // `SELECT
  //   UEI_EFTI_Combo_Key__c,
  //   CSB_Form_ID__c,
  //   CSB_Modified_Full_String__c,
  //   CSB_Review_Item_ID__c,
  //   Parent_Rebate_ID__c,
  //   Record_Type_Name__c,
  //   Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c,
  //   Parent_CSB_Rebate__r.CSB_Payment_Request_Status__c,
  //   Parent_CSB_Rebate__r.CSB_Closeout_Request_Status__c
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   (${parentRebateIds
  //     .map((id) => `Parent_CSB_Rebate__r.CSB_Rebate_ID__c = '${id}'`)
  //     .join(" OR ")}) AND
  //   Latest_Version__c = TRUE
  // ORDER BY
  //   CreatedDate DESC`

  const submissions = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        "Parent_CSB_Rebate__r.CSB_Rebate_ID__c": { $in: parentRebateIds },
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        UEI_EFTI_Combo_Key__c: 1,
        CSB_Form_ID__c: 1, // MongoDB ObjectId string
        CSB_Modified_Full_String__c: 1, // ISO 8601 date string
        CSB_Review_Item_ID__c: 1, // CSB Rebate ID with form/version ID (9 digits)
        Parent_Rebate_ID__c: 1, // CSB Rebate ID (6 digits)
        Record_Type_Name__c: 1, // 'CSB Funding Request' | 'CSB Payment Request' | 'CSB Closeout Request'
        "Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c": 1,
        "Parent_CSB_Rebate__r.CSB_Payment_Request_Status__c": 1,
        "Parent_CSB_Rebate__r.CSB_Closeout_Request_Status__c": 1,
      }
    )
    .sort({ CreatedDate: -1 })
    .execute(async (err, records) => ((await err) ? err : records));

  return submissions;
}

/**
 * Uses cached JSforce connection to query the BAP for a single Application form submission.
 * @param {express.Request} req
 * @param {string} reviewItemId CSB Rebate ID with the form/version ID (9 digits)
 * @returns {Promise<Object>} Application form submission fields
 */
async function queryForBapApplicationSubmission(req, reviewItemId) {
  const message = `Querying BAP for Application form submission associated with CSB Review Item ID: ${reviewItemId}.`;
  log({ level: "info", message });

  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Funding_Request' AND
  //   sobjecttype = '${BAP_FORMS_TABLE}'
  // LIMIT 1`

  const applicationTableIdQuery = await bapConnection
    .sobject("recordtype")
    .find(
      {
        developername: "CSB_Funding_Request",
        sobjecttype: BAP_FORMS_TABLE,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
      }
    )
    .limit(1)
    .execute(async (err, records) => ((await err) ? err : records));

  const applicationTableId = applicationTableIdQuery["0"].Id;

  // `SELECT
  //   Id,
  //   UEI_EFTI_Combo_Key__c,
  //   CSB_NCES_ID__c,
  //   Primary_Applicant__r.Name,
  //   Primary_Applicant__r.Title,
  //   Primary_Applicant__r.Phone,
  //   Primary_Applicant__r.Email,
  //   Alternate_Applicant__r.Name,
  //   Alternate_Applicant__r.Title,
  //   Alternate_Applicant__r.Phone,
  //   Alternate_Applicant__r.Email,
  //   Applicant_Organization__r.Name,
  //   CSB_School_District__r.Name,
  //   Fleet_Name__c,
  //   School_District_Prioritized__c,
  //   Total_Rebate_Funds_Requested__c,
  //   Total_Infrastructure_Funds__c
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   recordtypeid = '${applicationTableId}' AND
  //   CSB_Review_Item_ID__c = '${reviewItemId}' AND
  //   Latest_Version__c = TRUE`

  const applicationTableRecordQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        recordtypeid: applicationTableId,
        CSB_Review_Item_ID__c: reviewItemId,
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
        UEI_EFTI_Combo_Key__c: 1,
        CSB_NCES_ID__c: 1,
        "Primary_Applicant__r.Name": 1,
        "Primary_Applicant__r.Title": 1,
        "Primary_Applicant__r.Phone": 1,
        "Primary_Applicant__r.Email": 1,
        "Alternate_Applicant__r.Name": 1,
        "Alternate_Applicant__r.Title": 1,
        "Alternate_Applicant__r.Phone": 1,
        "Alternate_Applicant__r.Email": 1,
        "Applicant_Organization__r.Name": 1,
        "CSB_School_District__r.Name": 1,
        Fleet_Name__c: 1,
        School_District_Prioritized__c: 1,
        Total_Rebate_Funds_Requested__c: 1,
        Total_Infrastructure_Funds__c: 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));

  const applicationTableRecordId = applicationTableRecordQuery["0"].Id;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Rebate_Item' AND
  //   sobjecttype = '${BAP_BUS_TABLE}'
  // LIMIT 1`

  const busTableIdQuery = await bapConnection
    .sobject("recordtype")
    .find(
      {
        developername: "CSB_Rebate_Item",
        sobjecttype: BAP_BUS_TABLE,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
      }
    )
    .limit(1)
    .execute(async (err, records) => ((await err) ? err : records));

  const busTableId = busTableIdQuery["0"].Id;

  // `SELECT
  //   Rebate_Item_num__c,
  //   CSB_VIN__c,
  //   CSB_Model_Year__c,
  //   CSB_Fuel_Type__c,
  //   CSB_Replacement_Fuel_Type__c,
  //   CSB_Funds_Requested__c
  // FROM
  //   ${BAP_BUS_TABLE}
  // WHERE
  //   recordtypeid = '${busTableId}' AND
  //   Related_Order_Request__c = '${applicationTableRecordId}' AND
  //   CSB_Rebate_Item_Type__c = 'Old Bus'`

  const busTableRecordsQuery = await bapConnection
    .sobject(BAP_BUS_TABLE)
    .find(
      {
        recordtypeid: busTableId,
        Related_Order_Request__c: applicationTableRecordId,
        CSB_Rebate_Item_Type__c: "Old Bus",
      },
      {
        // "*": 1,
        Rebate_Item_num__c: 1,
        CSB_VIN__c: 1,
        CSB_Model_Year__c: 1,
        CSB_Fuel_Type__c: 1,
        CSB_Replacement_Fuel_Type__c: 1,
        CSB_Funds_Requested__c: 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));

  return { applicationTableRecordQuery, busTableRecordsQuery };
}

/**
 * Uses cached JSforce connection to query the BAP for a single Payment Request form submission.
 * @param {express.Request} req
 * @param {string} reviewItemId CSB Rebate ID with the form/version ID (9 digits)
 * @returns {Promise<Object>} Payment Request form submission fields
 */
async function queryForBapPaymentRequestSubmission(req, reviewItemId) {
  const message = `Querying BAP for Payment Request form submission associated with CSB Review Item ID: ${reviewItemId}.`;
  log({ level: "info", message });

  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Payment_Request' AND
  //   sobjecttype = '${BAP_FORMS_TABLE}'
  // LIMIT 1`

  const paymentRequestTableIdQuery = await bapConnection
    .sobject("recordtype")
    .find(
      {
        developername: "CSB_Payment_Request",
        sobjecttype: BAP_FORMS_TABLE,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
      }
    )
    .limit(1)
    .execute(async (err, records) => ((await err) ? err : records));

  const paymentRequestTableId = paymentRequestTableIdQuery["0"].Id;

  // `SELECT
  //   Id,
  //   UEI_EFTI_Combo_Key__c,
  //   CSB_NCES_ID__c,
  //   Primary_Applicant__r.Name,
  //   Primary_Applicant__r.Title,
  //   Primary_Applicant__r.Phone,
  //   Primary_Applicant__r.Email,
  //   Alternate_Applicant__r.Name,
  //   Alternate_Applicant__r.Title,
  //   Alternate_Applicant__r.Phone,
  //   Alternate_Applicant__r.Email,
  //   Applicant_Organization__r.Name,
  //   CSB_School_District__r.Name,
  //   Fleet_Name__c,
  //   School_District_Prioritized__c,
  //   Total_Rebate_Funds_Requested__c,
  //   Total_Infrastructure_Funds__c,
  //   Total_Bus_And_Infrastructure_Rebate__c,
  //   Num_Of_Buses_Requested_From_Application__c,
  //   Total_Price_All_Buses__c,
  //   Total_Bus_Rebate_Amount__c,
  //   Total_All_Eligible_Infrastructure_Costs__c,
  //   Total_Infrastructure_Rebate__c,
  //   Total_Level_2_Charger_Costs__c,
  //   Total_DC_Fast_Charger_Costs__c,
  //   Total_Other_Infrastructure_Costs__c
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   recordtypeid = '${paymentRequestTableId}' AND
  //   CSB_Review_Item_ID__c = '${reviewItemId}' AND
  //   Latest_Version__c = TRUE`

  const paymentRequestTableRecordQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        recordtypeid: paymentRequestTableId,
        CSB_Review_Item_ID__c: reviewItemId,
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
        UEI_EFTI_Combo_Key__c: 1,
        CSB_NCES_ID__c: 1,
        "Primary_Applicant__r.Name": 1,
        "Primary_Applicant__r.Title": 1,
        "Primary_Applicant__r.Phone": 1,
        "Primary_Applicant__r.Email": 1,
        "Alternate_Applicant__r.Name": 1,
        "Alternate_Applicant__r.Title": 1,
        "Alternate_Applicant__r.Phone": 1,
        "Alternate_Applicant__r.Email": 1,
        "Applicant_Organization__r.Name": 1,
        "CSB_School_District__r.Name": 1,
        Fleet_Name__c: 1,
        School_District_Prioritized__c: 1,
        Total_Rebate_Funds_Requested__c: 1,
        Total_Infrastructure_Funds__c: 1,
        Total_Bus_And_Infrastructure_Rebate__c: 1,
        Num_Of_Buses_Requested_From_Application__c: 1,
        Total_Price_All_Buses__c: 1,
        Total_Bus_Rebate_Amount__c: 1,
        Total_All_Eligible_Infrastructure_Costs__c: 1,
        Total_Infrastructure_Rebate__c: 1,
        Total_Level_2_Charger_Costs__c: 1,
        Total_DC_Fast_Charger_Costs__c: 1,
        Total_Other_Infrastructure_Costs__c: 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));

  const paymentRequestTableRecordId = paymentRequestTableRecordQuery["0"].Id;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Rebate_Item' AND
  //   sobjecttype = '${BAP_BUS_TABLE}'
  // LIMIT 1`

  const busTableIdQuery = await bapConnection
    .sobject("recordtype")
    .find(
      {
        developername: "CSB_Rebate_Item",
        sobjecttype: BAP_BUS_TABLE,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
      }
    )
    .limit(1)
    .execute(async (err, records) => ((await err) ? err : records));

  const busTableId = busTableIdQuery["0"].Id;

  // `SELECT
  //   Rebate_Item_num__c,
  //   CSB_VIN__c,
  //   CSB_Model_Year__c,
  //   CSB_Fuel_Type__c,
  //   CSB_Manufacturer_if_Other__c,
  //   Old_Bus_NCES_District_ID__c,
  //   Old_Bus_Estimated_Remaining_Life__c,
  //   Related_Line_Item__r.Purchaser_Name__c,
  //   New_Bus_Fuel_Type__c,
  //   New_Bus_Make__c,
  //   New_Bus_Model__c,
  //   New_Bus_Model_Year__c,
  //   New_Bus_GVWR__c,
  //   New_Bus_Rebate_Amount__c,
  //   New_Bus_Purchase_Price__c
  // FROM
  //   ${BAP_BUS_TABLE}
  // WHERE
  //   recordtypeid = '${busTableId}' AND
  //   Related_Order_Request__c = '${paymentRequestTableRecordId}' AND
  //   CSB_Rebate_Item_Type__c = 'New Bus'`

  const busTableRecordsQuery = await bapConnection
    .sobject(BAP_BUS_TABLE)
    .find(
      {
        recordtypeid: busTableId,
        Related_Order_Request__c: paymentRequestTableRecordId,
        CSB_Rebate_Item_Type__c: "New Bus",
      },
      {
        // "*": 1,
        Rebate_Item_num__c: 1,
        CSB_VIN__c: 1,
        CSB_Model_Year__c: 1,
        CSB_Fuel_Type__c: 1,
        CSB_Manufacturer_if_Other__c: 1,
        Old_Bus_NCES_District_ID__c: 1,
        Old_Bus_Estimated_Remaining_Life__c: 1,
        "Related_Line_Item__r.Purchaser_Name__c": 1,
        New_Bus_Fuel_Type__c: 1,
        New_Bus_Make__c: 1,
        New_Bus_Model__c: 1,
        New_Bus_Model_Year__c: 1,
        New_Bus_GVWR__c: 1,
        New_Bus_Rebate_Amount__c: 1,
        New_Bus_Purchase_Price__c: 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));

  return { paymentRequestTableRecordQuery, busTableRecordsQuery };
}

/**
 * Verifies the BAP connection has been setup, then calls the provided callback function with the provided arguments.
 * @param {express.Request} req
 * @param {Object} callback callback function name and arguments to call after BAP connection has been verified
 * @param {function} callback.name name of the callback function
 * @param {any[]} callback.args arguments to pass to the callback function
 */
function verifyBapConnection(req, { name, args }) {
  /** @type {jsforce.Connection} */
  const bapConnection = req.app.locals.bapConnection;

  function callback() {
    return name(...args).catch((err) => {
      const message = `BAP Error: ${err}`;
      log({ level: "error", message, req });
      throw err;
    });
  }

  if (!bapConnection) {
    const message = `BAP connection has not yet been initialized.`;
    log({ level: "info", message });
    return setupConnection(req.app).then(() => callback());
  }

  return bapConnection
    .identity((err, res) => {
      if (err) {
        const message = `BAP connection identity error.`;
        log({ level: "info", message });
        return setupConnection(req.app).then(() => callback());
      }
    })
    .then((res) => callback());
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
 * Fetches SAM.gov entity combo keys associated with a provided user.
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
 * Fetches form submissions statuses associated with a provided set of combo keys.
 * @param {express.Request} req
 * @param {string[]} comboKeys
 */
function getBapFormSubmissionsStatuses(req, comboKeys) {
  return verifyBapConnection(req, {
    name: queryForBapFormSubmissionsStatuses,
    args: [req, comboKeys],
  });
}

/**
 * Fetches an Application form submission associated with a CSB Review Item ID.
 * @param {express.Request} req
 * @param {string} reviewItemId
 */
function getBapApplicationSubmission(req, reviewItemId) {
  return verifyBapConnection(req, {
    name: queryForBapApplicationSubmission,
    args: [req, reviewItemId],
  });
}

/**
 * Fetches a Payment Request form submission associated with a CSB Review Item ID.
 * @param {express.Request} req
 * @param {string} reviewItemId
 */
function getBapPaymentRequestSubmission(req, reviewItemId) {
  return verifyBapConnection(req, {
    name: queryForBapPaymentRequestSubmission,
    args: [req, reviewItemId],
  });
}

module.exports = {
  getSamEntities,
  getBapComboKeys,
  getBapFormSubmissionsStatuses,
  getBapApplicationSubmission,
  getBapPaymentRequestSubmission,
};
