const express = require("express");
const { ensureAuthenticated } = require("../middleware");

const router = express.Router();

router.get("/user", ensureAuthenticated, function (req, res) {
  // Call BAP/SAM API for UEI data to add onto user data
  // TODO: Integrate salesforce
  const samUserData = [
    { uei: "056143447853" },
    { uei: "779442964145" },
    { uei: "960885252143" },
    { uei: "549203627426" },
    { uei: "569160091719" },
  ];

  res.json({ epaUserData: req.user, samUserData });
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

// TODO: Add log info when admin/helpdesk changes submission back to draft

router.get("/form-schema", (req, res, next) => {
  // throw new Error("TODO: implement Forms.gov integration");
  res.json({ schema: "TODO" });
});

router.post("/form-submissions", (req, res, next) => {
  // throw new Error("TODO: implement Forms.gov integration");
  console.log(req.body);
  res.json([
    { uei: "779442964145", name: "Form One" },
    { uei: "779442964145", name: "Form Two" },
    { uei: "960885252143", name: "Form Three" },
  ]);
});

module.exports = router;
