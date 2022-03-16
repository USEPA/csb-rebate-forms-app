const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const history = require("connect-history-api-fallback");
const passport = require("passport");
// ---
const samlStrategy = require("./config/samlStrategy");

const baseRoutes = require("./routes");
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");

const app = express();
const port = process.env.PORT || 3001;

if (!process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL environment variable not found.");
  process.exit();
}

app.disable("x-powered-by");

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(morgan("dev"));

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
passport.use("saml", samlStrategy);

app.use(express.static(path.join(__dirname, "app", "public")));

app.use("/", baseRoutes);
app.use("/", authRoutes);
app.use("/api/v1", apiRoutes);

/*
 * Set up history fallback to provide direct access to react router routes
 * Note: must come AFTER api routes and BEFORE static serve of react files
 */
app.use(history());

// Serve static react-based front-end from build folder
app.use(express.static(path.resolve(__dirname, "public")));

app.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
