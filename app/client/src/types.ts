import { type FormType, type Submission } from "@formio/react";

export type RebateYear = "2022" | "2023" | "2024";

export type CSBFormType = "frf" | "prf" | "crf";

export type PublicConfigData = {
  loginEnabled: boolean;
  staticContent: {
    siteAlert: string;
    scheduledMaintenance: string;
    helpdeskIntro: string;
    allRebatesIntro: string;
    allRebatesOutro: string;
    newFRFDialog: string;
    draftFRFIntro: string;
    submittedFRFIntro: string;
    draftPRFIntro: string;
    submittedPRFIntro: string;
    draftCRFIntro: string;
    submittedCRFIntro: string;
    newChangeIntro: string;
    submittedChangeIntro: string;
  };
};

export type PrivateConfigData = {
  formioBaseUrl: string;
  formioProjectName: string;
  formioPremiumKey: string;
  jwtExpirationSeconds: number;
  rebateYear: RebateYear;
  submissionPeriodOpen: {
    2022: { frf: boolean; prf: boolean; crf: boolean };
    2023: { frf: boolean; prf: boolean; crf: boolean };
    2024: { frf: boolean; prf: boolean; crf: boolean };
  };
};

export type UserData = {
  mail: string;
  memberof: string;
  exp: number;
};

export type BapSamEntity = {
  attributes: { type: "Data_Staging__c"; url: string };
  Id: string;
  ENTITY_COMBO_KEY__c: string;
  UNIQUE_ENTITY_ID__c: string;
  ENTITY_EFT_INDICATOR__c: string | null;
  ENTITY_STATUS__c: "Active" | string | null;
  EXCLUSION_STATUS_FLAG__c: "D" | null;
  DEBT_SUBJECT_TO_OFFSET_FLAG__c: "Y" | "N" | null;
  LEGAL_BUSINESS_NAME__c: string;
  PHYSICAL_ADDRESS_LINE_1__c: string;
  PHYSICAL_ADDRESS_LINE_2__c: string | null;
  PHYSICAL_ADDRESS_CITY__c: string;
  PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c: string;
  PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c: string;
  PHYSICAL_ADDRESS_ZIP_CODE_4__c: string;
  ELEC_BUS_POC_EMAIL__c: string | null;
  ELEC_BUS_POC_NAME__c: string | null;
  ELEC_BUS_POC_TITLE__c: string | null;
  ALT_ELEC_BUS_POC_EMAIL__c: string | null;
  ALT_ELEC_BUS_POC_NAME__c: string | null;
  ALT_ELEC_BUS_POC_TITLE__c: string | null;
  GOVT_BUS_POC_EMAIL__c: string | null;
  GOVT_BUS_POC_NAME__c: string | null;
  GOVT_BUS_POC_TITLE__c: string | null;
  ALT_GOVT_BUS_POC_EMAIL__c: string | null;
  ALT_GOVT_BUS_POC_NAME__c: string | null;
  ALT_GOVT_BUS_POC_TITLE__c: string | null;
};

export type BapSamData =
  | { results: false; entities: [] }
  | { results: true; entities: BapSamEntity[] };

export type BapFormSubmission = {
  attributes: { type: "Order_Request__c"; url: string };
  Id: string;
  UEI_EFTI_Combo_Key__c: string; // UEI + EFTI combo key
  CSB_Form_ID__c: string; // MongoDB ObjectId string
  CSB_Modified_Full_String__c: string; // ISO 8601 date time string
  CSB_Review_Item_ID__c: string; // CSB Rebate ID with form/version ID (9 digits)
  Parent_Rebate_ID__c: string; // CSB Rebate ID (6 digits)
  Record_Type_Name__c: /*
   * NOTE: 2022 submissions don't have a year in their record type name, but
   * we'll account for it here in case the BAP switches to using it in the future.
   */
  | "CSB Funding Request" // NOTE: 2022 submissions
    | "CSB Payment Request" // NOTE: 2022 submissions
    | "CSB Close Out Request" // NOTE: 2022 submissions
    | "CSB Funding Request 2022" // NOTE: not currently used
    | "CSB Payment Request 2022" // NOTE: not currently used
    | "CSB Close Out Request 2022" // NOTE: not currently used
    | "CSB Funding Request 2023"
    | "CSB Payment Request 2023"
    | "CSB Close Out Request 2023"
    | "CSB Funding Request 2024"
    | "CSB Payment Request 2024"
    | "CSB Close Out Request 2024";
  Rebate_Program_Year__c: null | RebateYear;
  Parent_CSB_Rebate__r: {
    CSB_Funding_Request_Status__c: string;
    CSB_Payment_Request_Status__c: string;
    CSB_Closeout_Request_Status__c: string;
    Reimbursement_Needed__c: boolean;
    attributes: { type: string; url: string };
  };
};

export type BapFormSubmissions = {
  2022: {
    frfs: BapFormSubmission[];
    prfs: BapFormSubmission[];
    crfs: BapFormSubmission[];
  };
  2023: {
    frfs: BapFormSubmission[];
    prfs: BapFormSubmission[];
    crfs: BapFormSubmission[];
  };
  2024: {
    frfs: BapFormSubmission[];
    prfs: BapFormSubmission[];
    crfs: BapFormSubmission[];
  };
};

export type BapSubmissionData = {
  modified: string | null; // ISO 8601 date time string
  comboKey: string | null; // UEI + EFTI combo key
  mongoId: string | null; // MongoDB Object ID
  rebateId: string | null; // CSB Rebate ID (6 digits)
  reviewItemId: string | null; // CSB Rebate ID with form/version ID (9 digits)
  status: string | null;
  reimbursementNeeded: boolean;
};

export type FormioSubmission = Submission & {
  _id: string; // MongoDB ObjectId string – submission ID
  form: string; // MongoDB ObjectId string – form ID
  modified: string; // ISO 8601 date time string
};

type FormioFRF2022DashboardDataFields = {
  bap_hidden_entity_combo_key: string;
  sam_hidden_applicant_name: string;
  applicantUEI: string;
  applicantEfti: string;
  applicantEfti_display: string;
  applicantOrganizationName: string;
  schoolDistrictName: string;
  schoolDistrictState: string;
  last_updated_by: string;
};

type FormioFRF2022FormDataFields = FormioFRF2022DashboardDataFields & {
  [field: string]: unknown;
  hidden_current_user_email: string;
  hidden_current_user_title: string;
  hidden_current_user_name: string;
  sam_hidden_applicant_email: string;
  sam_hidden_applicant_title: string;
  sam_hidden_applicant_efti: string;
  sam_hidden_applicant_uei: string;
  sam_hidden_applicant_organization_name: string;
  sam_hidden_applicant_street_address_1: string;
  sam_hidden_applicant_street_address_2: string;
  sam_hidden_applicant_city: string;
  sam_hidden_applicant_state: string;
  sam_hidden_applicant_zip_code: string;
};

type FormioPRF2022DashboardDataFields = {
  bap_hidden_entity_combo_key: string;
  hidden_current_user_email: string;
  hidden_bap_rebate_id: string;
  applicantName: string;
  schoolDistrictName: string;
};

type FormioPRF2022FormDataFields = FormioPRF2022DashboardDataFields & {
  [field: string]: unknown;
  hidden_application_form_modified: string; // ISO 8601 date time string,
  hidden_current_user_title: string;
  hidden_current_user_name: string;
  hidden_sam_uei: string;
  hidden_sam_efti: string;
  hidden_sam_elec_bus_poc_email: string | null;
  hidden_sam_alt_elec_bus_poc_email: string | null;
  hidden_sam_govt_bus_poc_email: string | null;
  hidden_sam_alt_govt_bus_poc_email: string | null;
  hidden_bap_district_id: string;
  hidden_bap_primary_name: string;
  hidden_bap_primary_title: string;
  hidden_bap_primary_phone_number: string;
  hidden_bap_primary_email: string;
  hidden_bap_alternate_name: string;
  hidden_bap_alternate_title: string;
  hidden_bap_alternate_phone_number: string;
  hidden_bap_alternate_email: string;
  hidden_bap_org_name: string;
  hidden_bap_district_name: string;
  hidden_bap_fleet_name: string | null;
  hidden_bap_prioritized: boolean;
  hidden_bap_requested_funds: number;
  hidden_bap_infra_max_rebate: number;
  busInfo: {
    busNum: number;
    oldBusNcesDistrictId: string;
    oldBusVin: string;
    oldBusModelYear: string;
    oldBusFuelType: string;
    newBusFuelType: string;
    hidden_bap_max_rebate: number;
  }[];
  purchaseOrders: [];
};

type FormioCRF2022DashboardDataFields = {
  bap_hidden_entity_combo_key: string;
  hidden_current_user_email: string;
  hidden_bap_rebate_id: string;
  schoolDistrictName: string;
};

type FormioCRF2022FormDataFields = FormioCRF2022DashboardDataFields & {
  [field: string]: unknown;
  hidden_prf_modified: string; // ISO 8601 date time string
  hidden_current_user_title: string;
  hidden_current_user_name: string;
  hidden_sam_uei: string;
  hidden_sam_efti: string;
  hidden_sam_elec_bus_poc_email: string | null;
  hidden_sam_alt_elec_bus_poc_email: string | null;
  hidden_sam_govt_bus_poc_email: string | null;
  hidden_sam_alt_govt_bus_poc_email: string | null;
  hidden_bap_district_id: string;
  hidden_bap_district_name: string;
  hidden_bap_primary_fname: string;
  hidden_bap_primary_lname: string;
  hidden_bap_primary_title: string;
  hidden_bap_primary_phone_number: string;
  hidden_bap_primary_email: string;
  hidden_bap_alternate_fname: string;
  hidden_bap_alternate_lname: string;
  hidden_bap_alternate_title: string;
  hidden_bap_alternate_phone_number: string;
  hidden_bap_alternate_email: string;
  hidden_bap_org_name: string;
  hidden_bap_fleet_name: string;
  hidden_bap_fleet_address: string;
  hidden_bap_fleet_city: string;
  hidden_bap_fleet_state: string;
  hidden_bap_fleet_zip: string;
  hidden_bap_fleet_contact_name: string;
  hidden_bap_fleet_contact_title: string;
  hidden_bap_fleet_phone: string;
  hidden_bap_fleet_email: string;
  hidden_bap_prioritized: boolean;
  hidden_bap_requested_funds: number;
  hidden_bap_received_funds: number;
  hidden_bap_prf_infra_max_rebate: number | null;
  hidden_bap_buses_requested_app: number;
  hidden_bap_total_bus_costs_prf: number;
  hidden_bap_total_bus_rebate_received: number;
  hidden_bap_total_infra_costs_prf: number | null;
  hidden_bap_total_infra_rebate_received: number | null;
  hidden_bap_total_infra_level2_charger: number | null;
  hidden_bap_total_infra_dc_fast_charger: number | null;
  hidden_bap_total_infra_other_costs: number | null;
  hidden_bap_district_contact_fname: string;
  hidden_bap_district_contact_lname: string;
  busInfo: {
    busNum: number;
    oldBusNcesDistrictId: string;
    oldBusVin: string;
    oldBusModelYear: string;
    oldBusFuelType: string;
    oldBusEstimatedRemainingLife: number;
    oldBusExclude: boolean;
    hidden_prf_oldBusExclude: boolean;
    newBusDealer: string;
    newBusFuelType: string;
    hidden_prf_newBusFuelType: string;
    newBusMake: string;
    hidden_prf_newBusMake: string;
    newBusMakeOther: string | null;
    hidden_prf_newBusMakeOther: string | null;
    newBusModel: string;
    hidden_prf_newBusModel: string;
    newBusModelYear: string;
    hidden_prf_newBusModelYear: string;
    newBusGvwr: number;
    hidden_prf_newBusGvwr: number;
    newBusPurchasePrice: number;
    hidden_prf_newBusPurchasePrice: number;
    hidden_prf_rebate: number;
  }[];
  signatureName: string;
};

type FormioChange2022DashboardDataFields = {
  _request_form: CSBFormType;
  _bap_rebate_id: string;
  _mongo_id: string;
  _user_email: string;
  request_type: {
    label: string;
    value: string;
  };
};

type FormioChange2022FormDataFields = FormioChange2022DashboardDataFields & {
  [field: string]: unknown;
  _bap_entity_combo_key: string;
  _user_title: string;
  _user_name: string;
};

type FormioFRF2023DashboardDataFields = {
  _user_email: string;
  _bap_entity_combo_key: string;
  _bap_applicant_name: string;
  appInfo_uei: string;
  appInfo_efti: string;
  appInfo_orgName: string;
  _formio_schoolDistrictName: string;
  org_district_orgName: string;
  org_district_state: string;
  org_district_prioritized: string;
  org_district_povertyRate: string;
};

type FormioFRF2023FormDataFields = FormioFRF2023DashboardDataFields & {
  [field: string]: unknown;
  _user_title: string;
  _user_name: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
};

type FormioPRF2023DashboardDataFields = {
  _user_email: string;
  _bap_entity_combo_key: string;
  _bap_rebate_id: string;
  _bap_applicant_name: string;
  _bap_district_name: string;
  _bap_district_state: string;
  _bap_district_priority: string;
  _bap_district_self_certify: string;
};

type FormioPRF2023FormDataFields = FormioPRF2023DashboardDataFields & {
  [field: string]: unknown;
  _application_form_modified: string;
  _user_title: string;
  _user_name: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_id: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_county: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
  _bap_elec_bus_poc_email: string | null;
  _bap_alt_elec_bus_poc_email: string | null;
  _bap_govt_bus_poc_email: string | null;
  _bap_alt_govt_bus_poc_email: string | null;
  _bap_primary_id: string;
  _bap_primary_fname: string;
  _bap_primary_lname: string;
  _bap_primary_title: string;
  _bap_primary_email: string;
  _bap_primary_phone: string;
  _bap_alternate_id: string | null;
  _bap_alternate_fname: string | null;
  _bap_alternate_lname: string | null;
  _bap_alternate_title: string | null;
  _bap_alternate_email: string | null;
  _bap_alternate_phone: string | null;
  _bap_district_id: string;
  _bap_district_nces_id: string;
  _bap_district_address_1: string;
  _bap_district_address_2: string;
  _bap_district_city: string;
  _bap_district_zip: string;
  _bap_district_priority_reason: {
    highNeed: boolean;
    tribal: boolean;
    rural: boolean;
  };
  _bap_district_contact_id: string;
  _bap_district_contact_fname: string;
  _bap_district_contact_lname: string;
  _bap_district_contact_title: string;
  _bap_district_contact_email: string;
  _bap_district_contact_phone: string;
  org_organizations: {
    org_number: number;
    org_type: {
      existingBusOwner: boolean;
      newBusOwner: boolean;
      privateFleet: boolean;
    };
    _org_id: string;
    org_name: string;
    _org_contact_id: string;
    org_contact_fname: string;
    org_contact_lname: string;
    org_contact_title: string;
    org_contact_email: string;
    org_contact_phone: string;
    org_address_1: string;
    org_address_2: string;
    org_county: string;
    org_city: string;
    org_state: { name: string };
    org_zip: string;
  }[];
  bus_buses: {
    bus_busNumber: number;
    bus_existingOwner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    bus_existingVin: string;
    bus_existingFuelType: string;
    bus_existingGvwr: number;
    bus_existingOdometer: number;
    bus_existingModel: string;
    bus_existingModelYear: string;
    bus_existingNcesId: string;
    bus_existingManufacturer: string;
    bus_existingManufacturerOther: string | null;
    bus_existingAnnualFuelConsumption: number;
    bus_existingAnnualMileage: number;
    bus_existingRemainingLife: number;
    bus_existingIdlingHours: number;
    bus_newOwner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    bus_newFuelType: string;
    bus_newGvwr: number;
    _bus_maxRebate: number;
    _bus_newADAfromFRF: boolean;
  }[];
};

type FormioCRF2023DashboardDataFields = {
  _user_email: string;
  _bap_entity_combo_key: string;
  _bap_rebate_id: string;
  _bap_applicant_name: string;
  _bap_district_name: string;
  _bap_district_state: string;
  _bap_district_priority: string;
  _bap_district_self_certify: string;
};

type FormioCRF2023FormDataFields = FormioCRF2023DashboardDataFields & {
  [field: string]: unknown;
  _user_title: string;
  _user_name: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_id: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_county: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
  _bap_elec_bus_poc_email: string | null;
  _bap_alt_elec_bus_poc_email: string | null;
  _bap_govt_bus_poc_email: string | null;
  _bap_alt_govt_bus_poc_email: string | null;
  _bap_primary_id: string;
  _bap_primary_recordtype: string;
  _bap_primary_fname: string;
  _bap_primary_lname: string;
  _bap_primary_title: string;
  _bap_primary_email: string;
  _bap_primary_phone: string;
  _bap_alternate_id: string | null;
  _bap_alternate_recordtype: string | null;
  _bap_alternate_fname: string | null;
  _bap_alternate_lname: string | null;
  _bap_alternate_title: string | null;
  _bap_alternate_email: string | null;
  _bap_alternate_phone: string | null;
  _bap_district_id: string;
  _bap_district_nces_id: string;
  _bap_district_address_1: string;
  _bap_district_address_2: string;
  _bap_district_city: string;
  _bap_district_zip: string;
  _bap_district_priority_reason: {
    highNeed: boolean;
    tribal: boolean;
    rural: boolean;
  };
  _bap_district_contact_id: string;
  _bap_district_contact_recordtype: string;
  _bap_district_contact_fname: string;
  _bap_district_contact_lname: string;
  _bap_district_contact_title: string;
  _bap_district_contact_email: string;
  _bap_district_contact_phone: string;
  _bap_bus_frf_requested: number;
  _bap_bus_prf_total_costs: number;
  _bap_bus_prf_total_rebate_received: number;
  _bap_infra_prf_total_costs: number;
  _bap_infra_total_rebate_received: number;
  _bap_infra_total_level2_charger: number;
  _bap_infra_total_dc_fast_charger: number;
  _bap_infra_total_other_costs: number;
  _bap_infra_funding: number;
  org_organizations: {
    org_number: number;
    org_type: {
      existingBusOwner: boolean;
      newBusOwner: boolean;
      privateFleet: boolean;
    };
    _org_id: string;
    _org_name: string;
    _org_address_1: string;
    _org_address_2: string;
    _org_county: string;
    _org_city: string;
    _org_state: string;
    _org_zip: string;
    _org_contact_id: string;
    _org_contact_recordtype: string;
    _org_contact_fname: string;
    _org_contact_lname: string;
    _org_contact_title: string;
    _org_contact_email: string;
    _org_contact_phone: string;
  }[];
  bus_buses: {
    bus_number: number;
    bus_existing_excluded: boolean;
    _bus_existing_excluded: boolean;
    bus_existing_owner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    bus_existing_vin: string;
    bus_existing_fuel_type: string;
    bus_existing_gvwr: number;
    bus_existing_odometer: number;
    bus_existing_model: string;
    bus_existing_model_year: number;
    bus_existing_nces_id: string;
    bus_existing_manufacturer: string;
    bus_existing_manufacturer_other: string | null;
    bus_existing_remaining_life: number;
    bus_existing_annual_fuel_consumption: number;
    bus_existing_annual_mileage: number;
    bus_existing_idling_hours: number;
    bus_new_owner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    _bus_new_purchase_price: number;
    _bus_new_fuel_type: string;
    _bus_new_gvwr: number;
    _bus_new_ada: boolean;
    _bus_new_manufacturer: string;
    _bus_new_manufacturer_other: string | null;
    _bus_new_model: string;
    _bus_new_epa_carb: string;
    _bus_new_model_year: number;
    bus_rebate_shipping: number;
    bus_rebate_shipping_costs: number;
    bus_rebate_ada: boolean;
    bus_rebate_ada_costs: number;
    _bus_funding_amount: number;
  }[];
  infra_infrastructure: {
    infra_type: string;
    infra_other_type: string | null;
    infra_other_desc: string | null;
    infra_other_cost: number | null;
    infra_evse_max_output_power: number | null;
    infra_evse_manufacturer: string | null;
    infra_evse_manufacturer_other: string | null;
    infra_evse_model: string | null;
    infra_evse_manufacture_date: string | null;
    infra_evse_number_plugs: number | null;
    infra_evse_bidirectional_charging: string;
    infra_evse_bidirectional_planning: boolean;
    infra_evse_energy_star: boolean;
    infra_evse_baba_compliant: boolean;
    infra_evse_quantity: number | null;
    infra_evse_cost_charger: number | null;
    infra_evse_includes_installion: boolean;
    infra_owner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    infra_address: string;
    infra_city: string;
    infra_state: string;
    infra_zip: string;
    infra_county: string;
  }[];
};

type FormioChange2023DashboardDataFields = {
  _request_form: CSBFormType;
  _bap_rebate_id: string;
  _mongo_id: string;
  _user_email: string;
  request_type: {
    label: string;
    value: string;
  };
};

type FormioChange2023FormDataFields = FormioChange2023DashboardDataFields & {
  [field: string]: unknown;
  _bap_entity_combo_key: string;
  _user_title: string;
  _user_name: string;
};

type FormioFRF2024DashboardDataFields = {
  _user_email: string;
  _bap_entity_combo_key: string;
  _bap_applicant_name: string;
  _formio_schoolDistrictName: string;
  appInfo_uei: string;
  appInfo_efti: string;
  appInfo_organization_name: string;
  org_district_name: string;
  org_district_state: string;
};

type FormioFRF2024FormDataFields = FormioFRF2024DashboardDataFields & {
  [field: string]: unknown;
  _user_title: string;
  _user_name: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
};

type FormioPRF2024DashboardDataFields = {
  _user_email: string;
  _bap_entity_combo_key: string;
  _bap_rebate_id: string;
  _bap_applicant_name: string;
  _bap_district_name: string;
  _bap_district_state: string;
};

type FormioPRF2024FormDataFields = FormioPRF2024DashboardDataFields & {
  [field: string]: unknown;
  _frf_modified: string;
  _user_title: string;
  _user_name: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_id: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_county: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
  _bap_elec_bus_poc_email: string | null;
  _bap_alt_elec_bus_poc_email: string | null;
  _bap_govt_bus_poc_email: string | null;
  _bap_alt_govt_bus_poc_email: string | null;
  _bap_primary_id: string;
  _bap_primary_fname: string;
  _bap_primary_lname: string;
  _bap_primary_title: string;
  _bap_primary_email: string;
  _bap_primary_phone: string;
  _bap_alternate_id: string | null;
  _bap_alternate_fname: string | null;
  _bap_alternate_lname: string | null;
  _bap_alternate_title: string | null;
  _bap_alternate_email: string | null;
  _bap_alternate_phone: string | null;
  _bap_district_id: string;
  _bap_district_nces_id: string;
  _bap_district_address_1: string;
  _bap_district_address_2: string;
  _bap_district_city: string;
  _bap_district_zip: string;
  _bap_district_priority: string;
  _bap_district_priority_reason: {
    highNeed: boolean;
    tribal: boolean;
    rural: boolean;
  };
  _bap_district_self_certify: string;
  _bap_district_contact_id: string;
  _bap_district_contact_fname: string;
  _bap_district_contact_lname: string;
  _bap_district_contact_title: string;
  _bap_district_contact_email: string;
  _bap_district_contact_phone: string;
  org_organizations: {
    _bap_org_frf: boolean;
    org_number: number;
    org_type: {
      existing_bus_owner: boolean;
      new_bus_owner: boolean;
      private_fleet: boolean;
    };
    _bap_org_id: string;
    _bap_org_name: string;
    _bap_org_contact_id: string;
    _bap_org_contact_fname: string;
    _bap_org_contact_lname: string;
    _bap_org_contact_title: string;
    _bap_org_contact_email: string;
    _bap_org_contact_phone: string;
    _bap_org_address_1: string;
    _bap_org_address_2: string;
    _bap_org_county: string;
    _bap_org_city: string;
    _bap_org_state: { name: string };
    _bap_org_zip: string;
  }[];
  bus_buses: {
    bus_number: number;
    bus_existing_owner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    bus_existing_vin: string;
    bus_existing_fuel_type: string;
    bus_existing_gvwr: number;
    bus_existing_odometer: number;
    bus_existing_model: string;
    bus_existing_model_year: string;
    bus_existing_nces_id: string;
    bus_existing_manufacturer: string;
    bus_existing_manufacturer_other: string | null;
    bus_existing_annual_fuel_consumption: number;
    bus_existing_annual_mileage: number;
    bus_existing_remaining_life: number;
    bus_existing_idling_hours: number;
    bus_new_owner: {
      org_id: string;
      org_name: string;
      org_contact_id: string;
      org_contact_fname: string;
      org_contact_lname: string;
    };
    bus_new_fuel_type: string;
    bus_new_gvwr: number;
    _bus_new_max_rebate: number;
    _bus_new_ada_from_frf: boolean;
  }[];
};

type FormioCRF2024DashboardDataFields = {
  _user_email: string;
  _bap_entity_combo_key: string;
};

type FormioCRF2024FormDataFields = FormioCRF2024DashboardDataFields & {
  [field: string]: unknown;
  _user_title: string;
  _user_name: string;
  _bap_rebate_id: string;
};

type FormioChange2024DashboardDataFields = {
  _request_form: CSBFormType;
  _bap_rebate_id: string;
  _mongo_id: string;
  _user_email: string;
  request_type: {
    label: string;
    value: string;
  };
};

type FormioChange2024FormDataFields = FormioChange2024DashboardDataFields & {
  [field: string]: unknown;
  _bap_entity_combo_key: string;
  _user_title: string;
  _user_name: string;
};

export type FormioSchemaAndSubmission<FormioFormSubmission> =
  | {
      access: false;
      schema: null;
      submission: null;
    }
  | {
      access: true;
      schema: FormType;
      submission: FormioFormSubmission;
    };

export type FormioFRF2022DashboardSubmission = FormioSubmission & {
  data: FormioFRF2022DashboardDataFields;
};

export type FormioFRF2022FormSubmission = FormioSubmission & {
  data: FormioFRF2022FormDataFields;
};

export type FormioPRF2022DashboardSubmission = FormioSubmission & {
  data: FormioPRF2022DashboardDataFields;
};

export type FormioPRF2022FormSubmission = FormioSubmission & {
  data: FormioPRF2022FormDataFields;
};

export type FormioCRF2022DashboardSubmission = FormioSubmission & {
  data: FormioCRF2022DashboardDataFields;
};

export type FormioCRF2022FormSubmission = FormioSubmission & {
  data: FormioCRF2022FormDataFields;
};

export type FormioChange2022DashboardSubmission = FormioSubmission & {
  data: FormioChange2022DashboardDataFields;
};

export type FormioChange2022FormSubmission = FormioSubmission & {
  data: FormioChange2022FormDataFields;
};

export type FormioFRF2023DashboardSubmission = FormioSubmission & {
  data: FormioFRF2023DashboardDataFields;
};

export type FormioFRF2023FormSubmission = FormioSubmission & {
  data: FormioFRF2023FormDataFields;
};

export type FormioPRF2023DashboardSubmission = FormioSubmission & {
  data: FormioPRF2023DashboardDataFields;
};

export type FormioPRF2023FormSubmission = FormioSubmission & {
  data: FormioPRF2023FormDataFields;
};

export type FormioCRF2023DashboardSubmission = FormioSubmission & {
  data: FormioCRF2023DashboardDataFields;
};

export type FormioCRF2023FormSubmission = FormioSubmission & {
  data: FormioCRF2023FormDataFields;
};

export type FormioChange2023DashboardSubmission = FormioSubmission & {
  data: FormioChange2023DashboardDataFields;
};

export type FormioChange2023FormSubmission = FormioSubmission & {
  data: FormioChange2023FormDataFields;
};

export type FormioFRF2024DashboardSubmission = FormioSubmission & {
  data: FormioFRF2024DashboardDataFields;
};

export type FormioFRF2024FormSubmission = FormioSubmission & {
  data: FormioFRF2024FormDataFields;
};

export type FormioPRF2024DashboardSubmission = FormioSubmission & {
  data: FormioPRF2024DashboardDataFields;
};

export type FormioPRF2024FormSubmission = FormioSubmission & {
  data: FormioPRF2024FormDataFields;
};

export type FormioCRF2024DashboardSubmission = FormioSubmission & {
  data: FormioCRF2024DashboardDataFields;
};

export type FormioCRF2024FormSubmission = FormioSubmission & {
  data: FormioCRF2024FormDataFields;
};

export type FormioChange2024DashboardSubmission = FormioSubmission & {
  data: FormioChange2024DashboardDataFields;
};

export type FormioChange2024FormSubmission = FormioSubmission & {
  data: FormioChange2024FormDataFields;
};

export type Rebate2022 = {
  rebateYear: "2022";
  frf: {
    formio: FormioFRF2022DashboardSubmission;
    bap: BapSubmissionData | null;
  };
  prf: {
    formio: FormioPRF2022DashboardSubmission | null;
    bap: BapSubmissionData | null;
  };
  crf: {
    formio: FormioCRF2022DashboardSubmission | null;
    bap: BapSubmissionData | null;
  };
};

export type Rebate2023 = {
  rebateYear: "2023";
  frf: {
    formio: FormioFRF2023DashboardSubmission;
    bap: BapSubmissionData | null;
  };
  prf: {
    formio: FormioPRF2023DashboardSubmission | null;
    bap: BapSubmissionData | null;
  };
  crf: {
    formio: FormioCRF2023DashboardSubmission | null;
    bap: BapSubmissionData | null;
  };
};

export type Rebate2024 = {
  rebateYear: "2024";
  frf: {
    formio: FormioFRF2024DashboardSubmission;
    bap: BapSubmissionData | null;
  };
  prf: {
    formio: FormioPRF2024DashboardSubmission | null;
    bap: BapSubmissionData | null;
  };
  crf: {
    formio: FormioCRF2024DashboardSubmission | null;
    bap: BapSubmissionData | null;
  };
};
