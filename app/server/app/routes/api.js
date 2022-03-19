const express = require("express");
const axios = require("axios");
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const fetchOptions = { headers: { "x-token": process.env.FORMIO_API_KEY } };

router.get("/user", ensureAuthenticated, function (req, res) {
  res.json(req.user);
});

router.get("/login", (req, res, next) => {
  // throw new Error("TODO: implement EPA gateway integration");
  res.json({
    firstName: "George",
    lastName: "Washington",
    email: "george.washington@epa.gov",
  });
});

router.get("/logout", (req, res, next) => {
  // throw new Error("TODO: implement EPA gateway integration");
  res.sendStatus(200);
});

router.get("/bap", (req, res, next) => {
  // throw new Error("TODO: implement BAP API integration");
  res.json([
    { uei: "056143447853" },
    { uei: "779442964145" },
    { uei: "960885252143" },
    { uei: "549203627426" },
    { uei: "569160091719" },
  ]);
});

// TODO: re-add `ensureAuthenticated` middleware – removing for initial testing
router.get("/rebate-form-submissions", (req, res) => {
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
      console.error(err);
      const message = `Error retrieving Forms.gov submissions: ${err.response.statusText}`;
      return res.status(err.response.status || 500).json({ message });
    });
});

// TODO: re-add `ensureAuthenticated` middleware – removing for initial testing
router.get("/rebate-form-submission/:id", (req, res) => {
  axios
    .get(
      `${formioProjectUrl}/${formioFormId}/submission/${req.params.id}`,
      fetchOptions
    )
    .then((res) => res.data)
    .then((submission) => {
      axios
        .get(`${formioProjectUrl}/form/${submission.form}`, fetchOptions)
        .then((res) => res.data)
        .then((schema) => {
          res.json({
            jsonSchema: schema,
            submissionData: submission.data,
          });
        });
    })
    .catch((err) => {
      console.error(err);
      const message = `Error retrieving Forms.gov submission: ${err.response.statusText}`;
      res.status(err.response.status || 500).json({ message });
    });
});

module.exports = router;
