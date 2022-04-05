const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default;
const jsforce = require("jsforce");
// ---
const { ensureAuthenticated } = require("../middleware");
const logger = require("../utilities/logger");

const log = logger.logger;

const router = express.Router();

const s3Bucket = process.env.S3_PUBLIC_BUCKET;
const s3Region = process.env.S3_PUBLIC_REGION;

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const formioHeaders = { headers: { "x-token": formioApiKey } };

function getSamData(email) {
  const conn = new jsforce.Connection({
    oauth2: {
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
          log.error(err);
          throw err;
        });
    })
    .catch((err) => {
      log.error(err);
      throw err;
    });
}

router.use(ensureAuthenticated);

router.get("/epa-data", (req, res) => {
  // Explicitly return only required attributes from user info
  res.json({
    mail: req.user.mail,
    memberof: req.user.memberof,
    exp: req.user.exp,
  });
});

router.get("/sam-data", (req, res) => {
  getSamData(req.user.mail)
    .then((samUserData) => {
      // First check if user has at least one associated UEI before completing login process
      if (samUserData && samUserData.length === 0) {
        log.error(
          `User ${req.user.mail} tried to use app without any associated SAM records`
        );

        return res.json({
          results: false,
          records: [],
        });
      }

      res.json({
        results: true,
        records: samUserData,
      });
    })
    .catch((err) => {
      log.error(err);
      res.status(401).json({ message: "Error getting SAM.gov data" });
    });
});

// TODO: Add log info when admin/helpdesk changes submission back to draft

router.get("/content", (req, res) => {
  // NOTE: static content files found in `app/server/app/config/` directory
  const filenames = [
    "all-rebate-forms-intro.md",
    "all-rebate-forms-outro.md",
    "new-rebate-form-intro.md",
    "new-rebate-form-dialog.md",
    "existing-draft-rebate-form-intro.md",
    "existing-submitted-rebate-form-intro.md",
  ];

  const s3BucketUrl = `https://${s3Bucket}.s3-${s3Region}.amazonaws.com`;

  Promise.all(
    filenames.map((filename) => {
      // local development: read files directly from disk
      // production: fetch files from the public s3 bucket
      return process.env.NODE_ENV === "development"
        ? readFile(resolve(__dirname, "../content", filename), "utf8")
        : axios.get(`${s3BucketUrl}/content/${filename}`);
    })
  )
    .then((stringsOrResponses) => {
      // local development: no further processing of strings needed
      // production: get data from responses
      return process.env.NODE_ENV === "development"
        ? stringsOrResponses
        : stringsOrResponses.map((axiosRes) => axiosRes.data);
    })
    .then((data) => {
      res.json({
        allRebateFormsIntro: data[0],
        allRebateFormsOutro: data[1],
        newRebateFormIntro: data[2],
        newRebateFormDialog: data[3],
        existingDraftRebateFormIntro: data[4],
        existingSubmittedRebateFormIntro: data[5],
      });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting static content from S3 bucket" });
    });
});

router.get("/rebate-form-schema", (req, res) => {
  axios
    .get(`${formioProjectUrl}/${formioFormId}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((schema) =>
      res.json({
        url: `${formioProjectUrl}/${formioFormId}`,
        json: schema,
      })
    )
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting Forms.gov rebate form schema" });
    });
});

router.post("/rebate-form-submission", (req, res) => {
  axios
    .post(
      `${formioProjectUrl}/${formioFormId}/submission`,
      req.body,
      formioHeaders
    )
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error posting Forms.gov rebate form submission" });
    });
});

router.get("/rebate-form-submissions", (req, res) => {
  // TODO: pull UEIs from JWT, and store in an `ueis` array, for building up
  // `query` string, which is appended to the `url` string

  // const query = ueis.join("&data.uei=");
  // const url = `${formioBaseUrl}/submission?data.uei=${query}`;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => {
      return submissions.map((submission) => {
        const { _id, _fid, form, project, state, created, modified, data } =
          submission;

        return {
          // --- metadata fields ---
          _id,
          _fid,
          form,
          project,
          created,
          // --- form fields ---
          formType: "Application",
          uei: data.applicantUEI,
          eft: data.applicantEfti,
          applicant: data.applicantOrganizationName,
          schoolDistrict: data.schoolDistrictName,
          lastUpdatedBy: data.last_updated_by,
          lastUpdatedDatetime: modified,
          status: state,
        };
      });
    })
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting Forms.gov rebate form submissions" });
    });
});

router.post("/rebate-form-submission/:id", (req, res) => {
  const id = req.params.id;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission/${id}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      axios
        .get(`${formioProjectUrl}/form/${submission.form}`, formioHeaders)
        .then((axiosRes) => axiosRes.data)
        .then((schema) => {
          const { bap_hidden_entity_combo_key } = submission.data;

          // TODO: swap out if (false) for if statement below once form has been
          // updated to include "bap_hidden_entity_combo_key"

          // if (!req.body.bapComboKeys.includes(bap_hidden_entity_combo_key)) {
          if (false) {
            res.json({
              userAccess: false,
              formSchema: null,
              submissionData: null,
            });
          } else {
            res.json({
              userAccess: true,
              formSchema: {
                url: `${formioProjectUrl}/form/${submission.form}`,
                json: schema,
              },
              submissionData: submission,
            });
          }
        });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res.status(error?.response?.status || 500).json({
        message: `Error getting Forms.gov rebate form submission ${id}`,
      });
    });
});

module.exports = router;
