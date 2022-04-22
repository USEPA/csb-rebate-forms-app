const log4js = require("log4js");

log4js.configure({
  appenders: {
    stdout: { type: "stdout", layout: { type: "pattern", pattern: "%p - %m" } },
    stdoutFilter: {
      type: "logLevelFilter",
      appender: "stdout",
      level: "TRACE",
      maxLevel: "WARN",
    },
    stderr: { type: "stderr", layout: { type: "pattern", pattern: "%p - %m" } },
    stderrFilter: {
      type: "logLevelFilter",
      appender: "stderr",
      level: "ERROR",
      maxLevel: "FATAL",
    },
  },
  categories: {
    default: { appenders: ["stderrFilter", "stdoutFilter"], level: "all" },
  },
});

const logger = log4js.getLogger();

if (process.env.LOGGER_LEVEL)
  logger.level = process.env.LOGGER_LEVEL.toUpperCase();
else logger.level = "INFO"; //default level

logger.info("LOGGER_LEVEL = " + logger.level);

const log = ({ level, message, req, otherInfo }) => {
  if (!req) {
    // If request is not passed, log as normal message without metadata
    logger.log(level, message);
  } else {
    // Log as JSON object with message and metadata (build metadata using request object)
    logger.log(
      level,
      JSON.stringify({
        app_metadata: populateMetadataObjFromRequest(req),
        app_message: message,
        app_otherinfo: otherInfo,
      })
    );
  }
};

// We use this function to pull out important HTTP information from the
// request for logging/auditing purposes.
// See https://docs.cloudfoundry.org/concepts/http-routing.html#http-headers
const populateMetadataObjFromRequest = function (request) {
  return {
    b3: request.headers["b3"],
    x_b3_traceid: request.headers["x-b3-traceid"],
    x_b3_spanid: request.headers["x-b3-spanid"],
    x_b3_parentspanid: request.headers["x_b3_parentspanid"],
  };
};

module.exports = log;
