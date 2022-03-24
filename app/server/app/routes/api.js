const express = require("express");
const axios = require("axios").default;
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

const formioProjectUrl = process.env.FORMIO_PROJECT_URL;
const formioFormId = process.env.FORMIO_FORM_ID;
const formioHeaders = { headers: { "x-token": process.env.FORMIO_API_KEY } };

router.get("/user", ensureAuthenticated, function (req, res) {
  // Call BAP/SAM API for UEI data to add onto user data
  // TODO: Integrate salesforce
  const samUserData = [
    {
      uei: "056143447853",
      eft: "436988994",
      cage: "46308",
      entityName: "Metro Buslines",
    },
    {
      uei: "779442964145",
      eft: "398640677",
      cage: "26532",
      entityName: "Highway Logistics, LLC",
    },
    {
      uei: "960885252143",
      eft: "381191934",
      cage: "11877",
      entityName: "Fleet Services, Inc.",
    },
    {
      uei: "549203627426",
      eft: "555409114",
      cage: "25751",
      entityName: "Green Transport",
    },
    {
      uei: "569160091719",
      eft: "330109015",
      cage: "65925",
      entityName: "SmartBus Co.",
    },
  ];

  res.json({
    epaUserData: req.user,
    samUserData,
  });
});

// TODO: Add log info when admin/helpdesk changes submission back to draft

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
        .json({ message: "Error fetching Forms.gov form schema" });
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
          uei: "(TODO)", // 12 digits
          eft: "(TODO)", // 9 digits
          cage: "(TODO)", // 5 dights
          entityName: "(TODO)",
          applicationName: "(TODO)",
          lastUpdatedBy: data.name,
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
        .json({ message: "Error fetching Forms.gov submissions" });
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
            jsonSchema: schema,
            submissionData: submission,
          });
        });
    })
    .catch((error) => {
      if (typeof error.toJSON === "function") {
        console.error(error.toJSON());
      }

      res
        .status(error?.response?.status || 500)
        .json({ message: `Error fetching Forms.gov submission ${id}` });
    });
});

module.exports = router;
