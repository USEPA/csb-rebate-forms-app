require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const routes = require("./routes.js");

const app = express();
const port = process.env.PORT || 3001;

app.disable("x-powered-by");

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(morgan("dev"));

app.use(express.static(path.join(__dirname, "app", "public")));

app.use("/", routes);

app.get("*", (req, res, next) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
