const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const { axiosFormio, formioProjectUrl } = require("../config/formio");
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

router.use(ensureAuthenticated);

// --- Download a PDF of a submission
router.get("/:formId/:mongoId", (req, res) => {
  const { formId, mongoId } = req.params;

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(formId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${formId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(formioProjectUrl)
    .then((axiosRes) => axiosRes.data)
    .then((project) => {
      const headers = {
        "x-allow": `GET:/project/${project._id}/form/${formId}/submission/${mongoId}/download`,
        "x-expire": 3600,
      };

      axiosFormio(req)
        .get(`${formioProjectUrl}/token`, { headers })
        .then((axiosRes) => axiosRes.data)
        .then((json) => {
          const url = `${formioProjectUrl}/form/${formId}/submission/${mongoId}/download?token=${json.key}`;

          axiosFormio(req)
            .get(url, { responseType: "arraybuffer" })
            .then((axiosRes) => axiosRes.data)
            .then((fileData) => {
              const base64String = Buffer.from(fileData).toString("base64");
              res.attachment(`${mongoId}.pdf`);
              res.type("application/pdf");
              res.send(base64String);
            })
            .catch((error) => {
              // NOTE: error is logged in axiosFormio response interceptor
              const errorStatus = error.response?.status || 500;
              const errorMessage = `Error getting Formio submission PDF.`;
              return res.status(errorStatus).json({ message: errorMessage });
            });
        })
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error getting Formio download token.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio project data.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
});

module.exports = router;
