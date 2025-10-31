const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formioProjectUrl,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
  formioExampleVin,
  formioExampleMongoId,
  formioExampleRebateId,
  formioExampleComboKey,
  formioNoUserAccess,
} = require("../config/formio");
const {
  getBapFormSubmissionsStatuses,
  getBapDataFor2022PRF,
  getBapDataFor2023PRF,
  getBapDataFor2024PRF,
  getBapDataFor2022CRF,
  getBapDataFor2023CRF,
  getCSBRebateContacts,
  checkForVinDuplicates,
  checkFormSubmissionPeriodAndBapStatus,
} = require("../utilities/bap");
const { checkUserData } = require("../utilities/user");
const log = require("../utilities/logger");

const { NODE_ENV } = process.env;

/**
 * @typedef {'2022' | '2023' | '2024'} RebateYear
 */

/**
 * Stores data fields used in the dashboard table for each form by rebate year.
 */
const formDataFieldNames = {
  2022: {
    frf: [
      "bap_hidden_entity_combo_key",
      "applicantUEI",
      "applicantEfti",
      "applicantEfti_display",
      "applicantOrganizationName",
      "schoolDistrictName",
      "last_updated_by",
    ],
    prf: [
      "bap_hidden_entity_combo_key",
      "hidden_current_user_email",
      "hidden_bap_rebate_id",
    ],
    crf: [
      "bap_hidden_entity_combo_key",
      "hidden_current_user_email",
      "hidden_bap_rebate_id",
    ],
    change: [],
  },
  2023: {
    frf: [
      "_user_email",
      "_bap_entity_combo_key",
      "_bap_applicant_name",
      "appInfo_uei",
      "appInfo_efti",
      "appInfo_orgName",
      "_formio_schoolDistrictName",
      "org_district_ncesId",
      "org_district_orgName",
      "org_district_address1",
      "org_district_address2",
      "org_district_city",
      "org_district_state",
      "org_district_zipCode",
      "org_district_prioritized",
      "org_district_priorityReason",
      "org_district_contactFName",
      "org_district_contactLName",
      "org_district_contactTitle",
      "org_district_contactEmail",
      "org_district_contactPhone",
    ],
    prf: [
      "_user_email",
      "_bap_entity_combo_key",
      "_bap_rebate_id",
      "_bap_applicant_name",
      "_bap_district_id",
      "_bap_district_nces_id",
      "_bap_district_name",
      "_bap_district_address_1",
      "_bap_district_address_2",
      "_bap_district_city",
      "_bap_district_state",
      "_bap_district_zip",
      "_bap_district_priority",
      "_bap_district_priority_reason",
      "_bap_district_self_certify",
      "_bap_district_contact_id",
      "_bap_district_contact_fname",
      "_bap_district_contact_lname",
      "_bap_district_contact_title",
      "_bap_district_contact_email",
      "_bap_district_contact_phone",
    ],
    crf: [
      "_user_email",
      "_bap_entity_combo_key",
      "_bap_rebate_id",
      "_bap_applicant_name",
      "_bap_district_id",
      "_bap_district_nces_id",
      "_bap_district_name",
      "_bap_district_address_1",
      "_bap_district_address_2",
      "_bap_district_city",
      "_bap_district_state",
      "_bap_district_zip",
      "_bap_district_priority",
      "_bap_district_priority_reason",
      "_bap_district_self_certify",
      "_bap_district_contact_id",
      "_bap_district_contact_recordtype",
      "_bap_district_contact_fname",
      "_bap_district_contact_lname",
      "_bap_district_contact_title",
      "_bap_district_contact_email",
      "_bap_district_contact_phone",
    ],
    change: [
      "_request_form",
      "_bap_rebate_id",
      "_mongo_id",
      "_user_email",
      "request_type",
    ],
  },
  2024: {
    frf: [
      "_user_email",
      "_bap_entity_combo_key",
      "_bap_applicant_name",
      "_formio_schoolDistrictName",
      "appInfo_uei",
      "appInfo_efti",
      "appInfo_organization_name",
      "org_district_nces_id",
      "org_district_name",
      "org_district_address_1",
      "org_district_address_2",
      "org_district_city",
      "org_district_state",
      "org_district_zip",
      "org_district_prioritized",
      "org_district_priorityReason",
      "org_district_self_certify",
      "org_district_contact_fname",
      "org_district_contact_lname",
      "org_district_contact_title",
      "org_district_contact_email",
      "org_district_contact_phone",
    ],
    prf: [],
    crf: [],
    change: [
      "_request_form",
      "_bap_rebate_id",
      "_mongo_id",
      "_user_email",
      "request_type",
    ],
  },
};

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 *
 * @example Example URLs:
 * - /api/formio/2023/check-vin/11111111111111111
 * - /api/formio/2023/check-vin/22222222222222222?rebateId=123456
 * - /api/formio/2023/check-vin/33333333333333333?rebateId=123456&debug=true
 */
function checkVIN({ rebateYear, req, res }) {
  const { vin } = req.params;
  const { rebateId } = req.query;

  // NOTE: included to support EPA API scan
  if (vin === formioExampleVin) {
    return res.json(true);
  }

  if (!vin) {
    const logMessage = `No VIN passed to VIN duplicates lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json(false);
  }

  if (vin.length !== 17) {
    const logMessage = `Invalid VIN '${vin}' passed to VIN duplicates lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json(false);
  }

  return checkForVinDuplicates(req, vin, rebateId)
    .then((json) => {
      const results = json.results[0];
      res.json(results.hit || false);
    })
    .catch((_error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error checking VIN duplicates from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function searchNcesData({ rebateYear, req, res }) {
  const { searchText } = req.params;

  if (!searchText) {
    const logMessage = `No NCES ID passed to NCES data lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json({});
  }

  if (searchText.length !== 7) {
    const logMessage = `Invalid NCES ID '${searchText}' passed to NCES data lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json({});
  }

  const result = req.app.locals.nces[rebateYear].find((item) => {
    return item["NCES ID"] === searchText;
  });

  const logMessage =
    `${rebateYear} NCES data searched with NCES ID '${searchText}' resulting in ` +
    `${result ? "a match" : "no matches"}.`;
  log({ level: "info", message: logMessage, req });

  return res.json({ ...result });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function getRebateContacts({ rebateYear, req, res }) {
  const { rebateId } = req.params;

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json([]);
  }

  if (!rebateId) {
    const logMessage = `No Rebate ID passed to CSB Rebate Contacts lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json([]);
  }

  if (rebateId.length !== 6) {
    const logMessage = `Invalid Rebate ID '${rebateId}' passed to CSB Rebate Contacts lookup.`;
    log({ level: "info", message: logMessage, req });

    return res.json([]);
  }

  return getCSBRebateContacts(req, rebateId)
    .then((json) => {
      const results = json.contacts || [];
      res.json(results);
    })
    .catch((_error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting CSB Rebate Contacts from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 */
function getComboKeyFieldName({ rebateYear }) {
  return rebateYear === "2022"
    ? "bap_hidden_entity_combo_key"
    : rebateYear === "2023"
      ? "_bap_entity_combo_key"
      : rebateYear === "2024"
        ? "_bap_entity_combo_key"
        : "";
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 */
function getRebateIdFieldName({ rebateYear }) {
  return rebateYear === "2022"
    ? "hidden_bap_rebate_id"
    : rebateYear === "2023"
      ? "_bap_rebate_id"
      : rebateYear === "2024"
        ? "_bap_rebate_id"
        : "";
}

/**
 * For local development, modifies the provided Formio schema to update API
 * endpoints of datasource components to use the local development server
 * instead of the deployed server so the request can occur when developing
 * locally (otherwise they're blocked due to CORS restrictions).
 *
 * For example, requests will be made to `http://localhost:3000/api/...`
 * instead of `https://.../api/...`.
 *
 * For non-development environments, the schema is returned unmodified.
 *
 * @param {Object} param
 * @param {Object} param.schema
 */
function applyDevelopmentSchemaModifications({ schema }) {
  if (NODE_ENV !== "development") {
    return schema;
  }

  const result = { ...schema };

  ["components", "columns"].forEach((fieldName) => {
    if (result[fieldName]) {
      result[fieldName].forEach((component) => {
        if (component.type === "datasource") {
          const path = component.fetch.url.split("/api/")[1];
          component.fetch.url = `http://localhost:3000/api/${path}`;
        }

        if (component.components || component.columns) {
          applyDevelopmentSchemaModifications({ schema: component });
        }
      });
    }
  });

  return result;
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchDataForPRFSubmission({ rebateYear, req, res }) {
  /** @type {{
   *  email: string
   *  title: string
   *  name: string
   *  entity: import('./bap.js').BapSamEntity
   *  comboKey: ?string
   *  rebateId: ?string
   *  frfReviewItemId: ?string
   *  frfModified: ?string
   * }} */
  const {
    email,
    title,
    name,
    entity,
    comboKey,
    rebateId,
    frfReviewItemId,
    frfModified,
  } = req.body;

  const {
    UNIQUE_ENTITY_ID__c,
    ENTITY_EFT_INDICATOR__c,
    LEGAL_BUSINESS_NAME__c,
    PHYSICAL_ADDRESS_LINE_1__c,
    PHYSICAL_ADDRESS_LINE_2__c,
    PHYSICAL_ADDRESS_CITY__c,
    PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
    PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
    ELEC_BUS_POC_EMAIL__c,
    ALT_ELEC_BUS_POC_EMAIL__c,
    GOVT_BUS_POC_EMAIL__c,
    ALT_GOVT_BUS_POC_EMAIL__c,
  } = entity;

  if (rebateYear === "2022") {
    return getBapDataFor2022PRF(req, frfReviewItemId)
      .then((results) => {
        const { frf2022RecordQuery, frf2022BusRecordsQuery } = results;

        const {
          CSB_NCES_ID__c,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          Applicant_Organization__r,
          CSB_School_District__r,
          Fleet_Name__c,
          School_District_Prioritized__c,
          Total_Rebate_Funds_Requested__c,
          Total_Infrastructure_Funds__c,
        } = frf2022RecordQuery[0];

        const busInfo = frf2022BusRecordsQuery.map((frf2022BusRecord) => {
          const {
            Rebate_Item_num__c,
            CSB_VIN__c,
            CSB_Model_Year__c,
            CSB_Fuel_Type__c,
            CSB_Replacement_Fuel_Type__c,
            CSB_Funds_Requested__c,
          } = frf2022BusRecord;

          return {
            busNum: Rebate_Item_num__c,
            oldBusNcesDistrictId: CSB_NCES_ID__c,
            oldBusVin: CSB_VIN__c,
            oldBusModelYear: CSB_Model_Year__c,
            oldBusFuelType: CSB_Fuel_Type__c,
            newBusFuelType: CSB_Replacement_Fuel_Type__c,
            hidden_bap_max_rebate: CSB_Funds_Requested__c,
          };
        });

        /**
         * NOTE: `purchaseOrders` is initialized as an empty array to fix some
         * issue with the field being changed to an object when the form loads
         */
        return {
          data: {
            bap_hidden_entity_combo_key: comboKey,
            hidden_application_form_modified: frfModified,
            hidden_current_user_email: email,
            hidden_current_user_title: title,
            hidden_current_user_name: name,
            hidden_sam_uei: UNIQUE_ENTITY_ID__c,
            hidden_sam_efti: ENTITY_EFT_INDICATOR__c || "0000",
            hidden_sam_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            hidden_sam_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            hidden_sam_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            hidden_sam_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            hidden_bap_rebate_id: rebateId,
            hidden_bap_district_id: CSB_NCES_ID__c,
            hidden_bap_primary_name: Primary_Applicant__r?.Name,
            hidden_bap_primary_title: Primary_Applicant__r?.Title,
            hidden_bap_primary_phone_number: Primary_Applicant__r?.Phone,
            hidden_bap_primary_email: Primary_Applicant__r?.Email,
            hidden_bap_alternate_name: Alternate_Applicant__r?.Name || "",
            hidden_bap_alternate_title: Alternate_Applicant__r?.Title || "",
            hidden_bap_alternate_phone_number: Alternate_Applicant__r?.Phone || "", // prettier-ignore
            hidden_bap_alternate_email: Alternate_Applicant__r?.Email || "",
            hidden_bap_org_name: Applicant_Organization__r?.Name,
            hidden_bap_district_name: CSB_School_District__r?.Name,
            hidden_bap_fleet_name: Fleet_Name__c,
            hidden_bap_prioritized: School_District_Prioritized__c,
            hidden_bap_requested_funds: Total_Rebate_Funds_Requested__c,
            hidden_bap_infra_max_rebate: Total_Infrastructure_Funds__c,
            busInfo,
            purchaseOrders: [],
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((_error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2022 Payment Request form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }

  if (rebateYear === "2023") {
    return getBapDataFor2023PRF(req, frfReviewItemId)
      .then((results) => {
        const {
          frf2023RecordQuery,
          frf2023BusRecordsQuery,
          frf2023BusRecordsContactsQueries,
        } = results;

        const existingBusOwnerType = "Old Bus Private Fleet Owner (if changed)";
        const newBusOwnerType = "New Bus Owner";

        const {
          CSB_Snapshot__r,
          Applicant_Organization__r,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          CSB_School_District__r,
          School_District_Contact__r,
          CSB_NCES_ID__c,
          Org_District_Prioritized__c,
          Self_Certification_Category__c,
          Prioritized_as_High_Need__c,
          Prioritized_as_Tribal__c,
          Prioritized_as_Rural__c,
        } = frf2023RecordQuery[0];

        const frf2023RecordJson = JSON.parse(CSB_Snapshot__r.JSON_Snapshot__c);

        const [schoolDistrictStreetAddress1, schoolDistrictStreetAddress2] = (
          CSB_School_District__r?.BillingStreet ?? "\n"
        ).split("\n");

        const org_organizations = frf2023BusRecordsContactsQueries.reduce(
          (array, frf2023BusRecordsContact) => {
            const { Contact__r } = frf2023BusRecordsContact;

            const {
              Id: contactId,
              FirstName,
              LastName,
              Title,
              Email,
              Phone,
              Account,
            } = Contact__r;

            const {
              Id: orgId,
              Name: orgName,
              BillingStreet,
              BillingCity,
              BillingState,
              BillingPostalCode,
              County__c,
            } = Account || {};

            const jsonOrg = frf2023RecordJson.data.organizations.find((org) => {
              const matchedName = org?.org_orgName?.trim() === orgName?.trim();
              const matchedEmail =
                org.org_contactEmail?.trim()?.toLowerCase() ===
                Email?.trim()?.toLowerCase();

              return matchedName && matchedEmail;
            });

            const orgAlreadyAdded = array.some((org) => org._org_id === orgId);

            /**
             * Ensure the org exists in the 2023 FRF submission's
             * "organizations" array, and it hasn't already been added.
             */
            if (jsonOrg && !orgAlreadyAdded) {
              const [orgStreetAddress1, orgStreetAddress2] = (
                BillingStreet ?? "\n"
              ).split("\n");

              array.push({
                org_number: jsonOrg.org_number,
                org_type: jsonOrg.org_type,
                _org_id: orgId,
                org_name: orgName,
                _org_contact_id: contactId,
                org_contact_fname: FirstName,
                org_contact_lname: LastName,
                org_contact_title: Title,
                org_contact_email: Email,
                org_contact_phone: Phone,
                org_address_1: orgStreetAddress1,
                org_address_2: orgStreetAddress2,
                org_county: County__c,
                org_city: BillingCity,
                org_state: { name: BillingState },
                org_zip: BillingPostalCode,
              });
            }

            return array;
          },
          [],
        );

        const bus_buses = frf2023BusRecordsQuery.map((frf2023BusRecord) => {
          const {
            Id: busRecordId,
            Rebate_Item_num__c,
            CSB_VIN__c,
            CSB_Fuel_Type__c,
            CSB_GVWR__c,
            Old_Bus_Odometer_miles__c,
            Old_Bus_NCES_District_ID__c,
            CSB_Model__c,
            CSB_Model_Year__c,
            CSB_Manufacturer__c,
            CSB_Manufacturer_if_Other__c,
            CSB_Annual_Fuel_Consumption__c,
            Annual_Mileage__c,
            Old_Bus_Estimated_Remaining_Life__c,
            Old_Bus_Annual_Idling_Hours__c,
            New_Bus_Infra_Rebate_Requested__c,
            New_Bus_Fuel_Type__c,
            New_Bus_GVWR__c,
            New_Bus_ADA_Compliant__c,
          } = frf2023BusRecord;

          const existingOwnerRecord = frf2023BusRecordsContactsQueries.find(
            (item) =>
              item.Related_Line_Item__c === busRecordId &&
              item.Relationship_Type__c === existingBusOwnerType,
          );

          const newOwnerRecord = frf2023BusRecordsContactsQueries.find(
            (item) =>
              item.Related_Line_Item__c === busRecordId &&
              item.Relationship_Type__c === newBusOwnerType,
          );

          return {
            bus_busNumber: Rebate_Item_num__c,
            bus_existingOwner: {
              org_id: existingOwnerRecord?.Contact__r?.Account?.Id,
              org_name: existingOwnerRecord?.Contact__r?.Account?.Name,
              org_contact_id: existingOwnerRecord?.Contact__r?.Id,
              org_contact_fname: existingOwnerRecord?.Contact__r?.FirstName,
              org_contact_lname: existingOwnerRecord?.Contact__r?.LastName,
            },
            bus_existingVin: CSB_VIN__c,
            bus_existingFuelType: CSB_Fuel_Type__c,
            bus_existingGvwr: CSB_GVWR__c,
            bus_existingOdometer: Old_Bus_Odometer_miles__c,
            bus_existingModel: CSB_Model__c,
            bus_existingModelYear: CSB_Model_Year__c,
            bus_existingNcesId: Old_Bus_NCES_District_ID__c,
            bus_existingManufacturer: CSB_Manufacturer__c,
            bus_existingManufacturerOther: CSB_Manufacturer_if_Other__c,
            bus_existingAnnualFuelConsumption: CSB_Annual_Fuel_Consumption__c,
            bus_existingAnnualMileage: Annual_Mileage__c,
            bus_existingRemainingLife: Old_Bus_Estimated_Remaining_Life__c,
            bus_existingIdlingHours: Old_Bus_Annual_Idling_Hours__c,
            bus_newOwner: {
              org_id: newOwnerRecord?.Contact__r?.Account?.Id,
              org_name: newOwnerRecord?.Contact__r?.Account?.Name,
              org_contact_id: newOwnerRecord?.Contact__r?.Id,
              org_contact_fname: newOwnerRecord?.Contact__r?.FirstName,
              org_contact_lname: newOwnerRecord?.Contact__r?.LastName,
            },
            bus_newFuelType: New_Bus_Fuel_Type__c,
            bus_newGvwr: New_Bus_GVWR__c,
            _bus_maxRebate: New_Bus_Infra_Rebate_Requested__c,
            _bus_newADAfromFRF: New_Bus_ADA_Compliant__c,
          };
        });

        return {
          data: {
            _application_form_modified: frfModified,
            _bap_entity_combo_key: comboKey,
            _bap_rebate_id: rebateId,
            _user_email: email,
            _user_title: title,
            _user_name: name,
            _bap_applicant_email: email,
            _bap_applicant_title: title,
            _bap_applicant_name: name,
            _bap_applicant_efti: ENTITY_EFT_INDICATOR__c || "0000",
            _bap_applicant_uei: UNIQUE_ENTITY_ID__c,
            _bap_applicant_organization_id: Applicant_Organization__r?.Id,
            _bap_applicant_organization_name: LEGAL_BUSINESS_NAME__c,
            _bap_applicant_street_address_1: PHYSICAL_ADDRESS_LINE_1__c,
            _bap_applicant_street_address_2: PHYSICAL_ADDRESS_LINE_2__c,
            _bap_applicant_county: Applicant_Organization__r?.County__c,
            _bap_applicant_city: PHYSICAL_ADDRESS_CITY__c,
            _bap_applicant_state: PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
            _bap_applicant_zip: PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
            _bap_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            _bap_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            _bap_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            _bap_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            _bap_primary_id: Primary_Applicant__r?.Id,
            _bap_primary_fname: Primary_Applicant__r?.FirstName,
            _bap_primary_lname: Primary_Applicant__r?.LastName,
            _bap_primary_title: Primary_Applicant__r?.Title,
            _bap_primary_email: Primary_Applicant__r?.Email,
            _bap_primary_phone: Primary_Applicant__r?.Phone,
            _bap_alternate_id: Alternate_Applicant__r?.Id,
            _bap_alternate_fname: Alternate_Applicant__r?.FirstName,
            _bap_alternate_lname: Alternate_Applicant__r?.LastName,
            _bap_alternate_title: Alternate_Applicant__r?.Title,
            _bap_alternate_email: Alternate_Applicant__r?.Email,
            _bap_alternate_phone: Alternate_Applicant__r?.Phone,
            _bap_district_id: CSB_School_District__r?.Id,
            _bap_district_nces_id: CSB_NCES_ID__c,
            _bap_district_name: CSB_School_District__r?.Name,
            _bap_district_address_1: schoolDistrictStreetAddress1 || "",
            _bap_district_address_2: schoolDistrictStreetAddress2 || "",
            _bap_district_city: CSB_School_District__r?.BillingCity,
            _bap_district_state: CSB_School_District__r?.BillingState,
            _bap_district_zip: CSB_School_District__r?.BillingPostalCode,
            _bap_district_priority: Org_District_Prioritized__c,
            _bap_district_priority_reason: {
              highNeed: Prioritized_as_High_Need__c,
              tribal: Prioritized_as_Tribal__c,
              rural: Prioritized_as_Rural__c,
            },
            _bap_district_self_certify: Self_Certification_Category__c,
            _bap_district_contact_id: School_District_Contact__r?.Id,
            _bap_district_contact_fname: School_District_Contact__r?.FirstName,
            _bap_district_contact_lname: School_District_Contact__r?.LastName,
            _bap_district_contact_title: School_District_Contact__r?.Title,
            _bap_district_contact_email: School_District_Contact__r?.Email,
            _bap_district_contact_phone: School_District_Contact__r?.Phone,
            org_organizations,
            bus_buses,
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((_error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2023 Payment Request form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }

  if (rebateYear === "2024") {
    return getBapDataFor2024PRF(req, frfReviewItemId)
      .then((results) => {
        const {
          frf2024RecordQuery,
          frf2024BusRecordsQuery,
          frf2024BusRecordsContactsQueries,
        } = results;

        const existingBusOwnerType = "Old Bus Private Fleet Owner (if changed)";
        const newBusOwnerType = "New Bus Owner";

        const {
          CSB_Snapshot__r,
          Applicant_Organization__r,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          CSB_School_District__r,
          School_District_Contact__r,
          CSB_NCES_ID__c,
          Org_District_Prioritized__c,
          Self_Certification_Category__c,
          Prioritized_as_High_Need__c,
          Prioritized_as_Tribal__c,
          Prioritized_as_Rural__c,
        } = frf2024RecordQuery[0];

        const frf2024RecordJson = JSON.parse(CSB_Snapshot__r.JSON_Snapshot__c);

        const [schoolDistrictStreetAddress1, schoolDistrictStreetAddress2] = (
          CSB_School_District__r?.BillingStreet ?? "\n"
        ).split("\n");

        const org_organizations = frf2024BusRecordsContactsQueries.reduce(
          (array, frf2024BusRecordsContact) => {
            const { Contact__r } = frf2024BusRecordsContact;

            const {
              Id: contactId,
              Record_Type_Name__c,
              FirstName,
              LastName,
              Title,
              Email,
              Phone,
              Account,
            } = Contact__r;

            const {
              Id: orgId,
              Name: orgName,
              BillingStreet,
              BillingCity,
              BillingState,
              BillingPostalCode,
              County__c,
            } = Account || {};

            const jsonOrg = frf2024RecordJson.data.org_organizations.find(
              (org) => {
                const matchedName = org?.org_name?.trim() === orgName?.trim();
                const matchedEmail =
                  org.org_contact_email?.trim()?.toLowerCase() ===
                  Email?.trim()?.toLowerCase();

                return matchedName && matchedEmail;
              },
            );

            const orgAlreadyAdded = array.some(
              (org) => org._bap_org_id === orgId,
            );

            /**
             * Ensure the org exists in the 2024 FRF submission's
             * "organizations" array, and it hasn't already been added.
             */
            if (jsonOrg && !orgAlreadyAdded) {
              const [orgStreetAddress1, orgStreetAddress2] = (
                BillingStreet ?? "\n"
              ).split("\n");

              array.push({
                _bap_org_frf: true,
                org_number: jsonOrg.org_number,
                org_type: {
                  existing_bus_owner: jsonOrg.org_type.existingBusOwner,
                  new_bus_owner: jsonOrg.org_type.newBusOwner,
                  private_fleet: jsonOrg.org_type.privateFleet,
                },
                _bap_org_id: orgId,
                _bap_org_name: orgName,
                _bap_org_contact_id_frf: contactId,
                _bap_org_contact_recordtype: Record_Type_Name__c,
                _bap_org_contact_fname: FirstName,
                _bap_org_contact_lname: LastName,
                _bap_org_contact_title: Title,
                _bap_org_contact_email: Email,
                _bap_org_contact_phone: Phone,
                _bap_org_address_1: orgStreetAddress1,
                _bap_org_address_2: orgStreetAddress2,
                _bap_org_county: County__c,
                _bap_org_city: BillingCity,
                _bap_org_state: BillingState,
                _bap_org_zip: BillingPostalCode,
              });
            }

            return array;
          },
          [],
        );

        const bus_buses = frf2024BusRecordsQuery.map((frf2024BusRecord) => {
          const {
            Id: busRecordId,
            Rebate_Item_num__c,
            CSB_VIN__c,
            CSB_Fuel_Type__c,
            CSB_GVWR__c,
            Old_Bus_Odometer_miles__c,
            Old_Bus_NCES_District_ID__c,
            CSB_Model__c,
            CSB_Model_Year__c,
            CSB_Manufacturer__c,
            CSB_Manufacturer_if_Other__c,
            CSB_Annual_Fuel_Consumption__c,
            Old_Bus_Average_Annual_Mileage__c,
            Old_Bus_Estimated_Remaining_Life__c,
            Old_Bus_Annual_Idling_Hours__c,
            New_Bus_Infra_Rebate_Requested__c,
            New_Bus_Fuel_Type__c,
            New_Bus_GVWR__c,
            New_Bus_ADA_Compliant__c,
          } = frf2024BusRecord;

          const existingOwnerRecord = frf2024BusRecordsContactsQueries.find(
            (item) =>
              item.Related_Line_Item__c === busRecordId &&
              item.Relationship_Type__c === existingBusOwnerType,
          );

          const newOwnerRecord = frf2024BusRecordsContactsQueries.find(
            (item) =>
              item.Related_Line_Item__c === busRecordId &&
              item.Relationship_Type__c === newBusOwnerType,
          );

          return {
            bus_number: Rebate_Item_num__c,
            bus_existing_owner: {
              org_id: existingOwnerRecord?.Contact__r?.Account?.Id,
              org_name: existingOwnerRecord?.Contact__r?.Account?.Name,
              org_contact_id: existingOwnerRecord?.Contact__r?.Id,
              org_contact_recordtype: existingOwnerRecord?.Contact__r?.Record_Type_Name__c, // prettier-ignore
              org_contact_fname: existingOwnerRecord?.Contact__r?.FirstName,
              org_contact_lname: existingOwnerRecord?.Contact__r?.LastName,
            },
            bus_existing_vin: CSB_VIN__c,
            bus_existing_fuel_type: CSB_Fuel_Type__c,
            bus_existing_gvwr: CSB_GVWR__c,
            bus_existing_odometer: Old_Bus_Odometer_miles__c,
            bus_existing_model: CSB_Model__c,
            bus_existing_model_year: CSB_Model_Year__c,
            bus_existing_nces_id: Old_Bus_NCES_District_ID__c,
            bus_existing_manufacturer: CSB_Manufacturer__c,
            bus_existing_manufacturer_other: CSB_Manufacturer_if_Other__c,
            bus_existing_annual_fuel_consumption: CSB_Annual_Fuel_Consumption__c, // prettier-ignore
            bus_existing_annual_mileage: Old_Bus_Average_Annual_Mileage__c,
            bus_existing_remaining_life: Old_Bus_Estimated_Remaining_Life__c,
            bus_existing_idling_hours: Old_Bus_Annual_Idling_Hours__c,
            bus_new_owner: {
              org_id: newOwnerRecord?.Contact__r?.Account?.Id,
              org_name: newOwnerRecord?.Contact__r?.Account?.Name,
              org_contact_id: newOwnerRecord?.Contact__r?.Id,
              org_contact_recordtype: newOwnerRecord?.Contact__r?.Record_Type_Name__c, // prettier-ignore
              org_contact_fname: newOwnerRecord?.Contact__r?.FirstName,
              org_contact_lname: newOwnerRecord?.Contact__r?.LastName,
            },
            bus_new_fuel_type: New_Bus_Fuel_Type__c,
            bus_new_gvwr: New_Bus_GVWR__c,
            _bus_new_max_rebate: New_Bus_Infra_Rebate_Requested__c,
            _bus_new_ada_from_frf: New_Bus_ADA_Compliant__c,
          };
        });

        return {
          data: {
            _frf_modified: frfModified,
            _bap_entity_combo_key: comboKey,
            _bap_rebate_id: rebateId,
            _user_email: email,
            _user_title: title,
            _user_name: name,
            _bap_applicant_email: email,
            _bap_applicant_title: title,
            _bap_applicant_name: name,
            _bap_applicant_efti: ENTITY_EFT_INDICATOR__c || "0000",
            _bap_applicant_uei: UNIQUE_ENTITY_ID__c,
            _bap_applicant_organization_id: Applicant_Organization__r?.Id,
            _bap_applicant_organization_name: LEGAL_BUSINESS_NAME__c,
            _bap_applicant_street_address_1: PHYSICAL_ADDRESS_LINE_1__c,
            _bap_applicant_street_address_2: PHYSICAL_ADDRESS_LINE_2__c,
            _bap_applicant_county: Applicant_Organization__r?.County__c,
            _bap_applicant_city: PHYSICAL_ADDRESS_CITY__c,
            _bap_applicant_state: PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
            _bap_applicant_zip: PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
            _bap_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            _bap_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            _bap_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            _bap_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            _bap_primary_id: Primary_Applicant__r?.Id,
            _bap_primary_recordtype: Primary_Applicant__r?.Record_Type_Name__c,
            _bap_primary_fname: Primary_Applicant__r?.FirstName,
            _bap_primary_lname: Primary_Applicant__r?.LastName,
            _bap_primary_title: Primary_Applicant__r?.Title,
            _bap_primary_email: Primary_Applicant__r?.Email,
            _bap_primary_phone: Primary_Applicant__r?.Phone,
            _bap_alternate_id: Alternate_Applicant__r?.Id,
            _bap_alternate_recordtype: Alternate_Applicant__r?.Record_Type_Name__c, // prettier-ignore
            _bap_alternate_fname: Alternate_Applicant__r?.FirstName,
            _bap_alternate_lname: Alternate_Applicant__r?.LastName,
            _bap_alternate_title: Alternate_Applicant__r?.Title,
            _bap_alternate_email: Alternate_Applicant__r?.Email,
            _bap_alternate_phone: Alternate_Applicant__r?.Phone,
            _bap_district_id: CSB_School_District__r?.Id,
            _bap_district_nces_id: CSB_NCES_ID__c,
            _bap_district_name: CSB_School_District__r?.Name,
            _bap_district_address_1: schoolDistrictStreetAddress1 || "",
            _bap_district_address_2: schoolDistrictStreetAddress2 || "",
            _bap_district_city: CSB_School_District__r?.BillingCity,
            _bap_district_state: CSB_School_District__r?.BillingState,
            _bap_district_zip: CSB_School_District__r?.BillingPostalCode,
            _bap_district_priority: Org_District_Prioritized__c,
            _bap_district_priority_reason: {
              highNeed: Prioritized_as_High_Need__c,
              tribal: Prioritized_as_Tribal__c,
              rural: Prioritized_as_Rural__c,
            },
            _bap_district_self_certify: Self_Certification_Category__c,
            _bap_district_contact_id: School_District_Contact__r?.Id,
            _bap_district_contact_recordtype: School_District_Contact__r?.Record_Type_Name__c, // prettier-ignore
            _bap_district_contact_fname: School_District_Contact__r?.FirstName,
            _bap_district_contact_lname: School_District_Contact__r?.LastName,
            _bap_district_contact_title: School_District_Contact__r?.Title,
            _bap_district_contact_email: School_District_Contact__r?.Email,
            _bap_district_contact_phone: School_District_Contact__r?.Phone,
            org_organizations,
            bus_buses,
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((_error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2024 Payment Request form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchDataForCRFSubmission({ rebateYear, req, res }) {
  /** @type {{
   *  email: string
   *  title: string
   *  name: string
   *  entity: import('./bap.js').BapSamEntity
   *  comboKey: ?string
   *  rebateId: ?string
   *  frfReviewItemId: ?string
   *  prfReviewItemId: ?string
   *  prfModified: ?string
   * }} */
  const {
    email,
    title,
    name,
    entity,
    comboKey,
    rebateId,
    frfReviewItemId,
    prfReviewItemId,
    prfModified,
  } = req.body;

  const {
    UNIQUE_ENTITY_ID__c,
    ENTITY_EFT_INDICATOR__c,
    LEGAL_BUSINESS_NAME__c,
    PHYSICAL_ADDRESS_LINE_1__c,
    PHYSICAL_ADDRESS_LINE_2__c,
    PHYSICAL_ADDRESS_CITY__c,
    PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
    PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
    ELEC_BUS_POC_EMAIL__c,
    ALT_ELEC_BUS_POC_EMAIL__c,
    GOVT_BUS_POC_EMAIL__c,
    ALT_GOVT_BUS_POC_EMAIL__c,
  } = entity;

  if (rebateYear === "2022") {
    return getBapDataFor2022CRF(req, frfReviewItemId, prfReviewItemId)
      .then((results) => {
        const {
          frf2022RecordQuery,
          prf2022RecordQuery,
          prf2022BusRecordsQuery,
        } = results;

        const {
          Fleet_Name__c,
          Fleet_Street_Address__c,
          Fleet_City__c,
          Fleet_State__c,
          Fleet_Zip__c,
          Fleet_Contact_Name__c,
          Fleet_Contact_Title__c,
          Fleet_Contact_Phone__c,
          Fleet_Contact_Email__c,
          School_District_Contact__r,
        } = frf2022RecordQuery[0];

        const {
          CSB_NCES_ID__c,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          Applicant_Organization__r,
          CSB_School_District__r,
          School_District_Prioritized__c,
          Total_Rebate_Funds_Requested_PO__c,
          Total_Bus_And_Infrastructure_Rebate__c,
          Total_Infrastructure_Funds__c,
          Num_Of_Buses_Requested_From_Application__c,
          Total_Price_All_Buses__c,
          Total_Bus_Rebate_Amount__c,
          Total_All_Eligible_Infrastructure_Costs__c,
          Total_Infrastructure_Rebate__c,
          Total_Level_2_Charger_Costs__c,
          Total_DC_Fast_Charger_Costs__c,
          Total_Other_Infrastructure_Costs__c,
        } = prf2022RecordQuery[0];

        const busInfo = prf2022BusRecordsQuery.map((prf2022BusRecord) => {
          const {
            Rebate_Item_num__c,
            CSB_VIN__c,
            CSB_Model_Year__c,
            CSB_Fuel_Type__c,
            Old_Bus_Estimated_Remaining_Life__c,
            Old_Bus_Exclude__c,
            Related_Line_Item__r,
            New_Bus_Fuel_Type__c,
            New_Bus_Make__c,
            CSB_Manufacturer_if_Other__c,
            New_Bus_Model__c,
            New_Bus_Model_Year__c,
            New_Bus_GVWR__c,
            New_Bus_Purchase_Price__c,
            New_Bus_Rebate_Amount__c,
          } = prf2022BusRecord;

          return {
            busNum: Rebate_Item_num__c,
            oldBusNcesDistrictId: CSB_NCES_ID__c,
            oldBusVin: CSB_VIN__c,
            oldBusModelYear: CSB_Model_Year__c,
            oldBusFuelType: CSB_Fuel_Type__c,
            oldBusEstimatedRemainingLife: Old_Bus_Estimated_Remaining_Life__c,
            oldBusExclude: Old_Bus_Exclude__c,
            hidden_prf_oldBusExclude: Old_Bus_Exclude__c,
            newBusDealer: Related_Line_Item__r?.Vendor_Name__c,
            newBusFuelType: New_Bus_Fuel_Type__c,
            hidden_prf_newBusFuelType: New_Bus_Fuel_Type__c,
            newBusMake: New_Bus_Make__c,
            hidden_prf_newBusMake: New_Bus_Make__c,
            newBusMakeOther: CSB_Manufacturer_if_Other__c,
            hidden_prf_newBusMakeOther: CSB_Manufacturer_if_Other__c,
            newBusModel: New_Bus_Model__c,
            hidden_prf_newBusModel: New_Bus_Model__c,
            newBusModelYear: New_Bus_Model_Year__c,
            hidden_prf_newBusModelYear: New_Bus_Model_Year__c,
            newBusGvwr: New_Bus_GVWR__c,
            hidden_prf_newBusGvwr: New_Bus_GVWR__c,
            newBusPurchasePrice: New_Bus_Purchase_Price__c,
            hidden_prf_newBusPurchasePrice: New_Bus_Purchase_Price__c,
            hidden_prf_rebate: New_Bus_Rebate_Amount__c,
          };
        });

        return {
          data: {
            bap_hidden_entity_combo_key: comboKey,
            hidden_prf_modified: prfModified,
            hidden_current_user_email: email,
            hidden_current_user_title: title,
            hidden_current_user_name: name,
            hidden_bap_rebate_id: rebateId,
            hidden_sam_uei: UNIQUE_ENTITY_ID__c,
            hidden_sam_efti: ENTITY_EFT_INDICATOR__c || "0000",
            hidden_sam_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            hidden_sam_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            hidden_sam_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            hidden_sam_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            hidden_bap_district_id: CSB_NCES_ID__c,
            hidden_bap_district_name: CSB_School_District__r?.Name,
            hidden_bap_primary_fname: Primary_Applicant__r?.FirstName,
            hidden_bap_primary_lname: Primary_Applicant__r?.LastName,
            hidden_bap_primary_title: Primary_Applicant__r?.Title,
            hidden_bap_primary_phone_number: Primary_Applicant__r?.Phone,
            hidden_bap_primary_email: Primary_Applicant__r?.Email,
            hidden_bap_alternate_fname: Alternate_Applicant__r?.FirstName || "",
            hidden_bap_alternate_lname: Alternate_Applicant__r?.LastName || "",
            hidden_bap_alternate_title: Alternate_Applicant__r?.Title || "",
            hidden_bap_alternate_phone_number: Alternate_Applicant__r?.Phone || "", // prettier-ignore
            hidden_bap_alternate_email: Alternate_Applicant__r?.Email || "",
            hidden_bap_org_name: Applicant_Organization__r?.Name,
            hidden_bap_fleet_name: Fleet_Name__c,
            hidden_bap_fleet_address: Fleet_Street_Address__c,
            hidden_bap_fleet_city: Fleet_City__c,
            hidden_bap_fleet_state: Fleet_State__c,
            hidden_bap_fleet_zip: Fleet_Zip__c,
            hidden_bap_fleet_contact_name: Fleet_Contact_Name__c,
            hidden_bap_fleet_contact_title: Fleet_Contact_Title__c,
            hidden_bap_fleet_phone: Fleet_Contact_Phone__c,
            hidden_bap_fleet_email: Fleet_Contact_Email__c,
            hidden_bap_prioritized: School_District_Prioritized__c,
            hidden_bap_requested_funds: Total_Rebate_Funds_Requested_PO__c,
            hidden_bap_received_funds: Total_Bus_And_Infrastructure_Rebate__c,
            hidden_bap_prf_infra_max_rebate: Total_Infrastructure_Funds__c,
            hidden_bap_buses_requested_app: Num_Of_Buses_Requested_From_Application__c, // prettier-ignore
            hidden_bap_total_bus_costs_prf: Total_Price_All_Buses__c,
            hidden_bap_total_bus_rebate_received: Total_Bus_Rebate_Amount__c,
            hidden_bap_total_infra_costs_prf: Total_All_Eligible_Infrastructure_Costs__c, // prettier-ignore
            hidden_bap_total_infra_rebate_received: Total_Infrastructure_Rebate__c, // prettier-ignore
            hidden_bap_total_infra_level2_charger: Total_Level_2_Charger_Costs__c, // prettier-ignore
            hidden_bap_total_infra_dc_fast_charger: Total_DC_Fast_Charger_Costs__c, // prettier-ignore
            hidden_bap_total_infra_other_costs: Total_Other_Infrastructure_Costs__c, // prettier-ignore
            hidden_bap_district_contact_fname: School_District_Contact__r?.FirstName, // prettier-ignore
            hidden_bap_district_contact_lname: School_District_Contact__r?.LastName, // prettier-ignore
            busInfo,
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2022 Close Out form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }

  if (rebateYear === "2023") {
    return getBapDataFor2023CRF(req, prfReviewItemId)
      .then((results) => {
        const {
          prf2023RecordQuery,
          prf2023BusRecordsQuery,
          prf2023InfrastructureRecordsQuery,
          prf2023ContactsQuery,
        } = results;

        const {
          CSB_NCES_ID__c,
          CSB_Snapshot__r,
          Primary_Applicant__r,
          Alternate_Applicant__r,
          Applicant_Organization__r,
          CSB_School_District__r,
          School_District_Contact__r,
          Org_District_Prioritized__c,
          Prioritized_as_High_Need__c,
          Prioritized_as_Tribal__c,
          Prioritized_as_Rural__c,
          Self_Certification_Category__c,
          Num_Of_Buses_Requested_From_Application__c,
          Total_Price_All_Buses__c,
          Total_Bus_Rebate_Amount__c,
          Total_All_Eligible_Infrastructure_Costs__c,
          Total_Infrastructure_Rebate__c,
          Total_Level_2_Charger_Costs__c,
          Total_DC_Fast_Charger_Costs__c,
          Total_Other_Infrastructure_Costs__c,
          Funding_Alloc_for_Eligible_Infra_Costs__c,
          Original_CSB_Funds_Requested__c,
          Total_Bus_And_Infrastructure_Rebate__c,
        } = prf2023RecordQuery[0];

        const prf2023RecordJson = JSON.parse(CSB_Snapshot__r.JSON_Snapshot__c);

        const [schoolDistrictStreetAddress1, schoolDistrictStreetAddress2] = (
          CSB_School_District__r?.BillingStreet ?? "\n"
        ).split("\n");

        const org_organizations = prf2023ContactsQuery.reduce(
          (array, contact) => {
            const {
              Id: contactId,
              Record_Type_Name__c,
              FirstName,
              LastName,
              Title,
              Email,
              Phone,
              Account,
            } = contact;

            const {
              Id: orgId,
              Name: orgName,
              BillingStreet,
              BillingCity,
              BillingState,
              BillingPostalCode,
              County__c,
            } = Account || {};

            const jsonOrg = prf2023RecordJson.data.org_organizations.find(
              (org) => {
                const matchedName = org?.org_name?.trim() === orgName?.trim();
                const matchedEmail =
                  org.org_contact_email?.trim()?.toLowerCase() ===
                  Email?.trim()?.toLowerCase();

                return matchedName && matchedEmail;
              },
            );

            const orgAlreadyAdded = array.some((org) => org._org_id === orgId);

            /**
             * Ensure the org exists in the 2023 PRF submission's
             * "org_organizations" array, and it hasn't already been added.
             */
            if (jsonOrg && !orgAlreadyAdded) {
              const [orgStreetAddress1, orgStreetAddress2] = (
                BillingStreet ?? "\n"
              ).split("\n");

              array.push({
                org_number: jsonOrg.org_number,
                org_type: jsonOrg.org_type,
                _org_id: orgId,
                _org_name: orgName,
                _org_address_1: orgStreetAddress1,
                _org_address_2: orgStreetAddress2,
                _org_county: County__c,
                _org_city: BillingCity,
                _org_state: BillingState,
                _org_zip: BillingPostalCode,
                _org_contact_id: contactId,
                _org_contact_recordtype: Record_Type_Name__c,
                _org_contact_fname: FirstName,
                _org_contact_lname: LastName,
                _org_contact_title: Title,
                _org_contact_email: Email,
                _org_contact_phone: Phone,
              });
            }

            return array;
          },
          [],
        );

        const bus_buses = prf2023BusRecordsQuery.map((prf2023BusRecord) => {
          const {
            Rebate_Item_num__c,
            CSB_VIN__c,
            CSB_Model__c,
            CSB_Model_Year__c,
            CSB_Fuel_Type__c,
            CSB_GVWR__c,
            CSB_Manufacturer__c,
            CSB_Manufacturer_if_Other__c,
            CSB_Annual_Fuel_Consumption__c,
            Old_Bus_Average_Annual_Mileage__c,
            Old_Bus_Odometer_miles__c,
            Old_Bus_NCES_District_ID__c,
            Old_Bus_Estimated_Remaining_Life__c,
            Old_Bus_Annual_Idling_Hours__c,
            Bus_Excluded_in_PRF__c,
            New_Bus_EPA_Vehicle_Family__c,
            New_Bus_Fuel_Type__c,
            New_Bus_Make__c,
            New_Bus_Manufacturer_if_Other__c,
            New_Bus_Model__c,
            New_Bus_Model_Year__c,
            New_Bus_GVWR__c,
            New_Bus_Rebate_Amount__c,
            New_Bus_Purchase_Price__c,
            New_Bus_ADA_Compliant__c,
            New_Bus_Infra_Rebate_Requested__c,
            ADA_Compliance_Costs__c,
            Bus_Shipping_Costs__c,
            Eligible_ADA_Compliance_Rebate__c,
            Eligible_Bus_Shipping_Rebate__c,
            New_Bus_Owner_Contact_ID__c,
            Old_Bus_Owner_Contact_ID__c,
          } = prf2023BusRecord;

          const existingOwnerRecord = prf2023ContactsQuery.find((contact) => {
            return contact.Id === Old_Bus_Owner_Contact_ID__c;
          });

          const newOwnerRecord = prf2023ContactsQuery.find((contact) => {
            return contact.Id === New_Bus_Owner_Contact_ID__c;
          });

          return {
            bus_number: Rebate_Item_num__c,
            bus_existing_excluded: Bus_Excluded_in_PRF__c,
            _bus_existing_excluded: Bus_Excluded_in_PRF__c,
            bus_existing_owner: {
              org_id: existingOwnerRecord?.Account?.Id,
              org_name: existingOwnerRecord?.Account?.Name,
              org_contact_id: existingOwnerRecord?.Id,
              org_contact_fname: existingOwnerRecord?.FirstName,
              org_contact_lname: existingOwnerRecord?.LastName,
            },
            bus_existing_vin: CSB_VIN__c,
            bus_existing_fuel_type: CSB_Fuel_Type__c,
            bus_existing_gvwr: CSB_GVWR__c,
            bus_existing_odometer: Old_Bus_Odometer_miles__c,
            bus_existing_model: CSB_Model__c,
            bus_existing_model_year: CSB_Model_Year__c,
            bus_existing_nces_id: Old_Bus_NCES_District_ID__c,
            bus_existing_manufacturer: CSB_Manufacturer__c,
            bus_existing_manufacturer_other: CSB_Manufacturer_if_Other__c,
            bus_existing_remaining_life: Old_Bus_Estimated_Remaining_Life__c,
            bus_existing_annual_fuel_consumption: CSB_Annual_Fuel_Consumption__c, // prettier-ignore
            bus_existing_annual_mileage: Old_Bus_Average_Annual_Mileage__c,
            bus_existing_idling_hours: Old_Bus_Annual_Idling_Hours__c,
            bus_new_owner: {
              org_id: newOwnerRecord?.Account?.Id,
              org_name: newOwnerRecord?.Account?.Name,
              org_contact_id: newOwnerRecord?.Id,
              org_contact_fname: newOwnerRecord?.FirstName,
              org_contact_lname: newOwnerRecord?.LastName,
            },
            _bus_new_purchase_price: New_Bus_Purchase_Price__c,
            _bus_new_fuel_type: New_Bus_Fuel_Type__c,
            _bus_new_gvwr: New_Bus_GVWR__c,
            _bus_new_ada: New_Bus_ADA_Compliant__c,
            _bus_new_manufacturer: New_Bus_Make__c,
            _bus_new_manufacturer_other: New_Bus_Manufacturer_if_Other__c,
            _bus_new_model: New_Bus_Model__c,
            _bus_new_epa_carb: New_Bus_EPA_Vehicle_Family__c,
            _bus_new_model_year: New_Bus_Model_Year__c,
            bus_rebate_shipping: Eligible_Bus_Shipping_Rebate__c,
            bus_rebate_shipping_costs: Bus_Shipping_Costs__c,
            bus_rebate_ada: Eligible_ADA_Compliance_Rebate__c,
            bus_rebate_ada_costs: ADA_Compliance_Costs__c,
            _bus_funding_amount: New_Bus_Rebate_Amount__c,
            _bus_max_rebate: New_Bus_Infra_Rebate_Requested__c,
          };
        });

        const infra_infrastructure = prf2023InfrastructureRecordsQuery.map(
          (prf2023InfrastructureRecord) => {
            const {
              Infrastructure_Type__c,
              Infrastructure_Type_Other__c,
              Description_of_Work__c,
              Other_Eligible_Infra_Cost_from_PRF__c,
              EVSE_Maximum_Output_Power_kW__c,
              EVSE_Manufacturer__c,
              EVSE_Manufacturer_if_Other__c,
              EVSE_Model__c,
              EVSE_Date_of_Manufacture__c,
              Number_of_Plugs_on_EVSE__c,
              Capable_of_Bidirectional_Charging__c,
              Planning_to_Use_Bidirectional_Charging__c,
              EVSE_Energy_Star__c,
              Charger_Infra_Materials_BABA_Compliant__c,
              Charger_Infrastructure_Quantity__c,
              Infrastructure_Cost_per_Charger_from_PRF__c,
              Charger_Cost_Includes_Installation__c,
              Infrastructure_Owner_Contact_ID__c,
            } = prf2023InfrastructureRecord;

            const ownerRecord = prf2023ContactsQuery.find((contact) => {
              return contact.Id === Infrastructure_Owner_Contact_ID__c;
            });

            return {
              infra_type: Infrastructure_Type__c,
              infra_other_type: Infrastructure_Type_Other__c,
              infra_other_desc: Description_of_Work__c,
              infra_other_cost: Other_Eligible_Infra_Cost_from_PRF__c,
              infra_evse_max_output_power: EVSE_Maximum_Output_Power_kW__c,
              infra_evse_manufacturer: EVSE_Manufacturer__c,
              infra_evse_manufacturer_other: EVSE_Manufacturer_if_Other__c,
              infra_evse_model: EVSE_Model__c,
              infra_evse_manufacture_date: EVSE_Date_of_Manufacture__c,
              infra_evse_number_plugs: Number_of_Plugs_on_EVSE__c,
              _infra_evse_bidirectional_charging: Capable_of_Bidirectional_Charging__c, // prettier-ignore
              infra_evse_bidirectional_planning: Planning_to_Use_Bidirectional_Charging__c, // prettier-ignore
              infra_evse_energy_star: EVSE_Energy_Star__c,
              infra_evse_baba_compliant: Charger_Infra_Materials_BABA_Compliant__c, // prettier-ignore
              infra_evse_quantity: Charger_Infrastructure_Quantity__c,
              infra_evse_cost_charger: Infrastructure_Cost_per_Charger_from_PRF__c, // prettier-ignore
              infra_evse_includes_installion: Charger_Cost_Includes_Installation__c, // prettier-ignore
              infra_owner: {
                org_id: ownerRecord?.Account?.Id,
                org_name: ownerRecord?.Account?.Name,
                org_contact_id: ownerRecord?.Id,
                org_contact_fname: ownerRecord?.FirstName,
                org_contact_lname: ownerRecord?.LastName,
              },
              infra_address: ownerRecord?.Account?.BillingStreet,
              infra_city: ownerRecord?.Account?.BillingCity,
              infra_state: ownerRecord?.Account?.BillingState,
              infra_zip: ownerRecord?.Account?.BillingPostalCode,
              infra_county: ownerRecord?.Account?.County__c,
            };
          },
        );

        return {
          data: {
            _bap_entity_combo_key: comboKey,
            _bap_rebate_id: rebateId,
            _user_email: email,
            _user_title: title,
            _user_name: name,
            _bap_applicant_email: email,
            _bap_applicant_title: title,
            _bap_applicant_name: name,
            _bap_applicant_efti: ENTITY_EFT_INDICATOR__c || "0000",
            _bap_applicant_uei: UNIQUE_ENTITY_ID__c,
            _bap_applicant_organization_id: Applicant_Organization__r?.Id,
            _bap_applicant_organization_name: LEGAL_BUSINESS_NAME__c,
            _bap_applicant_street_address_1: PHYSICAL_ADDRESS_LINE_1__c,
            _bap_applicant_street_address_2: PHYSICAL_ADDRESS_LINE_2__c,
            _bap_applicant_county: Applicant_Organization__r?.County__c,
            _bap_applicant_city: PHYSICAL_ADDRESS_CITY__c,
            _bap_applicant_state: PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c,
            _bap_applicant_zip: PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c,
            _bap_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
            _bap_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
            _bap_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
            _bap_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
            _bap_primary_id: Primary_Applicant__r?.Id,
            _bap_primary_recordtype: Primary_Applicant__r?.Record_Type_Name__c,
            _bap_primary_fname: Primary_Applicant__r?.FirstName,
            _bap_primary_lname: Primary_Applicant__r?.LastName,
            _bap_primary_title: Primary_Applicant__r?.Title,
            _bap_primary_email: Primary_Applicant__r?.Email,
            _bap_primary_phone: Primary_Applicant__r?.Phone,
            _bap_alternate_id: Alternate_Applicant__r?.Id,
            _bap_alternate_recordtype: Alternate_Applicant__r?.Record_Type_Name__c, // prettier-ignore
            _bap_alternate_fname: Alternate_Applicant__r?.FirstName,
            _bap_alternate_lname: Alternate_Applicant__r?.LastName,
            _bap_alternate_title: Alternate_Applicant__r?.Title,
            _bap_alternate_email: Alternate_Applicant__r?.Email,
            _bap_alternate_phone: Alternate_Applicant__r?.Phone,
            _bap_district_id: CSB_School_District__r?.Id,
            _bap_district_nces_id: CSB_NCES_ID__c,
            _bap_district_name: CSB_School_District__r?.Name,
            _bap_district_address_1: schoolDistrictStreetAddress1 || "",
            _bap_district_address_2: schoolDistrictStreetAddress2 || "",
            _bap_district_city: CSB_School_District__r?.BillingCity,
            _bap_district_state: CSB_School_District__r?.BillingState,
            _bap_district_zip: CSB_School_District__r?.BillingPostalCode,
            _bap_district_priority: Org_District_Prioritized__c,
            _bap_district_priority_reason: {
              highNeed: Prioritized_as_High_Need__c,
              tribal: Prioritized_as_Tribal__c,
              rural: Prioritized_as_Rural__c,
            },
            _bap_district_self_certify: Self_Certification_Category__c,
            _bap_district_contact_id: School_District_Contact__r?.Id,
            _bap_district_contact_recordtype: School_District_Contact__r?.Record_Type_Name__c, // prettier-ignore
            _bap_district_contact_fname: School_District_Contact__r?.FirstName,
            _bap_district_contact_lname: School_District_Contact__r?.LastName,
            _bap_district_contact_title: School_District_Contact__r?.Title,
            _bap_district_contact_email: School_District_Contact__r?.Email,
            _bap_district_contact_phone: School_District_Contact__r?.Phone,
            _bap_bus_frf_requested: Num_Of_Buses_Requested_From_Application__c,
            _bap_bus_prf_total_costs: Total_Price_All_Buses__c,
            _bap_bus_prf_total_rebate_received: Total_Bus_Rebate_Amount__c,
            _bap_infra_prf_total_costs: Total_All_Eligible_Infrastructure_Costs__c, // prettier-ignore
            _bap_infra_total_rebate_received: Total_Infrastructure_Rebate__c,
            _bap_infra_total_level2_charger: Total_Level_2_Charger_Costs__c,
            _bap_infra_total_dc_fast_charger: Total_DC_Fast_Charger_Costs__c,
            _bap_infra_total_other_costs: Total_Other_Infrastructure_Costs__c,
            _bap_infra_funding: Funding_Alloc_for_Eligible_Infra_Costs__c,
            _bap_requested_funds: Original_CSB_Funds_Requested__c,
            _bap_received_funds: Total_Bus_And_Infrastructure_Rebate__c,
            org_organizations,
            bus_buses,
            infra_infrastructure,
          },
          /** Add custom metadata to track formio submissions from wrapper. */
          metadata: { ...formioCSBMetadata },
          state: "draft",
        };
      })
      .catch((error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2023 Close Out form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }

  if (rebateYear === "2024") {
    // TODO
  }
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function downloadFileFromS3({ rebateYear, req, res }) {
  const { bapComboKeys, query } = req;
  const { mail } = req.user;
  const { formType, comboKey } = req.params;

  // NOTE: included to support EPA API scan
  if (comboKey === formioExampleComboKey) {
    return res.json({});
  }

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to download a file ` +
      `without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(`${formioFormUrl}/storage/s3`, { params: query })
    .then((axiosRes) => axiosRes.data)
    .then((fileMetadata) => res.json(fileMetadata))
    .catch((error) => {
      // NOTE: logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error downloading file from S3.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function uploadFileToS3({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { formType, mongoId, comboKey } = req.params;

  // NOTE: included to support EPA API scan
  if (comboKey === formioExampleComboKey) {
    return res.json({});
  }

  if (Object.keys(body).length === 0) {
    const errorStatus = 400;
    const errorMessage = `Missing required data to upload a new file to S3.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType,
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to upload a file ` +
          `without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      axiosFormio(req)
        .post(`${formioFormUrl}/storage/s3`, body)
        .then((axiosRes) => axiosRes.data)
        .then((fileMetadata) => res.json(fileMetadata))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error uploading file to S3.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((_error) => {
      const formName =
        formType === "frf"
          ? "CSB Application"
          : formType === "prf"
            ? "CSB Payment Request"
            : formType === "crf"
              ? "CSB Close Out"
              : "CSB";

      const logMessage =
        `User with email '${mail}' attempted to upload a file when the ` +
        `${rebateYear} ${formName} form enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} ${formName} form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function deleteFileFromS3({ rebateYear, req, res }) {
  const { bapComboKeys, query } = req;
  const { mail } = req.user;
  const { formType, mongoId, comboKey } = req.params;

  // NOTE: included to support EPA API scan
  if (comboKey === formioExampleComboKey) {
    return res.json({});
  }

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType,
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to delete a file ` +
          `without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      axiosFormio(req)
        .delete(`${formioFormUrl}/storage/s3`, { params: query })
        .then((axiosRes) => axiosRes.data)
        .then((fileMetadata) => res.json(fileMetadata))
        .catch((error) => {
          // NOTE: logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error deleting file from S3.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((_error) => {
      const formName =
        formType === "frf"
          ? "CSB Application"
          : formType === "prf"
            ? "CSB Payment Request"
            : formType === "crf"
              ? "CSB Close Out"
              : "CSB";

      const logMessage =
        `User with email '${mail}' attempted to delete a file when the ` +
        `${rebateYear} ${formName} form enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} ${formName} form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchSubmissionPDF({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { formType, mongoId } = req.params;

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json("");
  }

  /** NOTE: verifyMongoObjectId */
  if (!ObjectId.isValid(mongoId)) {
    const errorStatus = 400;
    const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });

  const formioFormUrl = formUrl[rebateYear][formType];

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} ${formType.toUpperCase()}.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(`${formioFormUrl}/submission/${mongoId}`)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => {
      const projectId = submission.project;
      const formId = submission.form;
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to download a PDF of ` +
          `${rebateYear} ${formType.toUpperCase()} submission '${mongoId}' ` +
          `that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      const headers = {
        "x-allow": `GET:/project/${projectId}/form/${formId}/submission/${mongoId}/download`,
        "x-expire": 3600,
      };

      axiosFormio(req)
        .get(`${formioProjectUrl}/token`, { headers })
        .then((axiosRes) => axiosRes.data)
        .then((json) => {
          const url = `${formioProjectUrl}/form/${formId}/submission/${mongoId}/download?token=${json.key}`;

          axiosFormio(req)
            .get(url, { responseType: "arraybuffer" })
            .then((axiosRes) => axiosRes.data)
            .then((fileData) => {
              const base64String = Buffer.from(fileData).toString("base64");
              res.attachment(`${mongoId}.pdf`);
              res.type("application/pdf");
              res.send(base64String);
            })
            .catch((error) => {
              // NOTE: error is logged in axiosFormio response interceptor
              const errorStatus = error.response?.status || 500;
              const errorMessage = `Error getting Formio submission PDF.`;
              return res.status(errorStatus).json({ message: errorMessage });
            });
        })
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error getting Formio download token.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} ${formType.toUpperCase()} form submission '${mongoId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;

  const { adminOrHelpdeskUser, noBapComboKeys } = checkUserData({ req });

  if (noBapComboKeys) {
    if (adminOrHelpdeskUser) {
      return res.json([]);
    }

    const logMessage =
      `User with email '${mail}' attempted to fetch ${rebateYear} FRF ` +
      `submissions from Formio without any SAM.gov combo keys.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const dataFieldNames = formDataFieldNames[rebateYear]?.["frf"] || [];
  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKeySearchParam = `&data.${comboKeyFieldName}=`;

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `${comboKeySearchParam}${bapComboKeys.join(comboKeySearchParam)}` +
    `&select=_id,modified,state,data.${dataFieldNames.join(",data.")}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Application form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;

  // NOTE: included to support EPA API scan
  if (Object.keys(body).length === 0) {
    return res.json({});
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = body.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!submissionPeriodOpen[rebateYear].frf) {
    const errorStatus = 400;
    const errorMessage = `${rebateYear} CSB Application form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `FRF submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** Add custom metadata to track formio submissions from wrapper. */
  body.metadata = { ...formioCSBMetadata };

  axiosFormio(req)
    .post(`${formioFormUrl}/submission`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error posting Formio ${rebateYear} Application form submission.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json(formioNoUserAccess);
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  Promise.all([
    axiosFormio(req).get(`${formioFormUrl}/submission/${mongoId}`),
    axiosFormio(req).get(formioFormUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submission, schema]) => {
      if (!submission) {
        return res.json(formioNoUserAccess);
      }

      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `FRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json(formioNoUserAccess);
      }

      /** NOTE: 2022 FRF's NCES data is fetched from GitHub */
      const formSchema =
        rebateYear === "2022"
          ? schema
          : applyDevelopmentSchemaModifications({ schema });

      return res.json({
        access: true,
        schema: formSchema,
        submission,
      });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Application form submission '${mongoId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updateFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;
  const submission = req.body;

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json({});
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = submission.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].frf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} FRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "frf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update ${rebateYear} FRF ` +
          `submission '${mongoId}' without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioFormUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio ${rebateYear} Application form submission '${mongoId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((_error) => {
      const logMessage =
        `User with email '${mail}' attempted to update ${rebateYear} FRF ` +
        `submission '${mongoId}' when the CSB FRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} CSB Application form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchPRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;

  const { adminOrHelpdeskUser, noBapComboKeys } = checkUserData({ req });

  if (noBapComboKeys) {
    if (adminOrHelpdeskUser) {
      return res.json([]);
    }

    const logMessage =
      `User with email '${mail}' attempted to fetch ${rebateYear} PRF ` +
      `submissions from Formio without any SAM.gov combo keys.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const dataFieldNames = formDataFieldNames[rebateYear]?.["prf"] || [];
  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKeySearchParam = `&data.${comboKeyFieldName}=`;

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `${comboKeySearchParam}${bapComboKeys.join(comboKeySearchParam)}` +
    `&select=_id,modified,state,data.${dataFieldNames.join(",data.")}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Payment Request form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createPRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { comboKey } = body;

  // NOTE: included to support EPA API scan
  if (Object.keys(body).length === 0) {
    return res.json({});
  }

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!submissionPeriodOpen[rebateYear].prf) {
    const errorStatus = 400;
    const errorMessage = `${rebateYear} CSB Payment Request form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `PRF submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  fetchDataForPRFSubmission({ rebateYear, req, res }).then((submission) => {
    axiosFormio(req)
      .post(`${formioFormUrl}/submission`, submission)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        // NOTE: error is logged in axiosFormio response interceptor
        const errorStatus = error.response?.status || 500;
        const errorMessage = `Error posting Formio ${rebateYear} Payment Request form submission.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchPRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json(formioNoUserAccess);
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const rebateIdFieldName = getRebateIdFieldName({ rebateYear });

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const matchedPRFSubmissions =
    `${formioFormUrl}/submission` +
    `?data.${rebateIdFieldName}=${rebateId}` +
    `&select=_id,data.${comboKeyFieldName}`;

  Promise.all([
    axiosFormio(req).get(matchedPRFSubmissions),
    axiosFormio(req).get(formioFormUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submissions, schema]) => {
      if (submissions.length === 0) {
        return res.json(formioNoUserAccess);
      }

      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `PRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json(formioNoUserAccess);
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /**
       * NOTE: We can't just use the returned submission data here because
       * Formio returns the string literal 'YES' instead of a base64 encoded
       * image string for signature fields when you query for all submissions
       * matching on a field's value (`/submission?data.${rebateIdFieldName}=${rebateId}`).
       * We need to query for a specific submission (e.g. `/submission/${mongoId}`),
       * to have Formio return the correct signature field data.
       */
      axiosFormio(req)
        .get(`${formioFormUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          const formSchema = applyDevelopmentSchemaModifications({ schema });

          return res.json({
            access: true,
            schema: formSchema,
            submission,
          });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Payment Request form submission '${rebateId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updatePRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)
  const { mongoId, submission } = body;

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json({});
  }

  if (!mongoId || !submission) {
    const errorStatus = 400;
    const errorMessage = `Missing required data to update ${rebateYear} PRF submission '${rebateId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = submission.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "prf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update ${rebateYear} PRF ` +
          `submission '${rebateId}' without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioFormUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio ${rebateYear} Payment Request form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((_error) => {
      const logMessage =
        `User with email '${mail}' attempted to update ${rebateYear} PRF ` +
        `submission '${rebateId}' when the CSB PRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} CSB Payment Request form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function deletePRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { mongoId, rebateId, comboKey } = body;

  // NOTE: included to support EPA API scan
  if (Object.keys(body).length === 0) {
    return res.json({});
  }

  const formioFormUrl = formUrl[rebateYear].prf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} PRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  // verify post data includes one of user's BAP combo keys
  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to delete ${rebateYear} PRF ` +
      `submission '${rebateId}' without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /**
   * ensure the BAP status of the corresponding FRF submission is "Edits
   * Requested" before deleting the FRF submission from Formio
   */
  getBapFormSubmissionsStatuses(req, req.bapComboKeys)
    .then((submissions) => {
      const frf = submissions.find((submission) => {
        return (
          submission.Parent_Rebate_ID__c === rebateId &&
          submission.Record_Type_Name__c.startsWith("CSB Funding Request")
        );
      });

      const frfNeedsEdits =
        frf?.Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c ===
        "Edits Requested";

      if (!frfNeedsEdits) {
        const errorStatus = 400;
        const errorMessage = `${rebateYear} Application form submission '${mongoId}' does not need edits.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      axiosFormio(req)
        .delete(`${formioFormUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((response) => {
          const logMessage = `User with email '${mail}' successfully deleted ${rebateYear} PRF submission '${rebateId}'.`;
          log({ level: "info", message: logMessage, req });

          res.json(response);
        })
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error deleting ${rebateYear} Formio Payment Request form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
        });
    })
    .catch((_error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting form submissions statuses from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchCRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;

  const { adminOrHelpdeskUser, noBapComboKeys } = checkUserData({ req });

  if (noBapComboKeys) {
    if (adminOrHelpdeskUser) {
      return res.json([]);
    }

    const logMessage =
      `User with email '${mail}' attempted to fetch ${rebateYear} CRF ` +
      `submissions from Formio without any SAM.gov combo keys.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const dataFieldNames = formDataFieldNames[rebateYear]?.["crf"] || [];
  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKeySearchParam = `&data.${comboKeyFieldName}=`;

  const formioFormUrl = formUrl[rebateYear].crf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} CRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `${comboKeySearchParam}${bapComboKeys.join(comboKeySearchParam)}` +
    `&select=_id,modified,state,data.${dataFieldNames.join(",data.")}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Close Out form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createCRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { comboKey } = body;

  // NOTE: included to support EPA API scan
  if (Object.keys(body).length === 0) {
    return res.json({});
  }

  const formioFormUrl = formUrl[rebateYear].crf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} CRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!submissionPeriodOpen[rebateYear].crf) {
    const errorStatus = 400;
    const errorMessage = `${rebateYear} CSB Close Out form enrollment period is closed.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `CRF submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  fetchDataForCRFSubmission({ rebateYear, req, res }).then((submission) => {
    axiosFormio(req)
      .post(`${formioFormUrl}/submission`, submission)
      .then((axiosRes) => axiosRes.data)
      .then((submission) => res.json(submission))
      .catch((error) => {
        // NOTE: error is logged in axiosFormio response interceptor
        const errorStatus = error.response?.status || 500;
        const errorMessage = `Error posting Formio ${rebateYear} Close Out form submission.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchCRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json(formioNoUserAccess);
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const rebateIdFieldName = getRebateIdFieldName({ rebateYear });

  const formioFormUrl = formUrl[rebateYear].crf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} CRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const matchedCRFSubmissions =
    `${formioFormUrl}/submission` +
    `?data.${rebateIdFieldName}=${rebateId}` +
    `&select=_id,data.${comboKeyFieldName}`;

  Promise.all([
    axiosFormio(req).get(matchedCRFSubmissions),
    axiosFormio(req).get(formioFormUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submissions, schema]) => {
      if (submissions.length === 0) {
        return res.json(formioNoUserAccess);
      }

      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `CRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json(formioNoUserAccess);
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /**
       * NOTE: We can't just use the returned submission data here because
       * Formio returns the string literal 'YES' instead of a base64 encoded
       * image string for signature fields when you query for all submissions
       * matching on a field's value (`/submission?data.${rebateIdFieldName}=${rebateId}`).
       * We need to query for a specific submission (e.g. `/submission/${mongoId}`),
       * to have Formio return the correct signature field data.
       */
      axiosFormio(req)
        .get(`${formioFormUrl}/submission/${mongoId}`)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => {
          const formSchema = applyDevelopmentSchemaModifications({ schema });

          return res.json({
            access: true,
            schema: formSchema,
            submission,
          });
        });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Close Out form submission '${rebateId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updateCRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)
  const { mongoId, submission } = body;

  // NOTE: included to support EPA API scan
  if (rebateId === formioExampleRebateId) {
    return res.json({});
  }

  if (!mongoId || !submission) {
    const errorStatus = 400;
    const errorMessage = `Missing required data to update ${rebateYear} CRF submission '${rebateId}'.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = submission.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].crf;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} CRF.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  checkFormSubmissionPeriodAndBapStatus({
    rebateYear,
    formType: "crf",
    mongoId,
    comboKey,
    req,
  })
    .then(() => {
      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to update ${rebateYear} CRF ` +
          `submission '${rebateId}' without a matching BAP combo key.`;
        log({ level: "error", message: logMessage, req });

        const errorStatus = 401;
        const errorMessage = `Unauthorized.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** NOTE: verifyMongoObjectId */
      if (mongoId && !ObjectId.isValid(mongoId)) {
        const errorStatus = 400;
        const errorMessage = `MongoDB ObjectId validation error for: '${mongoId}'.`;
        return res.status(errorStatus).json({ message: errorMessage });
      }

      /** Add custom metadata to track formio submissions from wrapper. */
      submission.metadata = {
        ...submission.metadata,
        ...formioCSBMetadata,
      };

      axiosFormio(req)
        .put(`${formioFormUrl}/submission/${mongoId}`, submission)
        .then((axiosRes) => axiosRes.data)
        .then((submission) => res.json(submission))
        .catch((error) => {
          // NOTE: error is logged in axiosFormio response interceptor
          const errorStatus = error.response?.status || 500;
          const errorMessage = `Error updating Formio ${rebateYear} Close Out form submission '${rebateId}'.`;
          return res.status(errorStatus).json({ message: errorMessage });
          // return res.status(errorStatus).json(error.response.data);
        });
    })
    .catch((_error) => {
      const logMessage =
        `User with email '${mail}' attempted to update ${rebateYear} CRF ` +
        `submission '${rebateId}' when the CSB CRF enrollment period was closed.`;
      log({ level: "error", message: logMessage, req });

      const errorStatus = 400;
      const errorMessage = `${rebateYear} CSB Close Out form enrollment period is closed.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchChangeRequests({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;

  const { adminOrHelpdeskUser, noBapComboKeys } = checkUserData({ req });

  if (noBapComboKeys) {
    if (adminOrHelpdeskUser) {
      return res.json([]);
    }

    const logMessage =
      `User with email '${mail}' attempted to fetch ${rebateYear} Change ` +
      `Request form submissions from Formio without any SAM.gov combo keys.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const dataFieldNames = formDataFieldNames[rebateYear]?.["change"] || [];
  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKeySearchParam = `&data.${comboKeyFieldName}=`;

  const formioFormUrl = formUrl[rebateYear].change;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} Change Request form.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  const submissionsUrl =
    `${formioFormUrl}/submission` +
    `?sort=-modified` +
    `&limit=1000000` +
    `${comboKeySearchParam}${bapComboKeys.join(comboKeySearchParam)}` +
    `&select=_id,modified,state,data.${dataFieldNames.join(",data.")}`;

  axiosFormio(req)
    .get(submissionsUrl)
    .then((axiosRes) => axiosRes.data)
    .then((submissions) => res.json(submissions))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Change Request form submissions.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchChangeRequestSchema({ rebateYear, req, res }) {
  const formioFormUrl = formUrl[rebateYear].change;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} Change Request form.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  axiosFormio(req)
    .get(formioFormUrl)
    .then((axiosRes) => axiosRes.data)
    .then((schema) => res.json(schema))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Change Request form schema.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createChangeRequest({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;

  // NOTE: included to support EPA API scan
  if (Object.keys(body).length === 0) {
    return res.json({});
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });
  const comboKey = body.data?.[comboKeyFieldName];

  const formioFormUrl = formUrl[rebateYear].change;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} Change Request form.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  if (!bapComboKeys.includes(comboKey)) {
    const logMessage =
      `User with email '${mail}' attempted to post a new ${rebateYear} ` +
      `Change Request form submission without a matching BAP combo key.`;
    log({ level: "error", message: logMessage, req });

    const errorStatus = 401;
    const errorMessage = `Unauthorized.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  /** Add custom metadata to track formio submissions from wrapper. */
  body.metadata = { ...formioCSBMetadata };

  axiosFormio(req)
    .post(`${formioFormUrl}/submission`, body)
    .then((axiosRes) => axiosRes.data)
    .then((submission) => res.json(submission))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error posting Formio ${rebateYear} Change Request form submission.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {RebateYear} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchChangeRequest({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;

  // NOTE: included to support EPA API scan
  if (mongoId === formioExampleMongoId) {
    return res.json(formioNoUserAccess);
  }

  const comboKeyFieldName = getComboKeyFieldName({ rebateYear });

  const formioFormUrl = formUrl[rebateYear].change;

  if (!formioFormUrl) {
    const errorStatus = 400;
    const errorMessage = `Formio form URL does not exist for ${rebateYear} Change Request form.`;
    return res.status(errorStatus).json({ message: errorMessage });
  }

  Promise.all([
    axiosFormio(req).get(`${formioFormUrl}/submission/${mongoId}`),
    axiosFormio(req).get(formioFormUrl),
  ])
    .then((axiosResponses) => axiosResponses.map((axiosRes) => axiosRes.data))
    .then(([submission, schema]) => {
      if (!submission) {
        return res.json(formioNoUserAccess);
      }

      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `Change Request form submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json(formioNoUserAccess);
      }

      const formSchema = applyDevelopmentSchemaModifications({ schema });

      return res.json({
        access: true,
        schema: formSchema,
        submission,
      });
    })
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Change Request form submission '${mongoId}'.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

module.exports = {
  checkVIN,
  searchNcesData,
  getRebateContacts,
  getRebateIdFieldName,
  //
  downloadFileFromS3,
  uploadFileToS3,
  deleteFileFromS3,
  //
  fetchSubmissionPDF,
  //
  fetchFRFSubmissions,
  createFRFSubmission,
  fetchFRFSubmission,
  updateFRFSubmission,
  //
  fetchPRFSubmissions,
  createPRFSubmission,
  fetchPRFSubmission,
  updatePRFSubmission,
  deletePRFSubmission,
  //
  fetchCRFSubmissions,
  createCRFSubmission,
  fetchCRFSubmission,
  updateCRFSubmission,
  //
  fetchChangeRequests,
  fetchChangeRequestSchema,
  createChangeRequest,
  fetchChangeRequest,
};
