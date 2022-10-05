const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default;
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formioApplicationFormPath,
  formioPaymentRequestFormPath,
  formioCsbMetadata,
} = require("../config/formio");
const {
  ensureAuthenticated,
  ensureHelpdesk,
  storeBapComboKeys,
  verifyMongoObjectId,
} = require("../middleware");
const {
  getSamEntities,
  getApplicationSubmissionsStatuses,
  getApplicationSubmission,
} = require("../utilities/bap");
const log = require("../utilities/logger");

const enrollmentClosed = process.env.CSB_ENROLLMENT_PERIOD !== "open";

const applicationFormApiPath = `${formioProjectUrl}/${formioApplicationFormPath}`;
const paymentRequestFormApiPath = `${formioProjectUrl}/${formioPaymentRequestFormPath}`;

/**
 * Returns a resolved or rejected promise, depending on if the enrollment period
 * is closed (as set via the `CSB_ENROLLMENT_PERIOD` environment variable), and
 * if the form submission has the status of "Edits Requested" or not (as stored
 * in and returned from the BAP).
 * @param {Object} param
 * @param {string} param.mongoId
 * @param {string} param.comboKey
 * @param {express.Request} param.req
 */
function checkEnrollmentPeriodAndBapStatus({ mongoId, comboKey, req }) {
  // continue if enrollment isn't closed
  if (!enrollmentClosed) {
    return Promise.resolve();
  }
  // else, enrollment is closed, so only continue if edits are requested
  return getApplicationSubmissionsStatuses(req, [comboKey]).then(
    (submissions) => {
      const submission = submissions.find((s) => s.CSB_Form_ID__c === mongoId);
      const status = submission?.Parent_CSB_Rebate__r?.CSB_Rebate_Status__c;
      return status === "Edits Requested"
        ? Promise.resolve()
        : Promise.reject();
    }
  );
}

const router = express.Router();

// --- get static content from S3
router.get("/content", (req, res) => {
  const s3Bucket = process.env.S3_PUBLIC_BUCKET;
  const s3Region = process.env.S3_PUBLIC_REGION;

  // NOTE: static content files found in `app/server/app/content/` directory
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
  ];

  const s3BucketUrl = `https://${s3Bucket}.s3-${s3Region}.amazonaws.com`;

  Promise.all(
    filenames.map((filename) => {
      // local development: read files directly from disk
      // Cloud.gov: fetch files from the public s3 bucket
      return process.env.NODE_ENV === "development"
        ? readFile(resolve(__dirname, "../content", filename), "utf8")
        : axios.get(`${s3BucketUrl}/content/${filename}`);
    })
  )
    .then((stringsOrResponses) => {
      // local development: no further processing of strings needed
      // Cloud.gov: get data from responses
      return process.env.NODE_ENV === "development"
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
      });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        log({ level: "debug", message: error.toJSON(), req });
      }

      const errorStatus = error.response?.status;
      const errorMethod = error.response?.config?.method?.toUpperCase();
      const errorUrl = error.response?.config?.url;
      const message = `S3 Error: ${errorStatus} ${errorMethod} ${errorUrl}`;
      log({ level: "error", message, req });

      return res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting static content from S3 bucket" });
    });
});

router.use(ensureAuthenticated);

// --- verification used to check if user has access to the /helpdesk route (using ensureHelpdesk middleware)
router.get("/helpdesk-access", ensureHelpdesk, (req, res) => {
  res.sendStatus(200);
});

// --- get CSB app specific data (open enrollment status, etc.)
router.get("/csb-data", (req, res) => {
  return res.json({ enrollmentClosed });
});

// --- get user data from EPA Gateway/Login.gov
router.get("/epa-user-data", (req, res) => {
  const { mail, memberof, exp } = req.user;
  return res.json({ mail, memberof, exp });
});

// --- get user's SAM.gov data from EPA's Business Automation Platform (BAP)
router.get("/bap-sam-data", (req, res) => {
  getSamEntities(req, req.user.mail)
    .then((entities) => {
      // NOTE: allow admin or helpdesk users access to the app, even without SAM.gov data
      const userRoles = req.user.memberof.split(",");
      const helpdeskUser =
        userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk");

      if (!helpdeskUser && entities?.length === 0) {
        const message = `User with email ${req.user.mail} tried to use app without any associated SAM records.`;
        log({ level: "error", message, req });
        return res.json({ results: false, entities: [] });
      }

      return res.json({ results: true, entities });
    })
    .catch((error) => {
      const message = `Error getting SAM.gov data from BAP`;
      return res.status(401).json({ message });
    });
});

// --- get user's Application form submissions statuses from EPA's BAP
router.get("/bap-application-submissions", storeBapComboKeys, (req, res) => {
  return getApplicationSubmissionsStatuses(req, req.bapComboKeys)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      const message = `Error getting Application form submissions statuses from BAP`;
      return res.status(401).json({ message });
    });
});

// --- get user's Application form submissions from Forms.gov
router.get("/formio-application-submissions", storeBapComboKeys, (req, res) => {
  // NOTE: Helpdesk users might not have any SAM.gov records associated with
  // their email address so we should not return any submissions to those users.
  // The only reason we explicitly need to do this is because there could be
  // some submissions without `bap_hidden_entity_combo_key` field values in the
  // Forms.gov database – that will never be the case for submissions created
  // from this app, but there could be submissions created externally if someone
  // is testing posting data (e.g. from a REST client, or the Formio Viewer)
  if (req.bapComboKeys.length === 0) return res.json([]);

  const userSubmissionsUrl =
    `${applicationFormApiPath}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `&data.bap_hidden_entity_combo_key=` +
    `${req.bapComboKeys.join("&data.bap_hidden_entity_combo_key=")}` +
    `&select=_id,state,modified,` +
    `data.last_updated_by,` +
    `data.bap_hidden_entity_combo_key,` +
    `data.applicantUEI,` +
    `data.applicantEfti,` +
    `data.applicantEfti_display,` +
    `data.applicantOrganizationName,` +
    `data.schoolDistrictName`;

  axiosFormio(req)
    .get(userSubmissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      const message = `Error getting Forms.gov Application form submissions`;
      return res.status(error?.response?.status || 500).json({ message });
    });
});

// --- post a new Application form submission to Forms.gov
router.post("/formio-application-submission", storeBapComboKeys, (req, res) => {
  const comboKey = req.body.data?.bap_hidden_entity_combo_key;

  if (enrollmentClosed) {
    const message = `CSB enrollment period is closed`;
    return res.status(400).json({ message });
  }

  // verify post data includes one of user's BAP combo keys
  if (!req.bapComboKeys.includes(comboKey)) {
    const message = `User with email ${req.user.mail} attempted to post a new Application form without a matching BAP combo key`;
    log({ level: "error", message, req });
    return res.status(401).json({ message: "Unauthorized" });
  }

  // add custom metadata to track formio submissions from wrapper
  req.body.metadata = {
    ...formioCsbMetadata,
  };

  axiosFormio(req)
    .post(`${applicationFormApiPath}/submission`, req.body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      const message = `Error posting Forms.gov Application form submission`;
      return res.status(error?.response?.status || 500).json({ message });
    });
});

// --- get an existing Application form's schema and submission data from Forms.gov
router.get(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { mongoId } = req.params;

    Promise.all([
      axiosFormio(req).get(`${applicationFormApiPath}/submission/${mongoId}`),
      axiosFormio(req).get(applicationFormApiPath),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submission, schema]) => {
        const comboKey = submission.data.bap_hidden_entity_combo_key;

        if (!req.bapComboKeys.includes(comboKey)) {
          const message = `User with email ${req.user.mail} attempted to access Application form submission ${mongoId} that they do not have access to.`;
          log({ level: "warn", message, req });
          return res.json({
            userAccess: false,
            formSchema: null,
            submission: null,
          });
        }

        return res.json({
          userAccess: true,
          formSchema: { url: applicationFormApiPath, json: schema },
          submission,
        });
      })
      .catch((error) => {
        const message = `Error getting Forms.gov Application form submission ${mongoId}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }
);

// --- post an update to an existing draft Application form submission to Forms.gov
router.post(
  "/formio-application-submission/:mongoId",
  verifyMongoObjectId,
  storeBapComboKeys,
  (req, res) => {
    const { mongoId } = req.params;
    const comboKey = req.body.data?.bap_hidden_entity_combo_key;

    checkEnrollmentPeriodAndBapStatus({ mongoId, comboKey, req })
      .then(() => {
        // verify post data includes one of user's BAP combo keys
        if (!req.bapComboKeys.includes(comboKey)) {
          const message = `User with email ${req.user.mail} attempted to update existing Application form without a matching BAP combo key`;
          log({ level: "error", message, req });
          return res.status(401).json({ message: "Unauthorized" });
        }

        // add custom metadata to track formio submissions from wrapper
        req.body.metadata = {
          ...req.body.metadata,
          ...formioCsbMetadata,
        };

        axiosFormio(req)
          .put(`${applicationFormApiPath}/submission/${mongoId}`, req.body)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => res.json(submission))
          .catch((error) => {
            const message = `Error updating Forms.gov Application form submission`;
            return res.status(error?.response?.status || 500).json({ message });
          });
      })
      .catch((error) => {
        const message = `CSB enrollment period is closed`;
        return res.status(400).json({ message });
      });
  }
);

// --- upload s3 file metadata to Forms.gov
router.post("/:mongoId/:comboKey/storage/s3", storeBapComboKeys, (req, res) => {
  const { mongoId, comboKey } = req.params;

  checkEnrollmentPeriodAndBapStatus({ mongoId, comboKey, req })
    .then(() => {
      if (!req.bapComboKeys.includes(comboKey)) {
        const message = `User with email ${req.user.mail} attempted to upload file without a matching BAP combo key`;
        log({ level: "error", message, req });
        return res.status(401).json({ message: "Unauthorized" });
      }

      axiosFormio(req)
        .post(`${applicationFormApiPath}/storage/s3`, req.body)
        .then((axiosRes) => axiosRes.data)
        .then((fileMetadata) => res.json(fileMetadata))
        .catch((error) => {
          const message = `Error uploading Forms.gov file`;
          return res.status(error?.response?.status || 500).json({ message });
        });
    })
    .catch((error) => {
      const message = `CSB enrollment period is closed`;
      return res.status(400).json({ message });
    });
});

// --- download s3 file metadata from Forms.gov
router.get("/:mongoId/:comboKey/storage/s3", storeBapComboKeys, (req, res) => {
  const { comboKey } = req.params;

  if (!req.bapComboKeys.includes(comboKey)) {
    const message = `User with email ${req.user.mail} attempted to download file without a matching BAP combo key`;
    log({ level: "error", message, req });
    return res.status(401).json({ message: "Unauthorized" });
  }

  axiosFormio(req)
    .get(`${applicationFormApiPath}/storage/s3`, { params: req.query })
    .then((axiosRes) => axiosRes.data)
    .then((fileMetadata) => res.json(fileMetadata))
    .catch((error) => {
      const message = `Error downloading Forms.gov file`;
      return res.status(error?.response?.status || 500).json({ message });
    });
});

// --- get user's Payment Request form submissions from Forms.gov
router.get(
  "/formio-payment-request-submissions",
  storeBapComboKeys,
  (req, res) => {
    const userSubmissionsUrl =
      `${paymentRequestFormApiPath}/submission` +
      `?sort=-modified` +
      `&limit=1000000` +
      `&data.bap_hidden_entity_combo_key=${req.bapComboKeys.join(
        "&data.bap_hidden_entity_combo_key="
      )}`;

    axiosFormio(req)
      .get(userSubmissionsUrl)
      .then((axiosRes) => axiosRes.data)
      .then((submissions) => res.json(submissions))
      .catch((error) => {
        const message = `Error getting Forms.gov Payment Request form submissions`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }
);

// --- post a new Payment Request form submission to Forms.gov
router.post(
  "/formio-payment-request-submission",
  storeBapComboKeys,
  (req, res) => {
    const { email, title, name, comboKey, rebateId, reviewItemId } = req.body;

    // verify post data includes one of user's BAP combo keys
    if (!req.bapComboKeys.includes(comboKey)) {
      const message = `User with email ${req.user.mail} attempted to post a new Payment Request form without a matching BAP combo key`;
      log({ level: "error", message, req });
      return res.status(401).json({ message: "Unauthorized" });
    }

    return getApplicationSubmission(req, reviewItemId)
      .then(({ formsTableRecordQuery, busTableRecordsQuery }) => {
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
        } = formsTableRecordQuery[0];

        const busInfo = busTableRecordsQuery.map((record) => ({
          busNum: record.Rebate_Item_num__c,
          oldBusNcesDistrictId: CSB_NCES_ID__c,
          oldBusVin: record.CSB_VIN__c,
          oldBusModelYear: record.CSB_Model_Year__c,
          oldBusFuelType: record.CSB_Fuel_Type__c,
          newBusFuelType: record.CSB_Replacement_Fuel_Type__c,
          hidden_bap_max_rebate: record.CSB_Funds_Requested__c,
        }));

        // NOTE: `purchaseOrders` is initialized as an empty array to fix some
        // issue with the field being changed to an object when the form loads
        const newSubmission = {
          data: {
            hidden_current_user_email: email,
            hidden_current_user_title: title,
            hidden_current_user_name: name,
            bap_hidden_entity_combo_key: comboKey,
            hidden_bap_rebate_id: rebateId,
            hidden_bap_district_id: CSB_NCES_ID__c,
            hidden_bap_primary_name: Primary_Applicant__r?.Name,
            hidden_bap_primary_title: Primary_Applicant__r?.Title,
            hidden_bap_primary_phone_number: Primary_Applicant__r?.Phone,
            hidden_bap_primary_email: Primary_Applicant__r?.Email,
            hidden_bap_alternate_name: Alternate_Applicant__r?.Name || "",
            hidden_bap_alternate_title: Alternate_Applicant__r?.Title || "",
            hidden_bap_alternate_phone_number:
              Alternate_Applicant__r?.Phone || "",
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
          // add custom metadata to track formio submissions from wrapper
          metadata: {
            ...formioCsbMetadata,
          },
          state: "draft",
        };

        axiosFormio(req)
          .post(`${paymentRequestFormApiPath}/submission`, newSubmission)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => res.json(submission))
          .catch((error) => {
            const message = `Error posting Forms.gov Payment Request form submission`;
            return res.status(error?.response?.status || 500).json({ message });
          });
      })
      .catch((error) => {
        const message = `Error getting Application form submission from BAP`;
        return res.status(401).json({ message });
      });
  }
);

// --- get an existing Payment Request form's schema and submission data from Forms.gov
router.get(
  "/formio-payment-request-submission/:rebateId",
  storeBapComboKeys,
  async (req, res) => {
    const { rebateId } = req.params; // CSB Rebate ID (6 digits)

    const matchedPaymentRequestFormSubmissions =
      `${paymentRequestFormApiPath}/submission` +
      `?data.hidden_bap_rebate_id=${rebateId}` +
      `&select=_id,data.bap_hidden_entity_combo_key`;

    Promise.all([
      axiosFormio(req).get(matchedPaymentRequestFormSubmissions),
      axiosFormio(req).get(paymentRequestFormApiPath),
    ])
      .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
      .then(([submissions, schema]) => {
        const submission = submissions[0];
        const mongoId = submission._id;
        const comboKey = submission.data.bap_hidden_entity_combo_key;

        if (!req.bapComboKeys.includes(comboKey)) {
          const message = `User with email ${req.user.mail} attempted to access Payment Request form submission ${rebateId} that they do not have access to.`;
          log({ level: "warn", message, req });
          return res.json({
            userAccess: false,
            formSchema: null,
            submission: null,
          });
        }

        // NOTE: verifyMongoObjectId middleware content:
        if (mongoId && !ObjectId.isValid(mongoId)) {
          const message = `MongoDB ObjectId validation error for: ${mongoId}`;
          return res.status(400).json({ message });
        }

        // NOTE: We can't just use the returned submission data here because
        // Formio returns the string literal 'YES' instead of a base64 encoded
        // image string for signature fields when you query for all submissions
        // matching on a field's value (`/submission?data.hidden_bap_rebate_id=${rebateId}`).
        // We need to query for a specific submission (e.g. `/submission/${mongoId}`),
        // to have Formio return the correct signature field data.
        axiosFormio(req)
          .get(`${paymentRequestFormApiPath}/submission/${mongoId}`)
          .then((axiosRes) => axiosRes.data)
          .then((submission) => {
            return res.json({
              userAccess: true,
              formSchema: { url: paymentRequestFormApiPath, json: schema },
              submission,
            });
          });
      })
      .catch((error) => {
        const message = `Error getting Forms.gov Payment Request form submission ${rebateId}`;
        res.status(error?.response?.status || 500).json({ message });
      });
  }
);

// --- post an update to an existing draft Payment Request form submission to Forms.gov
router.post(
  "/formio-payment-request-submission/:rebateId",
  storeBapComboKeys,
  (req, res) => {
    const { mongoId, submission } = req.body;
    const comboKey = submission.data?.bap_hidden_entity_combo_key;

    // verify post data includes one of user's BAP combo keys
    if (!req.bapComboKeys.includes(comboKey)) {
      const message = `User with email ${req.user.mail} attempted to update existing Payment Request form without a matching BAP combo key`;
      log({ level: "error", message, req });
      return res.status(401).json({ message: "Unauthorized" });
    }

    // NOTE: verifyMongoObjectId middleware content:
    if (mongoId && !ObjectId.isValid(mongoId)) {
      const message = `MongoDB ObjectId validation error for: ${mongoId}`;
      return res.status(400).json({ message });
    }

    // add custom metadata to track formio submissions from wrapper
    submission.metadata = {
      ...submission.metadata,
      ...formioCsbMetadata,
    };

    axiosFormio(req)
      .put(`${paymentRequestFormApiPath}/submission/${mongoId}`, submission)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        const message = `Error updating Forms.gov Payment Request form submission`;
        return res.status(error?.response?.status || 500).json({ message });
      });
  }
);

module.exports = router;
