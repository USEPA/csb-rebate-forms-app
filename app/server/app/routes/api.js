const express = require("express");
const axios = require("axios");
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const fetchOptions = { headers: { "x-token": process.env.FORMIO_API_KEY } };

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

router.get("/rebate-form-submissions", ensureAuthenticated, (req, res) => {
  // TODO: pull UEIs from JWT, and store in an `ueis` array, for building up
  // `query` string, which is appended to the `url` string

  // const query = ueis.join("&data.uei=");
  // const url = `${formioBaseUrl}/submission?data.uei=${query}`;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission`, fetchOptions)
    .then((res) => res.data)
    .then((submissions) => {
      return submissions.map((sub) => {
        const { _id, _fid, form, project, created, modified, data } = sub;
        return {
          // --- metadata fields ---
          _id,
          _fid,
          form,
          project,
          created,
          modified,
          // --- form fields ---
          uei: "(TODO)", // TODO: ensure these fields are in the form
          entityName: data.name,
          applicationName: "(TODO)",
          lastUpdatedBy: "(TODO)",
        };
      });
    })
    .then((submissions) => res.json(submissions))
    .catch((err) => {
      if (typeof err.toJSON === "function") {
        console.error(err.toJSON());
      }

      res
        .status(err?.response?.status || 500)
        .json({ message: "Error fetching Forms.gov submissions" });
    });
});

router.get("/rebate-form-submission/:id", ensureAuthenticated, (req, res) => {
  const id = req.params.id;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission/${id}`, fetchOptions)
    .then((res) => res.data)
    .then((submission) => {
      axios
        .get(`${formioProjectUrl}/form/${submission.form}`, fetchOptions)
        .then((res) => res.data)
        .then((schema) => {
          res.json({
            jsonSchema: schema,
            submissionData: submission,
          });
        });
    })
    .catch((err) => {
      if (typeof err.toJSON === "function") {
        console.error(err.toJSON());
      }

      res
        .status(err?.response?.status || 500)
        .json({ message: `Error fetching Forms.gov submission ${id}` });
    });
});

module.exports = router;
