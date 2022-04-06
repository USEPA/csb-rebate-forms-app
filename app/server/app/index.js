require("dotenv").config();

const { resolve } = require("node:path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const history = require("connect-history-api-fallback");
const passport = require("passport");
// ---
const errorHandler = require("./utilities/errorHandler");
const logger = require("./utilities/logger");
const samlStrategy = require("./config/samlStrategy");
const { appScan, protectClientRoutes } = require("./middleware");
const routes = require("./routes");

const app = express();
const port = process.env.PORT || 3001;
const log = logger.logger;

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(
  helmet.hsts({
    maxAge: 31536000,
  })
);

const requiredEnvVars = [
  "SERVER_URL",
  "SAML_LOGIN_URL",
  "SAML_LOGOUT_URL",
  "SAML_ENTITY_ID",
  "SAML_IDP_CERT",
  "SAML_PUBLIC_KEY",
  "JWT_PRIVATE_KEY",
  "JWT_PUBLIC_KEY",
  "FORMIO_PROJECT_URL",
  "FORMIO_FORM_ID",
  "FORMIO_API_KEY",
  "S3_PUBLIC_BUCKET",
  "S3_PUBLIC_REGION",
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    log.error(`Required environment variable ${envVar} not found.`);
    process.exitCode = 1;
  }
});

app.disable("x-powered-by");

// Enable CORS and logging with morgan for local development only
// NOTE: process.env.NODE_ENV set to "development" below to match value defined
// in create-react-app when client app is run locally via `npm start`
if (process.env.NODE_ENV === "development") {
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(morgan("dev"));
}

// Apply global middleware on dev/staging in order for scan to receive 200 status on all endpoints
if (
  process.env.CLOUD_SPACE === "development" ||
  process.env.CLOUD_SPACE === "staging"
) {
  app.use(appScan);
}

app.use(express.json({ limit: process.env.JSON_PAYLOAD_LIMIT || "5mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
passport.use("saml", samlStrategy);

// If SERVER_BASE_PATH is provided, serve routes and static files from there (e.g. /csb)
const basePath = `${process.env.SERVER_BASE_PATH || ""}/`;
app.use(basePath, routes);

// Use regex to add trailing slash on static requests (required when using sub path)
const pathRegex = new RegExp(`^\\${process.env.SERVER_BASE_PATH || ""}$`);
app.all(pathRegex, (req, res) => res.redirect(`${basePath}`));

// Ensure user is authenticated on all client-side routes except / and /welcome
app.use(protectClientRoutes);

/*
 * Set up history fallback to provide direct access to react router routes
 * Note: must come AFTER api routes and BEFORE static serve of react files
 */
app.use(basePath, history());

// Serve client app's static built files
// NOTE: client app's `build` directory contents copied into server app's
// `public` directory in CI/CD step
app.use(basePath, express.static(resolve(__dirname, "public")));

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
