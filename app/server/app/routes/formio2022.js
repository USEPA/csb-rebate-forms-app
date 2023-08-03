const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  submissionPeriodOpen,
  formio2022FRFUrl,
  formio2022PRFUrl,
  formio2022CRFUrl,
  formioCSBMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const {
  getBapFormSubmissionsStatuses,
  getBapDataForPRF,
  getBapDataForCRF,
} = require("../utilities/bap");
const log = require("../utilities/logger");

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

const router = express.Router();

router.use(ensureAuthenticated);

// --- download Formio S3 file metadata
router.get(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, query } = req;
    const { mail } = req.user;
    const { comboKey } = req.params;

    if (!bapComboKeys.includes(comboKey)) {
      const logMessage =
        `User with email '${mail}' attempted to download a file ` +
        `without a matching BAP combo key.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 401;
      const errorMessage = `Unauthorized.`;
      return res.status(errorStatus).json({ message: errorMessage });
    }

    axiosFormio(req)
      .get(`${formio2022FRFUrl}/storage/s3`, { params: query })
      .then((axiosRes) => axiosRes.data)
      .then((fileMetadata) => res.json(fileMetadata))
      .catch((error) => {
        // NOTE: logged in axiosFormio response interceptor
        const errorStatus = error.response?.status || 500;
        const errorMessage = `Error downloading file from S3.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- upload Formio S3 file metadata
router.post(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, body } = req;
    const { mail } = req.user;
    const { formType, mongoId, comboKey } = req.params;

    checkFormSubmissionPeriodAndBapStatus({
      rebateYear: "2022",
      formType,
      mongoId,
      comboKey,
      req,
    })
      .then(() => {
        if (!bapComboKeys.includes(comboKey)) {
          const logMessage =
            `User with email '${mail}' attempted to upload a file ` +
            `without a matching BAP combo key.`;
          log({ level: "error", message: logMessage, req });

          const errorStatus = 401;
          const errorMessage = `Unauthorized.`;
          return res.status(errorStatus).json({ message: errorMessage });
        }

        axiosFormio(req)
          .post(`${formio2022FRFUrl}/storage/s3`, body)
          .then((axiosRes) => axiosRes.data)
          .then((fileMetadata) => res.json(fileMetadata))
          .catch((error) => {
            // NOTE: logged in axiosFormio response interceptor
            const errorStatus = error.response?.status || 500;
            const errorMessage = `Error uploading file to S3.`;
            return res.status(errorStatus).json({ message: errorMessage });
          });
      })
      .catch((error) => {
        const formName =
          formType === "frf"
            ? "CSB Application"
            : formType === "prf"
            ? "CSB Payment Request"
            : formType === "cof"
            ? "CSB Close Out"
            : "CSB";

        const logMessage =
          `User with email '${mail}' attempted to upload a file when the ` +
          `${rebateYear} ${formName} form enrollment period was closed.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 400;
        const errorMessage = `${rebateYear} ${formName} form enrollment period is closed.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- get user's 2022 FRF submissions from Formio
router.get("/frf-submissions", storeBapComboKeys, (req, res) => {
  const { bapComboKeys } = req;

  /**
   * NOTE: Helpdesk users might not have any SAM.gov records associated with
   * their email address so we should not return any submissions to those users.
   * The only reason we explicitly need to do this is because there could be
   * some submissions without `bap_hidden_entity_combo_key` field values in the
   * Formio database – that will never be the case for submissions created from
   * this app, but there could be submissions created externally if someone is
   * testing posting data (e.g. from a REST client, or the Formio Viewer).
   */
  if (bapComboKeys.length === 0) return res.json([]);

  const userSubmissionsUrl =
    `${formio2022FRFUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=` +
    `${bapComboKeys.join("&data.bap_hidden_entity_combo_key=")}`;

  axiosFormio(req)
    .get(userSubmissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio Application form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- post a new 2022 FRF submission to Formio
router.post("/frf-submission", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const comboKey = body.data?.bap_hidden_entity_combo_key;

  if (!submissionPeriodOpen["2022"].frf) {
    const errorStatus = 400;
    const errorMessage = `CSB Application form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new FRF submission ` +
      `without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** Add custom metadata to track formio submissions from wrapper. */
  body.metadata = { ...formioCSBMetadata };

  axiosFormio(req)
    .post(`${formio2022FRFUrl}/submission`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error posting Formio Application form submission.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get an existing 2022 FRF's schema and submission data from Formio
router.get(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys } = req;
    const { mail } = req.user;
    const { mongoId } = req.params;

    Promise.all([
      axiosFormio(req).get(`${formio2022FRFUrl}/submission/${mongoId}`),
      axiosFormio(req).get(formio2022FRFUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submission, schema]) => {
        const comboKey = submission.data.bap_hidden_entity_combo_key;

        if (!bapComboKeys.includes(comboKey)) {
          const logMessage =
            `User with email '${mail}' attempted to access FRF submission '${mongoId}' ` +
            `that they do not have access to.`;
          log({ level: "warn", message: logMessage, req });

          return res.json({
            userAccess: false,
            formSchema: null,
            submission: null,
          });
        }

        return res.json({
          userAccess: true,
          formSchema: { url: formio2022FRFUrl, json: schema },
          submission,
        });
      })
      .catch((error) => {
        // NOTE: logged in axiosFormio response interceptor
        const errorStatus = error.response?.status || 500;
        const errorMessage = `Error getting Formio Application form submission '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- post an update to an existing draft 2022 FRF submission to Formio
router.post(
  "/frf-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys } = req;
    const { mail } = req.user;
    const { mongoId } = req.params;
    const submission = req.body;
    const comboKey = submission.data?.bap_hidden_entity_combo_key;

    checkFormSubmissionPeriodAndBapStatus({
      rebateYear: "2022",
      formType: "frf",
      mongoId,
      comboKey,
      req,
    })
      .then(() => {
        if (!bapComboKeys.includes(comboKey)) {
          const logMessage =
            `User with email '${mail}' attempted to update FRF submission '${mongoId}' ` +
            `without a matching BAP combo key.`;
          log({ level: "error", message: logMessage, req });

          const errorStatus = 401;
          const errorMessage = `Unauthorized.`;
          return res.status(errorStatus).json({ message: errorMessage });
        }

        /** Add custom metadata to track formio submissions from wrapper. */
        submission.metadata = {
          ...submission.metadata,
          ...formioCSBMetadata,
        };

        axiosFormio(req)
          .put(`${formio2022FRFUrl}/submission/${mongoId}`, submission)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => res.json(submission))
          .catch((error) => {
            // NOTE: logged in axiosFormio response interceptor
            const errorStatus = error.response?.status || 500;
            const errorMessage = `Error updating Formio Application form submission '${mongoId}'.`;
            return res.status(errorStatus).json({ message: errorMessage });
          });
      })
      .catch((error) => {
        const logMessage =
          `User with email '${mail}' attempted to update FRF submission '${mongoId}' ` +
          `when the CSB FRF enrollment period was closed.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 400;
        const errorMessage = `CSB Application form enrollment period is closed.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- get user's 2022 PRF submissions from Formio
router.get("/prf-submissions", storeBapComboKeys, (req, res) => {
  const { bapComboKeys } = req;

  const userSubmissionsUrl =
    `${formio2022PRFUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=${bapComboKeys.join(
      "&data.bap_hidden_entity_combo_key="
    )}`;

  axiosFormio(req)
    .get(userSubmissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio Payment Request form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- post a new 2022 PRF submission to Formio
router.post("/prf-submission", storeBapComboKeys, (req, res) => {
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
    frfFormModified,
  } = body;

  if (!submissionPeriodOpen["2022"].prf) {
    const errorStatus = 400;
    const errorMessage = `CSB Payment Request form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new PRF submission ` +
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

  return getBapDataForPRF(req, frfReviewItemId)
    .then(({ frfRecordQuery, busRecordsQuery }) => {
      const {
        CSB_NCES_ID__c,
        Primary_Applicant__r,
        Alternate_Applicant__r,
        Applicant_Organization__r,
        CSB_School_District__r,
        Fleet_Name__c,
        School_District_Prioritized__c,
        Total_Rebate_Funds_Requested__c,
        Total_Infrastructure_Funds__c,
      } = frfRecordQuery[0];

      const busInfo = busRecordsQuery.map((record) => ({
        busNum: record.Rebate_Item_num__c,
        oldBusNcesDistrictId: CSB_NCES_ID__c,
        oldBusVin: record.CSB_VIN__c,
        oldBusModelYear: record.CSB_Model_Year__c,
        oldBusFuelType: record.CSB_Fuel_Type__c,
        newBusFuelType: record.CSB_Replacement_Fuel_Type__c,
        hidden_bap_max_rebate: record.CSB_Funds_Requested__c,
      }));

      /**
       * NOTE: `purchaseOrders` is initialized as an empty array to fix some
       * issue with the field being changed to an object when the form loads
       */
      const submission = {
        data: {
          bap_hidden_entity_combo_key: comboKey,
          hidden_application_form_modified: frfFormModified,
          hidden_current_user_email: email,
          hidden_current_user_title: title,
          hidden_current_user_name: name,
          hidden_sam_uei: UNIQUE_ENTITY_ID__c,
          hidden_sam_efti: ENTITY_EFT_INDICATOR__c || "0000",
          hidden_sam_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
          hidden_sam_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
          hidden_sam_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
          hidden_sam_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
          hidden_bap_rebate_id: rebateId,
          hidden_bap_district_id: CSB_NCES_ID__c,
          hidden_bap_primary_name: Primary_Applicant__r?.Name,
          hidden_bap_primary_title: Primary_Applicant__r?.Title,
          hidden_bap_primary_phone_number: Primary_Applicant__r?.Phone,
          hidden_bap_primary_email: Primary_Applicant__r?.Email,
          hidden_bap_alternate_name: Alternate_Applicant__r?.Name || "",
          hidden_bap_alternate_title: Alternate_Applicant__r?.Title || "",
          hidden_bap_alternate_phone_number: Alternate_Applicant__r?.Phone || "", // prettier-ignore
          hidden_bap_alternate_email: Alternate_Applicant__r?.Email || "",
          hidden_bap_org_name: Applicant_Organization__r?.Name,
          hidden_bap_district_name: CSB_School_District__r?.Name,
          hidden_bap_fleet_name: Fleet_Name__c,
          hidden_bap_prioritized: School_District_Prioritized__c,
          hidden_bap_requested_funds: Total_Rebate_Funds_Requested__c,
          hidden_bap_infra_max_rebate: Total_Infrastructure_Funds__c,
          busInfo,
          purchaseOrders: [],
        },
        /** Add custom metadata to track formio submissions from wrapper. */
        metadata: {
          ...formioCSBMetadata,
        },
        state: "draft",
      };

      axiosFormio(req)
        .post(`${formio2022PRFUrl}/submission`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error posting Formio Payment Request form submission.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting data for a new Payment Request form submission from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get an existing 2022 PRF's schema and submission data from Formio
router.get("/prf-submission/:rebateId", storeBapComboKeys, async (req, res) => {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)

  const matchedPaymentRequestFormSubmissions =
    `${formio2022PRFUrl}/submission` +
    `?data.hidden_bap_rebate_id=${rebateId}` +
    `&select=_id,data.bap_hidden_entity_combo_key`;

  Promise.all([
    axiosFormio(req).get(matchedPaymentRequestFormSubmissions),
    axiosFormio(req).get(formio2022PRFUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submissions, schema]) => {
      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data.bap_hidden_entity_combo_key;

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access PRF submission '${rebateId}' ` +
          `that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
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
        .get(`${formio2022PRFUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          return res.json({
            userAccess: true,
            formSchema: { url: formio2022PRFUrl, json: schema },
            submission,
          });
        });
    })
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio Payment Request form submission '${rebateId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- post an update to an existing draft 2022 PRF submission to Formio
router.post("/prf-submission/:rebateId", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)
  const { mongoId, submission } = body;
  const comboKey = submission.data?.bap_hidden_entity_combo_key;

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear: "2022",
    formType: "prf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update PRF submission '${rebateId}' ` +
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

      /** Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formio2022PRFUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio Payment Request form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      const logMessage =
        `User with email '${mail}' attempted to update PRF submission '${rebateId}' ` +
        `when the CSB PRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `CSB Payment Request form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- delete an existing 2022 PRF submission from Formio
router.post("/delete-prf-submission", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { mongoId, rebateId, comboKey } = body;

  // verify post data includes one of user's BAP combo keys
  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to delete PRF submission '${rebateId}' ` +
      `without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /**
   * ensure the BAP status of the corresponding FRF submission is "Edits
   * Requested" before deleting the FRF submission from Formio
   */
  getBapFormSubmissionsStatuses(req, req.bapComboKeys)
    .then((submissions) => {
      const frf = submissions.find((submission) => {
        return (
          submission.Parent_Rebate_ID__c === rebateId &&
          submission.Record_Type_Name__c === "CSB Funding Request"
        );
      });

      const frfNeedsEdits =
        frf?.Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c ===
        "Edits Requested";

      if (!frfNeedsEdits) {
        const errorStatus = 400;
        const errorMessage = `Application form submission '${mongoId}' does not need edits.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      axiosFormio(req)
        .delete(`${formio2022PRFUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((response) => {
          const logMessage = `User with email '${mail}' successfully deleted PRF submission '${rebateId}'.`;
          log({ level: "info", message: logMessage, req });

          res.json(response);
        })
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error deleting Formio Payment Request form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting form submissions statuses from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get user's 2022 CRF submissions from Formio
router.get("/crf-submissions", storeBapComboKeys, (req, res) => {
  const { bapComboKeys } = req;

  const userSubmissionsUrl =
    `${formio2022CRFUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=${bapComboKeys.join(
      "&data.bap_hidden_entity_combo_key="
    )}`;

  axiosFormio(req)
    .get(userSubmissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio Close Out form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
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

  return getBapDataForCRF(req, frfReviewItemId, prfReviewItemId)
    .then(({ frfRecordQuery, prfRecordQuery, busRecordsQuery }) => {
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
      } = frfRecordQuery[0];

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
      } = prfRecordQuery[0];

      const busInfo = busRecordsQuery.map((record) => ({
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
          hidden_bap_total_infra_level2_charger: Total_Level_2_Charger_Costs__c,
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
        .post(`${formio2022CRFUrl}/submission`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error posting Formio Close Out form submission.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
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

  const matchedCloseOutFormSubmissions =
    `${formio2022CRFUrl}/submission` +
    `?data.hidden_bap_rebate_id=${rebateId}` +
    `&select=_id,data.bap_hidden_entity_combo_key`;

  Promise.all([
    axiosFormio(req).get(matchedCloseOutFormSubmissions),
    axiosFormio(req).get(formio2022CRFUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submissions, schema]) => {
      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data.bap_hidden_entity_combo_key;

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access CRF submission '${rebateId}' ` +
          `that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
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
        .get(`${formio2022CRFUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          return res.json({
            userAccess: true,
            formSchema: { url: formio2022CRFUrl, json: schema },
            submission,
          });
        });
    })
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
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

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear: "2022",
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
        .put(`${formio2022CRFUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
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
