const jsforce = require("jsforce");
const logger = require("../utilities/logger");
const log = logger.logger;

const getSamData = (email) => {
  const conn = new jsforce.Connection({
    oauth2: {
      loginUrl: process.env.BAP_URL,
      clientId: process.env.BAP_CLIENT_ID,
      clientSecret: process.env.BAP_CLIENT_SECRET,
      redirectUri: process.env.SERVER_URL,
    },
  });

  return conn
    .login(process.env.BAP_USER, process.env.BAP_PASSWORD)
    .then(() => {
      // After successful login, query for SAM data
      return conn
        .query(
          `
            SELECT
                ENTITY_COMBO_KEY__c,
                ENTITY_STATUS__c,
                UNIQUE_ENTITY_ID__c,
                ENTITY_EFT_INDICATOR__c,
                CAGE_CODE__c,
                LEGAL_BUSINESS_NAME__c,
                GOVT_BUS_POC_NAME__c,
                GOVT_BUS_POC_EMAIL__c,
                GOVT_BUS_POC_TITLE__c,
                ALT_GOVT_BUS_POC_NAME__c,
                ALT_GOVT_BUS_POC_EMAIL__c,
                ALT_GOVT_BUS_POC_TITLE__c,
                ELEC_BUS_POC_NAME__c,
                ELEC_BUS_POC_EMAIL__c,
                ELEC_BUS_POC_TITLE__c,
                ALT_ELEC_BUS_POC_NAME__c,
                ALT_ELEC_BUS_POC_EMAIL__c,
                ALT_ELEC_BUS_POC_TITLE__c,
                PHYSICAL_ADDRESS_LINE_1__c,
                PHYSICAL_ADDRESS_LINE_2__c,
                PHYSICAL_ADDRESS_CITY__c,
                PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
                PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
                PHYSICAL_ADDRESS_ZIP_CODE_4__c
            FROM ${process.env.BAP_TABLE}
            WHERE
                ALT_ELEC_BUS_POC_EMAIL__c = '${email}' or
                GOVT_BUS_POC_EMAIL__c = '${email}' or
                ALT_GOVT_BUS_POC_EMAIL__c = '${email}' or
                ELEC_BUS_POC_EMAIL__c = '${email}'
          `
        )
        .then((res) => {
          return res.records;
        })
        .catch((err) => {
          log.error(err);
          throw err;
        });
    })
    .catch((err) => {
      log.error(err);
      throw err;
    });
};

module.exports = getSamData;
