const log = require("./logger");

const errorHandler = (err, req, res, next) => {
  const message = typeof err.toString === "function" ? err.toString() : err;
  log({ level: "error", message, req });
  // If user was trying to log in and an error occurred, return them back to front-end login page to display a message
  if (req.originalUrl.includes("/login")) {
    return res.redirect(
      `${process.env.CLIENT_URL || process.env.SERVER_URL}/welcome?error=saml`
    );
  }
  // For API errors, return error message in JSON format
  if (req.originalUrl.includes("/api")) {
    return res.status(err?.response?.status || 500).json({
      message:
        "An unknown server error occurred. Please try again or contact support.",
    });
  }
  // For non-login non-API errors, redirect back to front-end base route
  return res.redirect(`${process.env.CLIENT_URL || process.env.SERVER_URL}/`);
};

module.exports = errorHandler;
