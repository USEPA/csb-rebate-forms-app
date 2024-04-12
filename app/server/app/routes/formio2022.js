const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const {
  getBapDataFor2022CRF,
  checkFormSubmissionPeriodAndBapStatus,
} = require("../utilities/bap");
const {
  uploadS3FileMetadata,
  downloadS3FileMetadata,
  //
  fetchFRFSubmissions,
  createFRFSubmission,
  fetchFRFSubmission,
  updateFRFSubmission,
  //
  fetchPRFSubmissions,
  createPRFSubmission,
  fetchPRFSubmission,
  updatePRFSubmission,
  deletePRFSubmission,
  //
  fetchCRFSubmissions,
} = require("../utilities/formio");
const log = require("../utilities/logger");

/** Example rebateId value used in OpenAPI docs (used by EPA API scan) */
const emptyRebateId = "000000";

/** JSON response for forms user doesn't have access to */
const noUserAccess = {
  userAccess: false,
  formSchema: null,
  submission: null,
};

const formioCRFUrl = formUrl["2022"].crf;

const rebateYear = "2022";
const router = express.Router();

router.use(ensureAuthenticated);

// --- download Formio S3 file metadata
router.get(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    downloadS3FileMetadata({ rebateYear, req, res });
  },
);

// --- upload Formio S3 file metadata
router.post(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    uploadS3FileMetadata({ rebateYear, req, res });
  },
);

// --- get user's 2022 FRF submissions from Formio
router.get("/frf-submissions", storeBapComboKeys, (req, res) => {
  fetchFRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2022 FRF submission to Formio
router.post("/frf-submission", storeBapComboKeys, (req, res) => {
  createFRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2022 FRF's schema and submission data from Formio
router.get(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    fetchFRFSubmission({ rebateYear, req, res });
  },
);

// --- post an update to an existing draft 2022 FRF submission to Formio
router.post(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    updateFRFSubmission({ rebateYear, req, res });
  },
);

// --- get user's 2022 PRF submissions from Formio
router.get("/prf-submissions", storeBapComboKeys, (req, res) => {
  fetchPRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2022 PRF submission to Formio
router.post("/prf-submission", storeBapComboKeys, (req, res) => {
  createPRFSubmission({ rebateYear, req, res });
});

// --- get an existing 2022 PRF's schema and submission data from Formio
router.get("/prf-submission/:rebateId", storeBapComboKeys, async (req, res) => {
  fetchPRFSubmission({ rebateYear, req, res });
});

// --- post an update to an existing draft 2022 PRF submission to Formio
router.post("/prf-submission/:rebateId", storeBapComboKeys, (req, res) => {
  updatePRFSubmission({ rebateYear, req, res });
});

// --- delete an existing 2022 PRF submission from Formio
router.post("/delete-prf-submission", storeBapComboKeys, (req, res) => {
  deletePRFSubmission({ rebateYear, req, res });
});

// --- get user's 2022 CRF submissions from Formio
router.get("/crf-submissions", storeBapComboKeys, (req, res) => {
  fetchCRFSubmissions({ rebateYear, req, res });
});

// --- post a new 2022 CRF submission to Formio
router.post("/crf-submission", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const {
    email,
    title,
    name,
    entity,
    comboKey,
    rebateId,
    frfReviewItemId,
    prfReviewItemId,
    prfModified,
  } = body;

  // NOTE: included to support EPA API scan
  if (Object.keys(body).length === 0) {
    return res.json({});
  }

  if (!submissionPeriodOpen["2022"].crf) {
    const errorStatus = 400;
    const errorMessage = `CSB Close Out form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new CRF submission ` +
      `without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const {
    UNIQUE_ENTITY_ID__c,
    ENTITY_EFT_INDICATOR__c,
    ELEC_BUS_POC_EMAIL__c,
    ALT_ELEC_BUS_POC_EMAIL__c,
    GOVT_BUS_POC_EMAIL__c,
    ALT_GOVT_BUS_POC_EMAIL__c,
  } = entity;

  return getBapDataFor2022CRF(req, frfReviewItemId, prfReviewItemId)
    .then(
      ({ frf2022RecordQuery, prf2022RecordQuery, prf2022busRecordsQuery }) => {
        const {
          Fleet_Name__c,
          Fleet_Street_Address__c,
          Fleet_City__c,
          Fleet_State__c,
          Fleet_Zip__c,
          Fleet_Contact_Name__c,
          Fleet_Contact_Title__c,
          Fleet_Contact_Phone__c,
          Fleet_Contact_Email__c,
          School_District_Contact__r,
        } = frf2022RecordQuery[0];

        const {
          CSB_NCES_ID__c,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          Applicant_Organization__r,
          CSB_School_District__r,
          School_District_Prioritized__c,
          Total_Rebate_Funds_Requested_PO__c,
          Total_Bus_And_Infrastructure_Rebate__c,
          Total_Infrastructure_Funds__c,
          Num_Of_Buses_Requested_From_Application__c,
          Total_Price_All_Buses__c,
          Total_Bus_Rebate_Amount__c,
          Total_All_Eligible_Infrastructure_Costs__c,
          Total_Infrastructure_Rebate__c,
          Total_Level_2_Charger_Costs__c,
          Total_DC_Fast_Charger_Costs__c,
          Total_Other_Infrastructure_Costs__c,
        } = prf2022RecordQuery[0];

        const busInfo = prf2022busRecordsQuery.map((record) => ({
          busNum: record.Rebate_Item_num__c,
          oldBusNcesDistrictId: CSB_NCES_ID__c,
          oldBusVin: record.CSB_VIN__c,
          oldBusModelYear: record.CSB_Model_Year__c,
          oldBusFuelType: record.CSB_Fuel_Type__c,
          oldBusEstimatedRemainingLife: record.Old_Bus_Estimated_Remaining_Life__c, // prettier-ignore
          oldBusExclude: record.Old_Bus_Exclude__c,
          hidden_prf_oldBusExclude: record.Old_Bus_Exclude__c,
          newBusDealer: record.Related_Line_Item__r?.Vendor_Name__c,
          newBusFuelType: record.New_Bus_Fuel_Type__c,
          hidden_prf_newBusFuelType: record.New_Bus_Fuel_Type__c,
          newBusMake: record.New_Bus_Make__c,
          hidden_prf_newBusMake: record.New_Bus_Make__c,
          newBusMakeOther: record.CSB_Manufacturer_if_Other__c,
          hidden_prf_newBusMakeOther: record.CSB_Manufacturer_if_Other__c,
          newBusModel: record.New_Bus_Model__c,
          hidden_prf_newBusModel: record.New_Bus_Model__c,
          newBusModelYear: record.New_Bus_Model_Year__c,
          hidden_prf_newBusModelYear: record.New_Bus_Model_Year__c,
          newBusGvwr: record.New_Bus_GVWR__c,
          hidden_prf_newBusGvwr: record.New_Bus_GVWR__c,
          newBusPurchasePrice: record.New_Bus_Purchase_Price__c,
          hidden_prf_newBusPurchasePrice: record.New_Bus_Purchase_Price__c,
          hidden_prf_rebate: record.New_Bus_Rebate_Amount__c,
        }));

        const submission = {
          data: {
            bap_hidden_entity_combo_key: comboKey,
            hidden_prf_modified: prfModified,
            hidden_current_user_email: email,
            hidden_current_user_title: title,
            hidden_current_user_name: name,
            hidden_bap_rebate_id: rebateId,
            hidden_sam_uei: UNIQUE_ENTITY_ID__c,
            hidden_sam_efti: ENTITY_EFT_INDICATOR__c || "0000",
            hidden_sam_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            hidden_sam_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            hidden_sam_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            hidden_sam_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            hidden_bap_district_id: CSB_NCES_ID__c,
            hidden_bap_district_name: CSB_School_District__r?.Name,
            hidden_bap_primary_fname: Primary_Applicant__r?.FirstName,
            hidden_bap_primary_lname: Primary_Applicant__r?.LastName,
            hidden_bap_primary_title: Primary_Applicant__r?.Title,
            hidden_bap_primary_phone_number: Primary_Applicant__r?.Phone,
            hidden_bap_primary_email: Primary_Applicant__r?.Email,
            hidden_bap_alternate_fname: Alternate_Applicant__r?.FirstName || "",
            hidden_bap_alternate_lname: Alternate_Applicant__r?.LastName || "",
            hidden_bap_alternate_title: Alternate_Applicant__r?.Title || "",
            hidden_bap_alternate_phone_number: Alternate_Applicant__r?.Phone || "", // prettier-ignore
            hidden_bap_alternate_email: Alternate_Applicant__r?.Email || "",
            hidden_bap_org_name: Applicant_Organization__r?.Name,
            hidden_bap_fleet_name: Fleet_Name__c,
            hidden_bap_fleet_address: Fleet_Street_Address__c,
            hidden_bap_fleet_city: Fleet_City__c,
            hidden_bap_fleet_state: Fleet_State__c,
            hidden_bap_fleet_zip: Fleet_Zip__c,
            hidden_bap_fleet_contact_name: Fleet_Contact_Name__c,
            hidden_bap_fleet_contact_title: Fleet_Contact_Title__c,
            hidden_bap_fleet_phone: Fleet_Contact_Phone__c,
            hidden_bap_fleet_email: Fleet_Contact_Email__c,
            hidden_bap_prioritized: School_District_Prioritized__c,
            hidden_bap_requested_funds: Total_Rebate_Funds_Requested_PO__c,
            hidden_bap_received_funds: Total_Bus_And_Infrastructure_Rebate__c,
            hidden_bap_prf_infra_max_rebate: Total_Infrastructure_Funds__c,
            hidden_bap_buses_requested_app: Num_Of_Buses_Requested_From_Application__c, // prettier-ignore
            hidden_bap_total_bus_costs_prf: Total_Price_All_Buses__c,
            hidden_bap_total_bus_rebate_received: Total_Bus_Rebate_Amount__c,
            hidden_bap_total_infra_costs_prf: Total_All_Eligible_Infrastructure_Costs__c, // prettier-ignore
            hidden_bap_total_infra_rebate_received: Total_Infrastructure_Rebate__c, // prettier-ignore
            hidden_bap_total_infra_level2_charger: Total_Level_2_Charger_Costs__c, // prettier-ignore
            hidden_bap_total_infra_dc_fast_charger: Total_DC_Fast_Charger_Costs__c, // prettier-ignore
            hidden_bap_total_infra_other_costs: Total_Other_Infrastructure_Costs__c, // prettier-ignore
            hidden_bap_district_contact_fname: School_District_Contact__r?.FirstName, // prettier-ignore
            hidden_bap_district_contact_lname: School_District_Contact__r?.LastName, // prettier-ignore
            busInfo,
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: {
            ...formioCSBMetadata,
          },
          state: "draft",
        };

        axiosFormio(req)
          .post(`${formioCRFUrl}/submission`, submission)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => res.json(submission))
          .catch((error) => {
            // NOTE: error is logged in axiosFormio response interceptor
            const errorStatus = error.response?.status || 500;
            const errorMessage = `Error posting Formio Close Out form submission.`;
            return res.status(errorStatus).json({ message: errorMessage });
          });
      },
    )
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting data for a new Close Out form submission from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get an existing 2022 CRF's schema and submission data from Formio
router.get("/crf-submission/:rebateId", storeBapComboKeys, async (req, res) => {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)

  // NOTE: included to support EPA API scan
  if (rebateId === emptyRebateId) {
    return res.json(noUserAccess);
  }

  const matchedCRFSubmissions =
    `${formioCRFUrl}/submission` +
    `?data.hidden_bap_rebate_id=${rebateId}` +
    `&select=_id,data.bap_hidden_entity_combo_key`;

  Promise.all([
    axiosFormio(req).get(matchedCRFSubmissions),
    axiosFormio(req).get(formioCRFUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submissions, schema]) => {
      if (submissions.length === 0) {
        return res.json(noUserAccess);
      }

      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data.bap_hidden_entity_combo_key;

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access CRF submission '${rebateId}' ` +
          `that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json(noUserAccess);
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /**
       * NOTE: We can't just use the returned submission data here because
       * Formio returns the string literal 'YES' instead of a base64 encoded
       * image string for signature fields when you query for all submissions
       * matching on a field's value (`/submission?data.hidden_bap_rebate_id=${rebateId}`).
       * We need to query for a specific submission (e.g. `/submission/${mongoId}`),
       * to have Formio return the correct signature field data.
       */
      axiosFormio(req)
        .get(`${formioCRFUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          return res.json({
            userAccess: true,
            formSchema: { url: formioCRFUrl, json: schema },
            submission,
          });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio Close Out form submission '${rebateId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- post an update to an existing draft 2022 CRF submission to Formio
router.post("/crf-submission/:rebateId", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)
  const { mongoId, submission } = body;
  const comboKey = submission.data?.bap_hidden_entity_combo_key;

  // NOTE: included to support EPA API scan
  if (rebateId === emptyRebateId) {
    return res.json({});
  }

  if (!mongoId || !submission) {
    const errorStatus = 400;
    const errorMessage = `Missing required data to update ${rebateYear} CRF submission '${rebateId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "crf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update CRF submission '${rebateId}' ` +
          `without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /**  Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioCRFUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio Close Out form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const logMessage =
        `User with email '${mail}' attempted to update CRF submission '${rebateId}' ` +
        `when the CSB CRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `CSB Close Out form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
