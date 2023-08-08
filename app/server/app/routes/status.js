const express = require("express");
// ---
const { axiosFormio, formUrl } = require("../config/formio");
const { getSamEntities } = require("../utilities/bap");

const router = express.Router();

router.get("/app", (req, res) => {
  return res.json({ status: true });
});

router.get("/bap-sam-data", (req, res) => {
  getSamEntities(req, "bap.sam.data.status@erg.com")
    .then((bapRes) => {
      if (!Array.isArray(bapRes)) {
        throw Error();
      }

      return res.json({ status: true });
    })
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      return res.json({ status: false });
    });
});

router.get("/formio-application-schema", (req, res) => {
  axiosFormio(req)
    .get(formUrl["2022"].frf)
    .then((axiosRes) => axiosRes.data)
    .then((schema) => {
      /**
       * Verify that schema has type of form and a title exists
       * (confirming Formio returned a valid schema).
       */
      return res.json({ status: schema.type === "form" && !!schema.title });
    })
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      return res.json({ status: false });
    });
});

router.get("/formio-payment-request-schema", (req, res) => {
  axiosFormio(req)
    .get(formUrl["2022"].prf)
    .then((axiosRes) => axiosRes.data)
    .then((schema) => {
      /**
       * Verify that schema has type of form and a title exists
       * (confirming Formio returned a valid schema).
       */
      return res.json({ status: schema.type === "form" && !!schema.title });
    })
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      return res.json({ status: false });
    });
});

router.get("/formio-close-out-schema", (req, res) => {
  axiosFormio(req)
    .get(formUrl["2022"].crf)
    .then((axiosRes) => axiosRes.data)
    .then((schema) => {
      /**
       * Verify that schema has type of form and a title exists
       * (confirming Formio returned a valid schema).
       */
      return res.json({ status: schema.type === "form" && !!schema.title });
    })
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      return res.json({ status: false });
    });
});

module.exports = router;
