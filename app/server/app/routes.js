const express = require("express");

const router = express.Router();

router.use((req, res, next) => {
  // TODO: apply any route specific middleware here as needed
  next();
});

router.get("/api/v1/login", (req, res, next) => {
  // throw new Error("TODO: implement EPA gateway integration");
  res.json({
    firstName: "George",
    lastName: "Washington",
    email: "george.washington@epa.gov",
  });
});

router.get("/api/v1/logout", (req, res, next) => {
  // throw new Error("TODO: implement EPA gateway integration");
  res.sendStatus(200);
});

router.get("/api/v1/bap", (req, res, next) => {
  // throw new Error("TODO: implement BAP API integration");
  res.json([
    { uei: "056143447853" },
    { uei: "779442964145" },
    { uei: "960885252143" },
    { uei: "549203627426" },
    { uei: "569160091719" },
  ]);
});

router.get("/api/v1/form-schema", (req, res, next) => {
  // throw new Error("TODO: implement Forms.gov integration");
  res.json({ schema: "TODO" });
});

router.post("/api/v1/form-submissions", (req, res, next) => {
  // throw new Error("TODO: implement Forms.gov integration");
  console.log(req.body);
  res.json([
    { uei: "779442964145", name: "Form One" },
    { uei: "779442964145", name: "Form Two" },
    { uei: "960885252143", name: "Form Three" },
  ]);
});

router.get("/status", (req, res, next) => {
  res.json({ running: true });
});

module.exports = router;
