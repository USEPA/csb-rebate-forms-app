export type RebateYear = "2022" | "2023";

export type FormType = "frf" | "prf" | "crf";

export type Content = {
  siteAlert: string;
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

export type UserData = {
  mail: string;
  memberof: string;
  exp: number;
};

export type ConfigData = {
  submissionPeriodOpen: {
    2022: { frf: boolean; prf: boolean; crf: boolean };
    2023: { frf: boolean; prf: boolean; crf: boolean };
  };
};

export type BapSamEntity = {
  Id: string;
  ENTITY_COMBO_KEY__c: string;
  UNIQUE_ENTITY_ID__c: string;
  ENTITY_EFT_INDICATOR__c: string;
  ENTITY_STATUS__c: "Active" | string;
  LEGAL_BUSINESS_NAME__c: string;
  PHYSICAL_ADDRESS_LINE_1__c: string;
  PHYSICAL_ADDRESS_LINE_2__c: string | null;
  PHYSICAL_ADDRESS_CITY__c: string;
  PHYSICAL_ADDRESS_PROVINCE_OR_STATE__c: string;
  PHYSICAL_ADDRESS_ZIPPOSTAL_CODE__c: string;
  PHYSICAL_ADDRESS_ZIP_CODE_4__c: string;
  // contacts
  ELEC_BUS_POC_EMAIL__c: string | null;
  ELEC_BUS_POC_NAME__c: string | null;
  ELEC_BUS_POC_TITLE__c: string | null;
  //
  ALT_ELEC_BUS_POC_EMAIL__c: string | null;
  ALT_ELEC_BUS_POC_NAME__c: string | null;
  ALT_ELEC_BUS_POC_TITLE__c: string | null;
  //
  GOVT_BUS_POC_EMAIL__c: string | null;
  GOVT_BUS_POC_NAME__c: string | null;
  GOVT_BUS_POC_TITLE__c: string | null;
  //
  ALT_GOVT_BUS_POC_EMAIL__c: string | null;
  ALT_GOVT_BUS_POC_NAME__c: string | null;
  ALT_GOVT_BUS_POC_TITLE__c: string | null;
  //
  attributes: { type: string; url: string };
};

export type BapSamData =
  | { results: false; entities: [] }
  | { results: true; entities: BapSamEntity[] };

export type BapFormSubmission = {
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
    | "CSB Close Out Request 2023";
  Rebate_Program_Year__c: null | RebateYear;
  Parent_CSB_Rebate__r: {
    CSB_Funding_Request_Status__c: string;
    CSB_Payment_Request_Status__c: string;
    CSB_Closeout_Request_Status__c: string;
    attributes: { type: string; url: string };
  };
  attributes: { type: string; url: string };
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
};

export type BapSubmissionData = {
  modified: string | null; // ISO 8601 date time string
  comboKey: string | null; // UEI + EFTI combo key
  mongoId: string | null; // MongoDB Object ID
  rebateId: string | null; // CSB Rebate ID (6 digits)
  reviewItemId: string | null; // CSB Rebate ID with form/version ID (9 digits)
  status: string | null;
};

export type FormioSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string – submission ID
  form: string; // MongoDB ObjectId string – form ID
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date time string
  metadata: {
    [field: string]: unknown;
  };
  data: {
    [field: string]: unknown;
  };
};

type FormioFRF2022Data = {
  [field: string]: unknown;
  // fields injected upon a new draft FRF submission creation:
  last_updated_by: string;
  hidden_current_user_email: string;
  hidden_current_user_title: string;
  hidden_current_user_name: string;
  bap_hidden_entity_combo_key: string;
  sam_hidden_applicant_email: string;
  sam_hidden_applicant_title: string;
  sam_hidden_applicant_name: string;
  sam_hidden_applicant_efti: string;
  sam_hidden_applicant_uei: string;
  sam_hidden_applicant_organization_name: string;
  sam_hidden_applicant_street_address_1: string;
  sam_hidden_applicant_street_address_2: string;
  sam_hidden_applicant_city: string;
  sam_hidden_applicant_state: string;
  sam_hidden_applicant_zip_code: string;
  // fields set by form definition (among others):
  applicantUEI: string;
  applicantEfti: string;
  applicantEfti_display: string;
  applicantOrganizationName: string;
  schoolDistrictName: string;
};

type FormioPRF2022Data = {
  [field: string]: unknown;
  // fields injected upon a new draft PRF submission creation:
  bap_hidden_entity_combo_key: string;
  hidden_application_form_modified: string; // ISO 8601 date time string
  hidden_current_user_email: string;
  hidden_current_user_title: string;
  hidden_current_user_name: string;
  hidden_bap_rebate_id: string;
  // fields set by form definition (among others):
  applicantName: string;
};

type FormioCRF2022Data = {
  [field: string]: unknown;
  // fields injected upon a new draft CRF submission creation:
  bap_hidden_entity_combo_key: string;
  hidden_prf_modified: string; // ISO 8601 date time string
  hidden_current_user_email: string;
  hidden_current_user_title: string;
  hidden_current_user_name: string;
  hidden_bap_rebate_id: string;
  // fields set by form definition (among others):
  signatureName: string;
};

type FormioFRF2023Data = {
  [field: string]: unknown;
  // fields injected upon a new draft FRF submission creation:
  _user_email: string;
  _user_title: string;
  _user_name: string;
  _bap_entity_combo_key: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_name: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
  // fields set by form definition (among others):
  appInfo_uei: string;
  appInfo_efti: string;
  appInfo_orgName: string;
  _formio_schoolDistrictName: string;
};

type FormioPRF2023Data = {
  [field: string]: unknown;
  // fields injected upon a new draft FRF submission creation:
  _user_email: string;
  _user_title: string;
  _user_name: string;
  _bap_entity_combo_key: string;
  _bap_rebate_id: string;
};

type FormioCRF2023Data = {
  [field: string]: unknown;
  // fields injected upon a new draft FRF submission creation:
  _user_email: string;
  _user_title: string;
  _user_name: string;
  _bap_entity_combo_key: string;
  _bap_rebate_id: string;
};

type FormioChange2023Data = {
  [field: string]: unknown;
  // fields injected upon a new draft Change Request form submission creation:
  _request_form: FormType;
  _bap_entity_combo_key: string;
  _bap_rebate_id: string;
  _mongo_id: string;
  _user_email: string;
  _user_title: string;
  _user_name: string;
  // fields set by the form definition (among others):
  request_type: { label: string; value: string };
};

type FormioFRF2024Data = {
  [field: string]: unknown;
  // fields injected upon a new draft FRF submission creation:
  _user_email: string;
  _user_title: string;
  _user_name: string;
  _bap_entity_combo_key: string;
  _bap_applicant_email: string;
  _bap_applicant_title: string;
  _bap_applicant_name: string;
  _bap_applicant_efti: string;
  _bap_applicant_uei: string;
  _bap_applicant_organization_name: string;
  _bap_applicant_street_address_1: string;
  _bap_applicant_street_address_2: string;
  _bap_applicant_city: string;
  _bap_applicant_state: string;
  _bap_applicant_zip: string;
};

export type FormioFRF2022Submission = FormioSubmission & {
  data: FormioFRF2022Data;
};

export type FormioPRF2022Submission = FormioSubmission & {
  data: FormioPRF2022Data;
};

export type FormioCRF2022Submission = FormioSubmission & {
  data: FormioCRF2022Data;
};

export type FormioFRF2023Submission = FormioSubmission & {
  data: FormioFRF2023Data;
};

export type FormioPRF2023Submission = FormioSubmission & {
  data: FormioPRF2023Data;
};

export type FormioCRF2023Submission = FormioSubmission & {
  data: FormioCRF2023Data;
};

export type FormioChange2023Submission = FormioSubmission & {
  data: FormioChange2023Data;
};

export type Rebate = {
  rebateYear: RebateYear;
  frf: {
    formio: FormioFRF2022Submission | FormioFRF2023Submission;
    bap: BapSubmissionData | null;
  };
  prf: {
    formio: FormioPRF2022Submission | FormioPRF2023Submission | null;
    bap: BapSubmissionData | null;
  };
  crf: {
    formio: FormioCRF2022Submission | FormioCRF2023Submission | null;
    bap: BapSubmissionData | null;
  };
};
