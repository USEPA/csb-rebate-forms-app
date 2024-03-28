const express = require("express");
const ObjectId = require("mongodb").ObjectId;
// ---
const {
  axiosFormio,
  formUrl,
  submissionPeriodOpen,
  formioCSBMetadata,
} = require("../config/formio");
const {
  getBapFormSubmissionsStatuses,
  getBapDataFor2022PRF,
  getBapDataFor2023PRF,
  checkFormSubmissionPeriodAndBapStatus,
} = require("../utilities/bap");
const log = require("./logger");

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 */
function getComboKeyFieldName({ rebateYear }) {
  return rebateYear === "2022"
    ? "bap_hidden_entity_combo_key"
    : rebateYear === "2023"
    ? "_bap_entity_combo_key"
    : "";
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 */
function getRebateIdFieldName({ rebateYear }) {
  return rebateYear === "2022"
    ? "hidden_bap_rebate_id"
    : rebateYear === "2023"
    ? "_bap_rebate_id"
    : "";
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
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
   *  frfFormModified: ?string
   * }} */
  const {
    email,
    title,
    name,
    entity,
    comboKey,
    rebateId,
    frfReviewItemId,
    frfFormModified,
  } = req.body;

  const {
    Id: entityId,
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
            hidden_application_form_modified: frfFormModified,
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
      .catch((error) => {
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
          School_District_Prioritized__c,
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
            const { Relationship_Type__c, Contact__r } =
              frf2023BusRecordsContact;

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
            } = Account;

            const jsonOrg = frf2023RecordJson.data.organizations.find(
              (item) => item.org_orgName === orgName,
            );

            const existingBusOwner = Relationship_Type__c === existingBusOwnerType; // prettier-ignore
            const newBusOwner = Relationship_Type__c === newBusOwnerType;

            /**
             * Ensure the org exists in the 2023 FRF submission's
             * "organizations" array.
             */
            if (jsonOrg) {
              /**
               * If the org has already been added, update org_type as needed
               * and and advance to the next org in the loop.
               */
              if (array.some((item) => item.org_id === orgId)) {
                const org = array.find((item) => item.org_id === orgId);

                if (existingBusOwner) org.org_type.existingBusOwner = true;
                if (newBusOwner) org.org_type.newBusOwner = true;

                return array;
              }

              const [orgStreetAddress1, orgStreetAddress2] = (
                BillingStreet ?? "\n"
              ).split("\n");

              array.push({
                org_number: jsonOrg.org_number,
                org_type: {
                  existingBusOwner,
                  newBusOwner,
                  // privateFleet: false,
                },
                // _org_typeCombined: "", // NOTE: 'Existing Bus Owner, New Bus Owner'
                org_id: orgId,
                org_name: orgName,
                org_contact_id: contactId,
                org_contactFName: FirstName,
                org_contactLName: LastName,
                org_contactTitle: Title,
                org_contactEmail: Email,
                org_contactPhone: Phone,
                org_address1: orgStreetAddress1,
                org_address2: orgStreetAddress2,
                org_county: County__c,
                org_city: BillingCity,
                org_state: {
                  name: BillingState,
                  // abbreviation: "",
                },
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
            _application_form_modified: frfFormModified,
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
            _bap_applicant_organization_id: entityId,
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
            _bap_district_priority: School_District_Prioritized__c,
            _bap_district_self_certify: Self_Certification_Category__c,
            _bap_district_priority_reason: {
              highNeed: Prioritized_as_High_Need__c,
              tribal: Prioritized_as_Tribal__c,
              rural: Prioritized_as_Rural__c,
            },
            _bad_district_contact_id: School_District_Contact__r?.Id,
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
      .catch((error) => {
        // NOTE: logged in bap verifyBapConnection
        const errorStatus = 500;
        const errorMessage = `Error getting data for a new 2023 Payment Request form submission from the BAP.`;
        return res.status(errorStatus).json({ message: errorMessage });
      });
  }
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function uploadS3FileMetadata({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { formType, mongoId, comboKey } = req.params;

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
    .catch((error) => {
      const formName =
        formType === "frf"
          ? "CSB Application"
          : formType === "prf"
          ? "CSB Payment Request"
          : formType === "cof"
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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function downloadS3FileMetadata({ rebateYear, req, res }) {
  const { bapComboKeys, query } = req;
  const { mail } = req.user;
  const { formType, comboKey } = req.params;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

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
    comboKeySearchParam +
    `${bapComboKeys.join(comboKeySearchParam)}`;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;

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
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `FRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
      }

      return res.json({
        userAccess: true,
        formSchema: { url: formioFormUrl, json: schema },
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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updateFRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;
  const submission = req.body;

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
    .catch((error) => {
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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchPRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

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
    comboKeySearchParam +
    `${bapComboKeys.join(comboKeySearchParam)}`;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createPRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { comboKey } = body;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchPRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)

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
      const submission = submissions[0];
      const mongoId = submission._id;
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `PRF submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
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
          return res.json({
            userAccess: true,
            formSchema: { url: formioFormUrl, json: schema },
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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function updatePRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { rebateId } = req.params; // CSB Rebate ID (6 digits)
  const { mongoId, submission } = body;

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
    .catch((error) => {
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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function deletePRFSubmission({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;
  const { mongoId, rebateId, comboKey } = body;

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
    .catch((error) => {
      // NOTE: logged in bap verifyBapConnection
      const errorStatus = 500;
      const errorMessage = `Error getting form submissions statuses from the BAP.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchCRFSubmissions({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

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
    comboKeySearchParam +
    `${bapComboKeys.join(comboKeySearchParam)}`;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchChangeRequests({ rebateYear, req, res }) {
  const { bapComboKeys } = req;

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
    comboKeySearchParam +
    `${bapComboKeys.join(comboKeySearchParam)}`;

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
 * @param {'2022' | '2023'} param.rebateYear
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
    .then((schema) => res.json({ url: formioFormUrl, json: schema }))
    .catch((error) => {
      // NOTE: error is logged in axiosFormio response interceptor
      const errorStatus = error.response?.status || 500;
      const errorMessage = `Error getting Formio ${rebateYear} Change Request form schema.`;
      return res.status(errorStatus).json({ message: errorMessage });
    });
}

/**
 * @param {Object} param
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function createChangeRequest({ rebateYear, req, res }) {
  const { bapComboKeys, body } = req;
  const { mail } = req.user;

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
 * @param {'2022' | '2023'} param.rebateYear
 * @param {express.Request} param.req
 * @param {express.Response} param.res
 */
function fetchChangeRequest({ rebateYear, req, res }) {
  const { bapComboKeys } = req;
  const { mail } = req.user;
  const { mongoId } = req.params;

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
      const comboKey = submission.data?.[comboKeyFieldName];

      if (!bapComboKeys.includes(comboKey)) {
        const logMessage =
          `User with email '${mail}' attempted to access ${rebateYear} ` +
          `Change Request form submission '${mongoId}' that they do not have access to.`;
        log({ level: "warn", message: logMessage, req });

        return res.json({
          userAccess: false,
          formSchema: null,
          submission: null,
        });
      }

      return res.json({
        userAccess: true,
        formSchema: { url: formioFormUrl, json: schema },
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
  uploadS3FileMetadata,
  downloadS3FileMetadata,
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
  //
  fetchChangeRequests,
  fetchChangeRequestSchema,
  createChangeRequest,
  fetchChangeRequest,
};
