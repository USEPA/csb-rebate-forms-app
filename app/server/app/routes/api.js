const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default || require("axios"); // TODO: https://github.com/axios/axios/issues/5011
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioApplicationFormUrl,
  formioPaymentRequestFormUrl,
  formioCloseOutFormUrl,
  formioCsbMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const {
  getSamEntities,
  getBapFormSubmissionsStatuses,
  getBapDataForPaymentRequest,
  getBapDataForCloseOut,
} = require("../utilities/bap");
const log = require("../utilities/logger");

const {
  NODE_ENV,
  CSB_APPLICATION_FORM_OPEN,
  CSB_PAYMENT_REQUEST_FORM_OPEN,
  CSB_CLOSE_OUT_FORM_OPEN,
  S3_PUBLIC_BUCKET,
  S3_PUBLIC_REGION,
} = process.env;

const applicationFormOpen = CSB_APPLICATION_FORM_OPEN === "true";
const paymentRequestFormOpen = CSB_PAYMENT_REQUEST_FORM_OPEN === "true";
const closeOutFormOpen = CSB_CLOSE_OUT_FORM_OPEN === "true";

/**
 * Returns a resolved or rejected promise, depending on if the given form's
 * submission period is open (as set via environment variables), and if the form
 * submission has the status of "Edits Requested" or not (as stored in and
 * returned from the BAP).
 *
 * @param {Object} param
 * @param {'application' | 'payment-request' | 'close-out'} param.formType
 * @param {string} param.mongoId
 * @param {string} param.comboKey
 * @param {express.Request} param.req
 */
function checkFormSubmissionPeriodAndBapStatus({
  formType,
  mongoId,
  comboKey,
  req,
}) {
  /** Form submission period is open, so continue. */
  if (
    (formType === "application" && applicationFormOpen) ||
    (formType === "payment-request" && paymentRequestFormOpen) ||
    (formType === "close-out" && closeOutFormOpen)
  ) {
    return Promise.resolve();
  }

  /** Form submission period is closed, so only continue if edits are requested. */
  return getBapFormSubmissionsStatuses(req, [comboKey]).then((submissions) => {
    const submission = submissions.find((s) => s.CSB_Form_ID__c === mongoId);

    const statusField =
      formType === "application"
        ? "CSB_Funding_Request_Status__c"
        : formType === "payment-request"
        ? "CSB_Payment_Request_Status__c"
        : formType === "close-out"
        ? "CSB_Closeout_Request_Status__c"
        : null;

    return submission?.Parent_CSB_Rebate__r?.[statusField] === "Edits Requested"
      ? Promise.resolve()
      : Promise.reject();
  });
}

const router = express.Router();

// --- get static content from S3
router.get("/content", (req, res) => {
  /** NOTE: static content files found in `app/server/app/content/` directory. */
  const filenames = [
    "site-alert.md",
    "helpdesk-intro.md",
    "all-rebates-intro.md",
    "all-rebates-outro.md",
    "new-application-dialog.md",
    "draft-application-intro.md",
    "submitted-application-intro.md",
    "draft-payment-request-intro.md",
    "submitted-payment-request-intro.md",
    "draft-close-out-intro.md",
    "submitted-close-out-intro.md",
  ];

  const s3BucketUrl = `https://${S3_PUBLIC_BUCKET}.s3-${S3_PUBLIC_REGION}.amazonaws.com`;

  Promise.all(
    filenames.map((filename) => {
      /**
       * local development: read files directly from disk
       * Cloud.gov: fetch files from the public s3 bucket
       */
      return NODE_ENV === "development"
        ? readFile(resolve(__dirname, "../content", filename), "utf8")
        : axios.get(`${s3BucketUrl}/content/${filename}`);
    })
  )
    .then((stringsOrResponses) => {
      /**
       * local development: no further processing of strings needed
       * Cloud.gov: get data from responses
       */
      return NODE_ENV === "development"
        ? stringsOrResponses
        : stringsOrResponses.map((axiosRes) => axiosRes.data);
    })
    .then((data) => {
      return res.json({
        siteAlert: data[0],
        helpdeskIntro: data[1],
        allRebatesIntro: data[2],
        allRebatesOutro: data[3],
        newApplicationDialog: data[4],
        draftApplicationIntro: data[5],
        submittedApplicationIntro: data[6],
        draftPaymentRequestIntro: data[7],
        submittedPaymentRequestIntro: data[8],
        draftCloseOutIntro: data[9],
        submittedCloseOutIntro: data[10],
      });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        const logMessage = error.toJSON();
        log({ level: "debug", message: logMessage, req });
      }

      const errorStatus = error.response?.status || 500;
      const errorMethod = error.response?.config?.method?.toUpperCase();
      const errorUrl = error.response?.config?.url;

      const logMessage = `S3 Error: ${errorStatus} ${errorMethod} ${errorUrl}`;
      log({ level: "error", message: logMessage, req });

      const errorMessage = `Error getting static content from S3 bucket.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

router.use(ensureAuthenticated);

// --- get user data from EPA Gateway/Login.gov
router.get("/user", (req, res) => {
  const { mail, memberof, exp } = req.user;
  return res.json({ mail, memberof, exp });
});

// --- get CSB app specific data (open enrollment status, etc.)
router.get("/csb-data", (req, res) => {
  return res.json({
    submissionPeriodOpen: {
      application: applicationFormOpen,
      paymentRequest: paymentRequestFormOpen,
      closeOut: closeOutFormOpen,
    },
  });
});

// --- get user's SAM.gov data from EPA's Business Automation Platform (BAP)
router.get("/bap-sam-data", (req, res) => {
  const { mail, memberof } = req.user;
  const userRoles = memberof.split(",");
  const adminOrHelpdeskUser =
    userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

  getSamEntities(req, mail)
    .then((entities) => {
      /**
       * NOTE: allow admin or helpdesk users access to the app, even without
       * SAM.gov data.
       */
      if (!adminOrHelpdeskUser && entities?.length === 0) {
        const logMessage = `User with email '${mail}' tried to use app without any associated SAM records.`;
        log({ level: "error", message: logMessage, req });

        return res.json({
          results: false,
          entities: [],
        });
      }

      return res.json({
        results: true,
        entities,
      });
    })
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting SAM.gov data from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get user's form submissions statuses from EPA's BAP
router.get("/bap-form-submissions", storeBapComboKeys, (req, res) => {
  const { bapComboKeys } = req;

  return getBapFormSubmissionsStatuses(req, bapComboKeys)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting form submissions statuses from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- download Formio S3 file metadata
router.get(
  "/s3/:formType/:mongoId/:comboKey/storage/s3",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, query } = req;
    const { mail } = req.user;
    const { comboKey } = req.params;

    if (!bapComboKeys.includes(comboKey)) {
      const logMessage = `User with email '${mail}' attempted to download a file without a matching BAP combo key.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 401;
      const errorMessage = `Unauthorized.`;
      return res.status(errorStatus).json({ message: errorMessage });
    }

    axiosFormio(req)
      .get(`${formioApplicationFormUrl}/storage/s3`, { params: query })
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

    checkFormSubmissionPeriodAndBapStatus({ formType, mongoId, comboKey, req })
      .then(() => {
        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to upload a file without a matching BAP combo key.`;
          log({ level: "error", message: logMessage, req });

          const errorStatus = 401;
          const errorMessage = `Unauthorized.`;
          return res.status(errorStatus).json({ message: errorMessage });
        }

        axiosFormio(req)
          .post(`${formioApplicationFormUrl}/storage/s3`, body)
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
          formType === "application"
            ? "CSB Application"
            : formType === "payment-request"
            ? "CSB Payment Request"
            : formType === "close-out"
            ? "CSB Close Out"
            : "CSB";

        const logMessage = `User with email '${mail}' attempted to upload a file when the ${formName} form enrollment period was closed.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 400;
        const errorMessage = `${formName} form enrollment period is closed.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- get user's Application form submissions from Formio
router.get("/formio-application-submissions", storeBapComboKeys, (req, res) => {
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
    `${formioApplicationFormUrl}/submission` +
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

// --- post a new Application form submission to Formio
router.post("/formio-application-submission", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const comboKey = body.data?.bap_hidden_entity_combo_key;

  if (!applicationFormOpen) {
    const errorStatus = 400;
    const errorMessage = `CSB Application form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage = `User with email '${mail}' attempted to post a new Application form submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** Add custom metadata to track formio submissions from wrapper. */
  body.metadata = { ...formioCsbMetadata };

  axiosFormio(req)
    .post(`${formioApplicationFormUrl}/submission`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error posting Formio Application form submission.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get an existing Application form's schema and submission data from Formio
router.get(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys } = req;
    const { mail } = req.user;
    const { mongoId } = req.params;

    Promise.all([
      axiosFormio(req).get(`${formioApplicationFormUrl}/submission/${mongoId}`),
      axiosFormio(req).get(formioApplicationFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submission, schema]) => {
        const comboKey = submission.data.bap_hidden_entity_combo_key;

        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to access Application form submission '${mongoId}' that they do not have access to.`;
          log({ level: "warn", message: logMessage, req });

          return res.json({
            userAccess: false,
            formSchema: null,
            submission: null,
          });
        }

        return res.json({
          userAccess: true,
          formSchema: { url: formioApplicationFormUrl, json: schema },
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

// --- post an update to an existing draft Application form submission to Formio
router.post(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys } = req;
    const { mail } = req.user;
    const { mongoId } = req.params;
    const submission = req.body;
    const comboKey = submission.data?.bap_hidden_entity_combo_key;
    const formType = "application";

    checkFormSubmissionPeriodAndBapStatus({ formType, mongoId, comboKey, req })
      .then(() => {
        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to update Application form submission '${mongoId}' without a matching BAP combo key.`;
          log({ level: "error", message: logMessage, req });

          const errorStatus = 401;
          const errorMessage = `Unauthorized.`;
          return res.status(errorStatus).json({ message: errorMessage });
        }

        /** Add custom metadata to track formio submissions from wrapper. */
        submission.metadata = {
          ...submission.metadata,
          ...formioCsbMetadata,
        };

        axiosFormio(req)
          .put(`${formioApplicationFormUrl}/submission/${mongoId}`, submission)
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
        const logMessage = `User with email '${mail}' attempted to update Application form submission '${mongoId}' when the CSB Application form enrollment period was closed.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 400;
        const errorMessage = `CSB Application form enrollment period is closed.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- get user's Payment Request form submissions from Formio
router.get(
  "/formio-payment-request-submissions",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys } = req;

    const userSubmissionsUrl =
      `${formioPaymentRequestFormUrl}/submission` +
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
  }
);

// --- post a new Payment Request form submission to Formio
router.post(
  "/formio-payment-request-submission",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, body } = req;
    const { mail } = req.user;
    const {
      email,
      title,
      name,
      entity,
      comboKey,
      rebateId,
      applicationReviewItemId,
      applicationFormModified,
    } = body;

    if (!paymentRequestFormOpen) {
      const errorStatus = 400;
      const errorMessage = `CSB Payment Request form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    }

    if (!bapComboKeys.includes(comboKey)) {
      const logMessage = `User with email '${mail}' attempted to post a new Payment Request form submission without a matching BAP combo key.`;
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

    return getBapDataForPaymentRequest(req, applicationReviewItemId)
      .then(({ applicationRecordQuery, busRecordsQuery }) => {
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
        } = applicationRecordQuery[0];

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
            hidden_application_form_modified: applicationFormModified,
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
            ...formioCsbMetadata,
          },
          state: "draft",
        };

        axiosFormio(req)
          .post(`${formioPaymentRequestFormUrl}/submission`, submission)
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
  }
);

// --- get an existing Payment Request form's schema and submission data from Formio
router.get(
  "/formio-payment-request-submission/:rebateId",
  storeBapComboKeys,
  async (req, res) => {
    const { bapComboKeys } = req;
    const { mail } = req.user;
    const { rebateId } = req.params; // CSB Rebate ID (6 digits)

    const matchedPaymentRequestFormSubmissions =
      `${formioPaymentRequestFormUrl}/submission` +
      `?data.hidden_bap_rebate_id=${rebateId}` +
      `&select=_id,data.bap_hidden_entity_combo_key`;

    Promise.all([
      axiosFormio(req).get(matchedPaymentRequestFormSubmissions),
      axiosFormio(req).get(formioPaymentRequestFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submissions, schema]) => {
        const submission = submissions[0];
        const mongoId = submission._id;
        const comboKey = submission.data.bap_hidden_entity_combo_key;

        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to access Payment Request form submission '${rebateId}' that they do not have access to.`;
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
          .get(`${formioPaymentRequestFormUrl}/submission/${mongoId}`)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => {
            return res.json({
              userAccess: true,
              formSchema: { url: formioPaymentRequestFormUrl, json: schema },
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
  }
);

// --- post an update to an existing draft Payment Request form submission to Formio
router.post(
  "/formio-payment-request-submission/:rebateId",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, body } = req;
    const { mail } = req.user;
    const { rebateId } = req.params; // CSB Rebate ID (6 digits)
    const { mongoId, submission } = body;
    const comboKey = submission.data?.bap_hidden_entity_combo_key;
    const formType = "payment-request";

    checkFormSubmissionPeriodAndBapStatus({ formType, mongoId, comboKey, req })
      .then(() => {
        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to update Payment Request form submission '${rebateId}' without a matching BAP combo key.`;
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
          ...formioCsbMetadata,
        };

        axiosFormio(req)
          .put(
            `${formioPaymentRequestFormUrl}/submission/${mongoId}`,
            submission
          )
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
        const logMessage = `User with email '${mail}' attempted to update Payment Request form submission '${rebateId}' when the CSB Payment Request form enrollment period was closed.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 400;
        const errorMessage = `CSB Payment Request form enrollment period is closed.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

// --- delete an existing Payment Request form submission from Formio
router.post(
  "/delete-formio-payment-request-submission",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, body } = req;
    const { mail } = req.user;
    const { mongoId, rebateId, comboKey } = body;

    // verify post data includes one of user's BAP combo keys
    if (!bapComboKeys.includes(comboKey)) {
      const logMessage = `User with email '${mail}' attempted to delete Payment Request form submission '${rebateId}' without a matching BAP combo key.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 401;
      const errorMessage = `Unauthorized.`;
      return res.status(errorStatus).json({ message: errorMessage });
    }

    /**
     * ensure the BAP status of the corresponding Application form submission
     * is "Edits Requested" before deleting the Payment Request form submission
     * from Formio
     */
    getBapFormSubmissionsStatuses(req, req.bapComboKeys)
      .then((submissions) => {
        const application = submissions.find((submission) => {
          return (
            submission.Parent_Rebate_ID__c === rebateId &&
            submission.Record_Type_Name__c === "CSB Funding Request"
          );
        });

        const applicationNeedsEdits =
          application?.Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c ===
          "Edits Requested";

        if (!applicationNeedsEdits) {
          const errorStatus = 400;
          const errorMessage = `Application form submission '${mongoId}' does not need edits.`;
          return res.status(errorStatus).json({ message: errorMessage });
        }

        axiosFormio(req)
          .delete(`${formioPaymentRequestFormUrl}/submission/${mongoId}`)
          .then((axiosRes) => axiosRes.data)
          .then((response) => {
            const logMessage = `User with email '${mail}' successfully deleted Payment Request form submission '${rebateId}'.`;
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
  }
);

// --- get user's Close Out form submissions from Formio
router.get("/formio-close-out-submissions", storeBapComboKeys, (req, res) => {
  const { bapComboKeys } = req;

  const userSubmissionsUrl =
    `${formioCloseOutFormUrl}/submission` +
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

// --- post a new Close Out form submission to Formio
router.post("/formio-close-out-submission", storeBapComboKeys, (req, res) => {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const {
    email,
    title,
    name,
    entity,
    comboKey,
    rebateId,
    applicationReviewItemId,
    paymentRequestReviewItemId,
    paymentRequestFormModified,
  } = body;

  if (!closeOutFormOpen) {
    const errorStatus = 400;
    const errorMessage = `CSB Close Out form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage = `User with email '${mail}' attempted to post a new Close Out form submission without a matching BAP combo key.`;
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

  return getBapDataForCloseOut(
    req,
    applicationReviewItemId,
    paymentRequestReviewItemId
  )
    .then(
      ({
        applicationRecordQuery,
        paymentRequestRecordQuery,
        busRecordsQuery,
      }) => {
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
        } = applicationRecordQuery[0];

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
        } = paymentRequestRecordQuery[0];

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
            hidden_prf_modified: paymentRequestFormModified,
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
            ...formioCsbMetadata,
          },
          state: "draft",
        };

        axiosFormio(req)
          .post(`${formioCloseOutFormUrl}/submission`, submission)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => res.json(submission))
          .catch((error) => {
            // NOTE: logged in axiosFormio response interceptor
            const errorStatus = error.response?.status || 500;
            const errorMessage = `Error posting Formio Close Out form submission.`;
            return res.status(errorStatus).json({ message: errorMessage });
          });
      }
    )
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting data for a new Close Out form submission from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

// --- get an existing Close Out form's schema and submission data from Formio
router.get(
  "/formio-close-out-submission/:rebateId",
  storeBapComboKeys,
  async (req, res) => {
    const { bapComboKeys } = req;
    const { mail } = req.user;
    const { rebateId } = req.params; // CSB Rebate ID (6 digits)

    const matchedCloseOutFormSubmissions =
      `${formioCloseOutFormUrl}/submission` +
      `?data.hidden_bap_rebate_id=${rebateId}` +
      `&select=_id,data.bap_hidden_entity_combo_key`;

    Promise.all([
      axiosFormio(req).get(matchedCloseOutFormSubmissions),
      axiosFormio(req).get(formioCloseOutFormUrl),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submissions, schema]) => {
        const submission = submissions[0];
        const mongoId = submission._id;
        const comboKey = submission.data.bap_hidden_entity_combo_key;

        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to access Close Out form submission '${rebateId}' that they do not have access to.`;
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
          .get(`${formioCloseOutFormUrl}/submission/${mongoId}`)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => {
            return res.json({
              userAccess: true,
              formSchema: { url: formioCloseOutFormUrl, json: schema },
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
  }
);

// --- post an update to an existing draft Close Out form submission to Formio
router.post(
  "/formio-close-out-submission/:rebateId",
  storeBapComboKeys,
  (req, res) => {
    const { bapComboKeys, body } = req;
    const { mail } = req.user;
    const { rebateId } = req.params; // CSB Rebate ID (6 digits)
    const { mongoId, submission } = body;
    const comboKey = submission.data?.bap_hidden_entity_combo_key;
    const formType = "close-out";

    checkFormSubmissionPeriodAndBapStatus({ formType, mongoId, comboKey, req })
      .then(() => {
        if (!bapComboKeys.includes(comboKey)) {
          const logMessage = `User with email '${mail}' attempted to update Close Out form submission '${rebateId}' without a matching BAP combo key.`;
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
          ...formioCsbMetadata,
        };

        axiosFormio(req)
          .put(`${formioCloseOutFormUrl}/submission/${mongoId}`, submission)
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
        const logMessage = `User with email '${mail}' attempted to update Close Out form submission '${rebateId}' when the CSB Close Out form enrollment period was closed.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 400;
        const errorMessage = `CSB Close Out form enrollment period is closed.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
);

module.exports = router;
