const { resolve } = require("node:path");
const { readFile } = require("node:fs/promises");
const express = require("express");
const axios = require("axios").default;
// ---
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioApiKey = process.env.FORMIO_API_KEY;

const formioHeaders = { headers: { "x-token": formioApiKey } };

router.get("/user", ensureAuthenticated, function (req, res) {
  // samUserData is stored in the req.user object via JWT - map through to clean up fieldnames before returning
  const samUserData = req.user.samUserData.map((samRecord) => ({
    uei: samRecord.UEI__c,
    eft: samRecord.Entity_EFT_Indicator__c,
    cage: samRecord.CAGE_Code__c,
    entityName: samRecord.Name,
  }));

  // req.user includes both epaUserData (object) and samUserData (array)
  res.json({ epaUserData: req.user.epaUserData, samUserData });
});

// TODO: Add log info when admin/helpdesk changes submission back to draft

router.get("/content", ensureAuthenticated, (req, res) => {
  function getContentPath(filename) {
    return resolve(__dirname, "../content", filename);
  }

  const fileNames = [
    "all-rebate-forms-intro.md",
    "all-rebate-forms-outro.md",
    "new-rebate-form-intro.md",
    "new-rebate-form-dialog.md",
    "existing-draft-rebate-form-intro.md",
    "existing-submitted-rebate-form-intro.md",
  ];

  Promise.all(fileNames.map((fname) => readFile(getContentPath(fname), "utf8")))
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
    .catch((error) => console.error(error));
});

router.get("/rebate-form-schema", ensureAuthenticated, (req, res) => {
  axios
    .get(`${formioProjectUrl}/${formioFormId}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((schema) => res.json(schema))
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: "Error getting Forms.gov rebate form schema" });
    });
});

router.post("/rebate-form-submission", ensureAuthenticated, (req, res) => {
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

router.get("/rebate-form-submissions", ensureAuthenticated, (req, res) => {
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
          formType: "Rebate",
          uei: data.applicantUEI,
          eft: "####", // TODO: this needs to be in the form
          ueiEntityName: data.applicantOrganizationName,
          schoolDistrictName: data.ncesName,
          lastUpdatedBy: data.sam_hidden_name,
          lastUpdatedDate: modified,
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

router.get("/rebate-form-submission/:id", ensureAuthenticated, (req, res) => {
  const id = req.params.id;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission/${id}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      axios
        .get(`${formioProjectUrl}/form/${submission.form}`, formioHeaders)
        .then((axiosRes) => axiosRes.data)
        .then((schema) => {
          res.json({
            formSchema: schema,
            submissionData: submission,
          });
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
