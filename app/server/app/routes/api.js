const express = require("express");
const axios = require("axios");
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

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

router.get("/form-schema", ensureAuthenticated, (req, res) => {
  // If "version" is passed in querystring, add to form.io request to get specific version's schema
  let url = process.env.FORMIO_BASE_URL;
  if (req.query.version) {
    url += `/v/${req.query.version}`;
  }
  axios
    .get(url, {
      headers: {
        "x-token": process.env.FORMIO_API_KEY,
      },
    })
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      console.error(error);
      res.status(error.response.status || 500).json({
        message: `There was an error retrieving the Form.io schema: ${error.response.statusText}`,
      });
    });
});

router.get("/form-submissions", ensureAuthenticated, (req, res) => {
  axios
    .get(`${process.env.FORMIO_BASE_URL}/submission`, {
      headers: {
        "x-token": process.env.FORMIO_API_KEY,
      },
      // Pass query params through to form.io, e.g. "?data.applicantName=name"
      params: req.query,
    })
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      console.error(error);
      res.status(error.response.status || 500).json({
        message: `There was an error retrieving Form.io submissions: ${error.response.statusText}`,
      });
    });
});

router.get("/form-submissions/:id", ensureAuthenticated, (req, res) => {
  axios
    .get(`${process.env.FORMIO_BASE_URL}/submission/${req.params.id}`, {
      headers: {
        "x-token": process.env.FORMIO_API_KEY,
      },
    })
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      console.error(error);
      res.status(error.response.status || 500).json({
        message: `There was an error retrieving the Form.io submission: ${error.response.statusText}`,
      });
    });
});

module.exports = router;
