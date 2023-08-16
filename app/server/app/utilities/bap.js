/** Utilities to fetch data from EPA's Business Automation Platform (BAP) */

const jsforce = require("jsforce");
const express = require("express");
const log = require("../utilities/logger");
// ---
const { submissionPeriodOpen } = require("../config/formio");

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
 * @property {{
 *  type: string
 *  url: string
 * }} attributes
 */

/**
 * @typedef {Object} BapFormSubmission
 * @property {string} UEI_EFTI_Combo_Key__c
 * @property {string} CSB_Form_ID__c
 * @property {string} CSB_Modified_Full_String__c
 * @property {string} CSB_Review_Item_ID__c
 * @property {string} Parent_Rebate_ID__c
 * @property {string} Record_Type_Name__c
 * @property {{
 *  CSB_Funding_Request_Status__c: string
 *  CSB_Payment_Request_Status__c: string
 *  CSB_Closeout_Request_Status__c: string
 * }} Parent_CSB_Rebate__r
 * @property {{
 *  type: string
 *  url: string
 * }} attributes
 */

/**
 * @typedef {Object} BapDataForPRF
 * @property {{
 *  Id: string
 *  UEI_EFTI_Combo_Key__c: string
 *  CSB_NCES_ID__c: string
 *  Primary_Applicant__r: {
 *    Name: string
 *    Title: string
 *    Phone: string
 *    Email: string
 *  }
 *  Alternate_Applicant__r: {
 *    Name: string
 *    Title: string
 *    Phone: string
 *    Email: string
 *  } | null
 *  Applicant_Organization__r: {
 *    Name: string
 *  }
 *  CSB_School_District__r: {
 *    Name: string
 *  }
 *  Fleet_Name__c: string
 *  School_District_Prioritized__c: string
 *  Total_Rebate_Funds_Requested__c: string
 *  Total_Infrastructure_Funds__c: string
 * }[]} frfRecordQuery
 * @property {{
 *  Rebate_Item_num__c: string
 *  CSB_VIN__c: string
 *  CSB_Model_Year__c: string
 *  CSB_Fuel_Type__c: string
 *  CSB_Replacement_Fuel_Type__c: string
 *  CSB_Funds_Requested__c: string
 * }[]} busRecordsQuery
 * @property {{
 *  type: string
 *  url: string
 * }} attributes
 */

/**
 * @typedef {Object} BapDataForForCRF
 * @property {{
 *  Fleet_Name__c: string
 *  Fleet_Street_Address__c: string
 *  Fleet_City__c: string
 *  Fleet_State__c: string
 *  Fleet_Zip__c: string
 *  Fleet_Contact_Name__c: string
 *  Fleet_Contact_Title__c: string
 *  Fleet_Contact_Phone__c: string
 *  Fleet_Contact_Email__c: string
 *  School_District_Contact__r: {
 *    FirstName: string
 *    LastName: string
 *  }
 * }[]} frfRecordQuery
 * @property {{
 *  Id: string
 *  UEI_EFTI_Combo_Key__c: string
 *  CSB_NCES_ID__c: string
 *  Primary_Applicant__r: {
 *    FirstName: string
 *    LastName: string
 *    Title: string
 *    Phone: string
 *    Email: string
 *  }
 *  Alternate_Applicant__r: {
 *    FirstName: string
 *    LastName: string
 *    Title: string
 *    Phone: string
 *    Email: string
 *  } | null
 *  Applicant_Organization__r: {
 *    Name: string
 *  }
 *  CSB_School_District__r: {
 *    Name: string
 *  }
 *  School_District_Prioritized__c: string
 *  Total_Rebate_Funds_Requested_PO__c: string
 *  Total_Bus_And_Infrastructure_Rebate__c: string
 *  Total_Infrastructure_Funds__c: string
 *  Num_Of_Buses_Requested_From_Application__c: string
 *  Total_Price_All_Buses__c: string
 *  Total_Bus_Rebate_Amount__c: string
 *  Total_All_Eligible_Infrastructure_Costs__c: string
 *  Total_Infrastructure_Rebate__c: string
 *  Total_Level_2_Charger_Costs__c: string
 *  Total_DC_Fast_Charger_Costs__c: string
 *  Total_Other_Infrastructure_Costs__c: string
 * }[]} prfRecordQuery
 * @property {{
 *  Rebate_Item_num__c: string
 *  CSB_VIN__c: string
 *  CSB_Model_Year__c: string
 *  CSB_Fuel_Type__c: string
 *  CSB_Manufacturer_if_Other__c: string
 *  Old_Bus_NCES_District_ID__c: string
 *  Old_Bus_Estimated_Remaining_Life__c: string
 *  Old_Bus_Exclude__c: string
 *  Related_Line_Item__r: {
 *    Purchaser_Name__c: string
 *  }
 *  New_Bus_Fuel_Type__c: string
 *  New_Bus_Make__c: string
 *  New_Bus_Model__c: string
 *  New_Bus_Model_Year__c: string
 *  New_Bus_GVWR__c: string
 *  New_Bus_Rebate_Amount__c: string
 *  New_Bus_Purchase_Price__c: string
 * }[]} busRecordsQuery
 * @property {{
 *  type: string
 *  url: string
 * }} attributes
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
      const logMessage = `Initializing BAP connection: ${userInfo.url}.`;
      log({ level: "info", message: logMessage });

      /** Store bapConnection in global express object using app.locals. */
      app.locals.bapConnection = bapConnection;
    })
    .catch((err) => {
      const logMessage = `Error initializing BAP connection.`;
      log({ level: "info", message: logMessage });

      throw err;
    });
}

/**
 * Uses cached JSforce connection to query the BAP for SAM.gov entities.
 *
 * @param {express.Request} req
 * @param {string} email
 * @returns {Promise<BapSamEntity[]>} collection of SAM.gov entity data
 */
async function queryForSamEntities(req, email) {
  const logMessage = `Querying the BAP for SAM.gov entities for user with email: '${email}'.`;
  log({ level: "info", message: logMessage });

  /** @type {jsforce.Connection} */
  const { bapConnection } = req.app.locals;

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
 * Uses cached JSforce connection to query the BAP for a single form submission's
 * statuses and related metadata.
 *
 * @param {express.Request} req
 * @param {'frf' | 'prf' | 'crf'} formType
 * @param {string | null} rebateId
 * @param {string | null} mongoId
 * @returns {Promise<BapFormSubmission | null>} fields associated a form submission
 */
async function queryForBapFormSubmissionData(req, formType, rebateId, mongoId) {
  const logId = rebateId ? `rebateId: '${rebateId}'` : `mongoId: '${mongoId}'`;
  const logMessage =
    `Querying the BAP for ${formType.toUpperCase()} submission data ` +
    `associated with ${logId}.`;
  log({ level: "info", message: logMessage });

  /** @type {jsforce.Connection} */
  const { bapConnection } = req.app.locals;

  const developername =
    formType === "frf"
      ? "CSB_Funding_Request"
      : formType === "prf"
      ? "CSB_Payment_Request"
      : formType === "crf"
      ? "CSB_Closeout_Request"
      : null; // fallback

  if (!developername) return null;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = '${developername}' AND
  //   sobjecttype = '${BAP_FORMS_TABLE}'
  // LIMIT 1`

  const formRecordTypeIdQuery = await bapConnection
    .sobject("recordtype")
    .find(
      {
        developername,
        sobjecttype: BAP_FORMS_TABLE,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
      }
    )
    .limit(1)
    .execute(async (err, records) => ((await err) ? err : records));

  const formRecordTypeId = formRecordTypeIdQuery["0"].Id;

  // `SELECT
  //   UEI_EFTI_Combo_Key__c,
  //   CSB_Form_ID__c,
  //   CSB_Modified_Full_String__c,
  //   CSB_Review_Item_ID__c,
  //   Parent_Rebate_ID__c,
  //   Record_Type_Name__c,
  //   Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   recordtypeid = '${formRecordTypeId}' AND
  //   CSB_Form_ID__c = '${mongoId}'
  //   Latest_Version__c = TRUE`

  const formRecordQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        recordtypeid: formRecordTypeId,
        ...(mongoId && { CSB_Form_ID__c: mongoId }),
        ...(rebateId && { Parent_Rebate_ID__c: rebateId }),
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        UEI_EFTI_Combo_Key__c: 1,
        CSB_Form_ID__c: 1, // MongoDB ObjectId string
        CSB_Modified_Full_String__c: 1, // ISO 8601 date time string
        CSB_Review_Item_ID__c: 1, // CSB Rebate ID with form/version ID (9 digits)
        Parent_Rebate_ID__c: 1, // CSB Rebate ID (6 digits)
        Record_Type_Name__c: 1, // 'CSB Funding Request' | 'CSB Payment Request' | 'CSB Closeout Request'
        "Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c": 1,
        "Parent_CSB_Rebate__r.CSB_Payment_Request_Status__c": 1,
        "Parent_CSB_Rebate__r.CSB_Closeout_Request_Status__c": 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));

  return formRecordQuery[0];
}

/**
 * Uses cached JSforce connection to query the BAP for form submissions statuses
 * and related metadata.
 *
 * @param {express.Request} req
 * @param {string[]} comboKeys
 * @returns {Promise<BapFormSubmission[]>} collection of fields associated with each form submission
 */
async function queryForBapFormSubmissionsStatuses(req, comboKeys) {
  const logMessage =
    `Querying the BAP for form submissions statuses associated with ` +
    `combokeys: '${comboKeys}'.`;
  log({ level: "info", message: logMessage });

  /** @type {jsforce.Connection} */
  const { bapConnection } = req.app.locals;

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

  const parentRebateIds = Array.isArray(parentRebateIdsQuery)
    ? parentRebateIdsQuery.map((item) => item.Parent_Rebate_ID__c)
    : [];

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
        CSB_Modified_Full_String__c: 1, // ISO 8601 date time string
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
 * Uses cached JSforce connection to query the BAP for FRF submission data, for
 * use in a brand new PRF submission.
 *
 * @param {express.Request} req
 * @param {string} frfReviewItemId CSB Rebate ID with the form/version ID (9 digits)
 * @returns {Promise<BapDataForPRF>} FRF submission fields
 */
async function queryBapForPRFData(req, frfReviewItemId) {
  const logMessage =
    `Querying the BAP for FRF submission associated with ` +
    `FRF Review Item ID: '${frfReviewItemId}'.`;
  log({ level: "info", message: logMessage });

  /** @type {jsforce.Connection} */
  const { bapConnection } = req.app.locals;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Funding_Request' AND
  //   sobjecttype = '${BAP_FORMS_TABLE}'
  // LIMIT 1`

  const frfRecordTypeIdQuery = await bapConnection
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

  const frfRecordTypeId = frfRecordTypeIdQuery["0"].Id;

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
  //   recordtypeid = '${frfRecordTypeId}' AND
  //   CSB_Review_Item_ID__c = '${frfReviewItemId}' AND
  //   Latest_Version__c = TRUE`

  const frfRecordQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        recordtypeid: frfRecordTypeId,
        CSB_Review_Item_ID__c: frfReviewItemId,
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

  const frfRecordId = frfRecordQuery["0"].Id;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Rebate_Item' AND
  //   sobjecttype = '${BAP_BUS_TABLE}'
  // LIMIT 1`

  const busRecordTypeIdQuery = await bapConnection
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

  const busRecordTypeId = busRecordTypeIdQuery["0"].Id;

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
  //   recordtypeid = '${busRecordTypeId}' AND
  //   Related_Order_Request__c = '${frfRecordId}' AND
  //   CSB_Rebate_Item_Type__c = 'Old Bus'`

  const busRecordsQuery = await bapConnection
    .sobject(BAP_BUS_TABLE)
    .find(
      {
        recordtypeid: busRecordTypeId,
        Related_Order_Request__c: frfRecordId,
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

  return { frfRecordQuery, busRecordsQuery };
}

/**
 * Uses cached JSforce connection to query the BAP for FRF submission data and
 * PRF submission data, for use in a brand new CRF submission.
 *
 * @param {express.Request} req
 * @param {string} frfReviewItemId CSB Rebate ID with the form/version ID (9 digits)
 * @param {string} prfReviewItemId CSB Rebate ID with the form/version ID (9 digits)
 * @returns {Promise<BapDataForForCRF>} FRF and PRF submission fields
 */
async function queryBapForCRFData(req, frfReviewItemId, prfReviewItemId) {
  const logMessage =
    `Querying the BAP for FRF submission associated with ` +
    `FRF Review Item ID: '${frfReviewItemId}' and PRF submission associated with ` +
    `PRF Review Item ID: '${prfReviewItemId}'.`;
  log({ level: "info", message: logMessage });

  /** @type {jsforce.Connection} */
  const { bapConnection } = req.app.locals;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Funding_Request' AND
  //   sobjecttype = '${BAP_FORMS_TABLE}'
  // LIMIT 1`

  const frfRecordTypeIdQuery = await bapConnection
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

  const frfRecordTypeId = frfRecordTypeIdQuery["0"].Id;

  // `SELECT
  //   Fleet_Name__c,
  //   Fleet_Street_Address__c,
  //   Fleet_City__c,
  //   Fleet_State__c,
  //   Fleet_Zip__c,
  //   Fleet_Contact_Name__c,
  //   Fleet_Contact_Title__c,
  //   Fleet_Contact_Phone__c,
  //   Fleet_Contact_Email__c,
  //   School_District_Contact__r.FirstName,
  //   School_District_Contact__r.LastName
  // FROM
  //   ${BAP_FORMS_TABLE}
  // WHERE
  //   recordtypeid = '${frfRecordTypeId}' AND
  //   CSB_Review_Item_ID__c = '${frfReviewItemId}' AND
  //   Latest_Version__c = TRUE`

  const frfRecordQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        recordtypeid: frfRecordTypeId,
        CSB_Review_Item_ID__c: frfReviewItemId,
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        Fleet_Name__c: 1,
        Fleet_Street_Address__c: 1,
        Fleet_City__c: 1,
        Fleet_State__c: 1,
        Fleet_Zip__c: 1,
        Fleet_Contact_Name__c: 1,
        Fleet_Contact_Title__c: 1,
        Fleet_Contact_Phone__c: 1,
        Fleet_Contact_Email__c: 1,
        "School_District_Contact__r.FirstName": 1,
        "School_District_Contact__r.LastName": 1,
      }
    )
    .execute(async (err, records) => ((await err) ? err : records));

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Payment_Request' AND
  //   sobjecttype = '${BAP_FORMS_TABLE}'
  // LIMIT 1`

  const prfRecordTypeIdQuery = await bapConnection
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

  const prfRecordTypeId = prfRecordTypeIdQuery["0"].Id;

  // `SELECT
  //   Id,
  //   UEI_EFTI_Combo_Key__c,
  //   CSB_NCES_ID__c,
  //   Primary_Applicant__r.FirstName,
  //   Primary_Applicant__r.LastName,
  //   Primary_Applicant__r.Title,
  //   Primary_Applicant__r.Phone,
  //   Primary_Applicant__r.Email,
  //   Alternate_Applicant__r.FirstName,
  //   Alternate_Applicant__r.LastName,
  //   Alternate_Applicant__r.Title,
  //   Alternate_Applicant__r.Phone,
  //   Alternate_Applicant__r.Email,
  //   Applicant_Organization__r.Name,
  //   CSB_School_District__r.Name,
  //   School_District_Prioritized__c,
  //   Total_Rebate_Funds_Requested_PO__c,
  //   Total_Bus_And_Infrastructure_Rebate__c,
  //   Total_Infrastructure_Funds__c,
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
  //   recordtypeid = '${prfRecordTypeId}' AND
  //   CSB_Review_Item_ID__c = '${prfReviewItemId}' AND
  //   Latest_Version__c = TRUE`

  const prfRecordQuery = await bapConnection
    .sobject(BAP_FORMS_TABLE)
    .find(
      {
        recordtypeid: prfRecordTypeId,
        CSB_Review_Item_ID__c: prfReviewItemId,
        Latest_Version__c: true,
      },
      {
        // "*": 1,
        Id: 1, // Salesforce record ID
        UEI_EFTI_Combo_Key__c: 1,
        CSB_NCES_ID__c: 1,
        "Primary_Applicant__r.FirstName": 1,
        "Primary_Applicant__r.LastName": 1,
        "Primary_Applicant__r.Title": 1,
        "Primary_Applicant__r.Phone": 1,
        "Primary_Applicant__r.Email": 1,
        "Alternate_Applicant__r.FirstName": 1,
        "Alternate_Applicant__r.LastName": 1,
        "Alternate_Applicant__r.Title": 1,
        "Alternate_Applicant__r.Phone": 1,
        "Alternate_Applicant__r.Email": 1,
        "Applicant_Organization__r.Name": 1,
        "CSB_School_District__r.Name": 1,
        School_District_Prioritized__c: 1,
        Total_Rebate_Funds_Requested_PO__c: 1,
        Total_Bus_And_Infrastructure_Rebate__c: 1,
        Total_Infrastructure_Funds__c: 1,
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

  const prfRecordId = prfRecordQuery["0"].Id;

  // `SELECT
  //   Id
  // FROM
  //   recordtype
  // WHERE
  //   developername = 'CSB_Rebate_Item' AND
  //   sobjecttype = '${BAP_BUS_TABLE}'
  // LIMIT 1`

  const busRecordTypeIdQuery = await bapConnection
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

  const busRecordTypeId = busRecordTypeIdQuery["0"].Id;

  // `SELECT
  //   Rebate_Item_num__c,
  //   CSB_VIN__c,
  //   CSB_Model_Year__c,
  //   CSB_Fuel_Type__c,
  //   CSB_Manufacturer_if_Other__c,
  //   Old_Bus_NCES_District_ID__c,
  //   Old_Bus_Estimated_Remaining_Life__c,
  //   Old_Bus_Exclude__c,
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
  //   recordtypeid = '${busRecordTypeId}' AND
  //   Related_Order_Request__c = '${prfRecordId}' AND
  //   CSB_Rebate_Item_Type__c = 'New Bus'`

  const busRecordsQuery = await bapConnection
    .sobject(BAP_BUS_TABLE)
    .find(
      {
        recordtypeid: busRecordTypeId,
        Related_Order_Request__c: prfRecordId,
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
        Old_Bus_Exclude__c: 1,
        "Related_Line_Item__r.Vendor_Name__c": 1,
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

  return { frfRecordQuery, prfRecordQuery, busRecordsQuery };
}

/**
 * Verifies the BAP connection has been setup, then calls the provided callback
 * function with the provided arguments.
 *
 * @param {express.Request} req
 * @param {Object} fn callback function name and arguments to call after BAP connection has been verified
 * @param {function} fn.name name of the callback function
 * @param {any[]} fn.args arguments to pass to the callback function
 */
function verifyBapConnection(req, { name, args }) {
  /** @type {jsforce.Connection} */
  const { bapConnection } = req.app.locals;

  function callback() {
    return name(...args).catch((err) => {
      const logMessage = `BAP Error: ${err}.`;
      log({ level: "error", message: logMessage, req });

      throw err;
    });
  }

  if (!bapConnection) {
    const logMessage = `BAP connection has not yet been initialized.`;
    log({ level: "info", message: logMessage });

    return setupConnection(req.app).then(() => callback());
  }

  return bapConnection
    .identity((err, res) => {
      if (err) {
        const logMessage = `BAP connection identity error.`;
        log({ level: "info", message: logMessage });

        return setupConnection(req.app).then(() => callback());
      }
    })
    .then((res) => callback());
}

/**
 * Fetches SAM.gov entities associated with a provided user.
 *
 * @param {express.Request} req
 * @param {string} email
 * @returns {ReturnType<queryForSamEntities>}
 */
function getSamEntities(req, email) {
  return verifyBapConnection(req, {
    name: queryForSamEntities,
    args: [req, email],
  });
}

/**
 * Fetches SAM.gov entity combo keys associated with a provided user.
 *
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
 * Fetches data associated with a provided form submission.
 *
 * @param {express.Request} req
 * @param {'frf' | 'prf' | 'crf'} formType
 * @param {string | null} rebateId
 * @param {string | null} mongoId
 * @returns {ReturnType<queryForBapFormSubmissionData>}
 */
function getBapFormSubmissionData(req, formType, rebateId, mongoId) {
  return verifyBapConnection(req, {
    name: queryForBapFormSubmissionData,
    args: [req, formType, rebateId, mongoId],
  });
}

/**
 * Fetches form submissions statuses associated with a provided set of combo keys.
 *
 * @param {express.Request} req
 * @param {string[]} comboKeys
 * @returns {ReturnType<queryForBapFormSubmissionsStatuses>}
 */
function getBapFormSubmissionsStatuses(req, comboKeys) {
  return verifyBapConnection(req, {
    name: queryForBapFormSubmissionsStatuses,
    args: [req, comboKeys],
  });
}

/**
 * Fetches FRF submission data associated with a FRF Review Item ID.
 *
 * @param {express.Request} req
 * @param {string} frfReviewItemId
 * @returns {ReturnType<queryBapForPRFData>}
 */
function getBapDataForPRF(req, frfReviewItemId) {
  return verifyBapConnection(req, {
    name: queryBapForPRFData,
    args: [req, frfReviewItemId],
  });
}

/**
 * Fetches FRF submission data and PRF submission data associated with a FRF
 * Review Item ID and a PRF Review Item ID.
 *
 * @param {express.Request} req
 * @param {string} frfReviewItemId
 * @param {string} prfReviewItemId
 * @returns {ReturnType<queryBapForCRFData>}
 */
function getBapDataForCRF(req, frfReviewItemId, prfReviewItemId) {
  return verifyBapConnection(req, {
    name: queryBapForCRFData,
    args: [req, frfReviewItemId, prfReviewItemId],
  });
}

/**
 * Returns a resolved or rejected promise, depending on if the given form's
 * submission period is open (as set via environment variables), and if the form
 * submission has the status of "Edits Requested" or not (as stored in and
 * returned from the BAP).
 *
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {'frf' | 'prf' | 'crf'} param.formType
 * @param {string} param.mongoId
 * @param {string} param.comboKey
 * @param {express.Request} param.req
 */
function checkFormSubmissionPeriodAndBapStatus({
  rebateYear,
  formType,
  mongoId,
  comboKey,
  req,
}) {
  /** Form submission period is open, so continue. */
  if (submissionPeriodOpen[rebateYear][formType]) {
    return Promise.resolve();
  }

  /** Form submission period is closed, so only continue if edits are requested. */
  return getBapFormSubmissionsStatuses(req, [comboKey]).then((submissions) => {
    const submission = submissions.find((s) => s.CSB_Form_ID__c === mongoId);

    const statusField =
      formType === "frf"
        ? "CSB_Funding_Request_Status__c"
        : formType === "prf"
        ? "CSB_Payment_Request_Status__c"
        : formType === "crf"
        ? "CSB_Closeout_Request_Status__c"
        : null;

    return submission?.Parent_CSB_Rebate__r?.[statusField] === "Edits Requested"
      ? Promise.resolve()
      : Promise.reject();
  });
}

module.exports = {
  getSamEntities,
  getBapComboKeys,
  getBapFormSubmissionData,
  getBapFormSubmissionsStatuses,
  getBapDataForPRF,
  getBapDataForCRF,
  checkFormSubmissionPeriodAndBapStatus,
};
