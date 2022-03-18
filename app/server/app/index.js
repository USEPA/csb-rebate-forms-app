require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const history = require("connect-history-api-fallback");
const basicAuth = require("express-basic-auth");
const passport = require("passport");
// ---
const logger = require("./utilities/logger");
const log = logger.logger;

const samlStrategy = require("./config/samlStrategy");

const routes = require("./routes");

const app = express();
const port = process.env.PORT || 3001;

const requiredEnvVars = [
  "SERVER_URL",
  "SAML_LOGIN_URL",
  "SAML_LOGOUT_URL",
  "SAML_ENTITY_ID",
  "SAML_IDP_CERT",
  "SAML_PUBLIC_KEY",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "FORMIO_BASE_URL",
  "FORMIO_API_KEY",
];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    log.error(`Required environment variable ${envVar} not found.`);
    process.exit();
  }
});

app.disable("x-powered-by");

// Set up browser basic auth for dev and staging sites
const unauthorizedResponse = (req) => {
  return req.auth ? "Invalid credentials" : "No credentials provided";
};

if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "staging"
) {
  app.use(
    basicAuth({
      users: { [process.env.BASIC_AUTH_USER]: process.env.BASIC_AUTH_PASSWORD },
      challenge: true,
      unauthorizedResponse,
    })
  );
}

if (process.env.NODE_ENV === "local") {
  app.use(cors({ origin: process.env.CLIENT_URL }));
}
app.use(express.json());
app.use(morgan("dev"));

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
passport.use("saml", samlStrategy);

app.use(express.static(path.join(__dirname, "app", "public")));

// If SUB_PATH is provided, server routes and static files from there (e.g. /csb)
const basePath = `${process.env.SUB_PATH || ""}/`;
app.use(basePath, routes);

// Use regex to add trailing slash on static requests (required when using sub path)
const pathRegex = new RegExp(`^\\${process.env.SUB_PATH || ""}$`);
app.all(pathRegex, (req, res) => res.redirect(`${basePath}`));

/*
 * Set up history fallback to provide direct access to react router routes
 * Note: must come AFTER api routes and BEFORE static serve of react files
 */
app.use(basePath, history());

// Serve static react-based front-end from build folder
app.use(basePath, express.static(path.resolve(__dirname, "public/")));

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
