const express = require("express");
const axios = require("axios").default;
// ---
const {
  formioProjectUrl,
  formioFormId,
  formioHeaders,
} = require("../config/formio");

const router = express.Router();

// --- get an existing rebate form's submission data from Forms.gov
router.get("/rebate-form-submission/:id", (req, res) => {
  const id = req.params.id;

  axios
    .get(`${formioProjectUrl}/${formioFormId}/submission/${id}`, formioHeaders)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      const { state, modified, data } = submission;

      res.json({
        applicant: data.applicantOrganizationName,
        lastUpdatedBy: data.last_updated_by,
        lastUpdatedDatetime: modified,
        status: state,
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
