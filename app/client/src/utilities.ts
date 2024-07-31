import { useEffect } from "react";
import { useQueryClient, useQuery, useQueries } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
// ---
import { serverUrl } from "@/config";

type RebateYear = "2022" | "2023";

type Content = {
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

type UserData = {
  mail: string;
  memberof: string;
  exp: number;
};

type ConfigData = {
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

type BapFormSubmission = {
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
    Reimbursement_Needed__c: boolean;
    attributes: { type: string; url: string };
  };
  attributes: { type: string; url: string };
};

type BapFormSubmissions = {
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

export type FormType = "frf" | "prf" | "crf";

type FormioSubmission = {
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
  // TODO: add more here if helpful
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

export type FormioChange2023Submission = FormioSubmission & {
  data: FormioChange2023Data;
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

export type BapSubmission = {
  modified: string | null; // ISO 8601 date time string
  comboKey: string | null; // UEI + EFTI combo key
  mongoId: string | null; // MongoDB Object ID
  rebateId: string | null; // CSB Rebate ID (6 digits)
  reviewItemId: string | null; // CSB Rebate ID with form/version ID (9 digits)
  status: string | null;
  reimbursementNeeded: boolean;
};

export type Rebate = {
  rebateYear: RebateYear;
  frf: {
    formio: FormioFRF2022Submission | FormioFRF2023Submission;
    bap: BapSubmission | null;
  };
  prf: {
    formio: FormioPRF2022Submission | FormioPRF2023Submission | null;
    bap: BapSubmission | null;
  };
  crf: {
    formio: FormioCRF2022Submission | FormioCRF2023Submission | null;
    bap: BapSubmission | null;
  };
};

async function fetchData<T = unknown>(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type");
    const data = contentType?.includes("application/json")
      ? ((await response.json()) as Promise<T>)
      : ((await response.text()) as unknown as Promise<T>);
    return response.ok ? Promise.resolve(data) : Promise.reject(data);
  } catch (error) {
    return await Promise.reject(error);
  }
}

/**
 * Fetches data and returns a promise containing JSON fetched from a provided
 * web service URL or handles any other OK response returned from the server.
 */
export function getData<T = unknown>(url: string) {
  return fetchData<T>(url, {
    method: "GET",
    credentials: "include" as const,
  });
}

/**
 * Posts JSON data and returns a promise containing JSON fetched from a provided
 * web service URL or handles any other OK response returned from the server.
 */
export function postData<T = unknown>(url: string, data: object) {
  return fetchData<T>(url, {
    method: "POST",
    credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** Custom hook to fetch content data. */
export function useContentQuery() {
  return useQuery({
    queryKey: ["content"],
    queryFn: () => getData<Content>(`${serverUrl}/api/content`),
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched content data. */
export function useContentData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Content>(["content"]);
}

/** Custom hook to fetch user data. */
export function useUserQuery() {
  return useQuery({
    queryKey: ["user"],
    queryFn: () => getData<UserData>(`${serverUrl}/api/user`),
    enabled: false,
    retry: false,
  });
}

/** Custom hook that returns cached fetched user data. */
export function useUserData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<UserData>(["user"]);
}

/** Custom hook to check if user should have access to the helpdesk page. */
export function useHelpdeskAccess() {
  const user = useUserData();
  const userRoles = user?.memberof.split(",") || [];

  return !user
    ? "pending"
    : userRoles.includes("csb_admin") || userRoles.includes("csb_helpdesk")
      ? "success"
      : "failure";
}

/** Custom hook to fetch CSB config. */
export function useConfigQuery() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => getData<ConfigData>(`${serverUrl}/api/config`),
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched CSB config. */
export function useConfigData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<ConfigData>(["config"]);
}

/** Custom hook to fetch BAP SAM.gov data. */
export function useBapSamQuery() {
  return useQuery({
    queryKey: ["bap/sam"],
    queryFn: () => getData<BapSamData>(`${serverUrl}/api/bap/sam`),
    onSuccess: (res) => {
      if (!res.results) {
        window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=bap-sam-results`;
      }
    },
    onError: (_err) => {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?error=bap-sam-fetch`;
    },
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched BAP SAM.gov data. */
export function useBapSamData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<BapSamData>(["bap/sam"]);
}

/** Custom hook to fetch Change Request form submissions from Formio. */
export function useChangeRequestsQuery(rebateYear: RebateYear) {
  /*
   * NOTE: Change Request form was added in the 2023 rebate year, so there's no
   * change request data to fetch for 2022.
   */
  const changeRequest2022Query = {
    queryKey: ["formio/2022/changes"],
    queryFn: () => Promise.resolve([]),
    refetchOnWindowFocus: false,
  };

  const changeRequest2023Query = {
    queryKey: ["formio/2023/changes"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/changes`;
      return getData<FormioChange2023Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  /* NOTE: Fallback (not used, as rebate year will match a query above) */
  const changeRequestQuery = {
    queryKey: ["formio/changes"],
    queryFn: () => Promise.resolve([]),
    refetchOnWindowFocus: false,
  };

  const query =
    rebateYear === "2022"
      ? changeRequest2022Query
      : rebateYear === "2023"
        ? changeRequest2023Query
        : changeRequestQuery;

  return useQuery(query);
}

/**
 * Custom hook that returns cached fetched Change Request form submissions from
 * Formio.
 */
export function useChangeRequestsData(rebateYear: RebateYear) {
  const queryClient = useQueryClient();
  return rebateYear === "2022"
    ? queryClient.getQueryData<[]>(["formio/2022/changes"])
    : rebateYear === "2023"
      ? queryClient.getQueryData<FormioChange2023Submission[]>(["formio/2023/changes"]) // prettier-ignore
      : undefined;
}

/** Custom hook to fetch submissions from the BAP and Formio. */
export function useSubmissionsQueries(rebateYear: RebateYear) {
  const bapQuery = {
    queryKey: ["bap/submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/bap/submissions`;
      return getData<BapFormSubmission[]>(url).then((res) => {
        if (!Array.isArray(res)) {
          return Promise.reject(res);
        }

        const submissions = res.reduce(
          (object, submission) => {
            const { Record_Type_Name__c, Rebate_Program_Year__c } = submission;

            const rebateYear =
              Rebate_Program_Year__c === null ? "2022" : Rebate_Program_Year__c;

            const formType =
              Record_Type_Name__c.startsWith("CSB Funding Request") // prettier-ignore
                ? "frfs"
                : Record_Type_Name__c.startsWith("CSB Payment Request")
                  ? "prfs"
                  : Record_Type_Name__c.startsWith("CSB Close Out Request")
                    ? "crfs"
                    : null;

            if (rebateYear && formType) {
              object[rebateYear][formType].push(submission);
            }

            return object;
          },
          {
            2022: {
              frfs: [] as BapFormSubmission[],
              prfs: [] as BapFormSubmission[],
              crfs: [] as BapFormSubmission[],
            },
            2023: {
              frfs: [] as BapFormSubmission[],
              prfs: [] as BapFormSubmission[],
              crfs: [] as BapFormSubmission[],
            },
          },
        );

        return Promise.resolve(submissions);
      });
    },
    refetchOnWindowFocus: false,
  };

  const formioFRF2022Query = {
    queryKey: ["formio/2022/frf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2022/frf-submissions`;
      return getData<FormioFRF2022Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioPRF2022Query = {
    queryKey: ["formio/2022/prf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2022/prf-submissions`;
      return getData<FormioPRF2022Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioCRF2022Query = {
    queryKey: ["formio/2022/crf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2022/crf-submissions`;
      return getData<FormioCRF2022Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioFRF2023Query = {
    queryKey: ["formio/2023/frf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/frf-submissions`;
      return getData<FormioFRF2023Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioPRF2023Query = {
    queryKey: ["formio/2023/prf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/prf-submissions`;
      return getData<FormioPRF2023Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioCRF2023Query = {
    queryKey: ["formio/2023/crf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/crf-submissions`;
      return getData<FormioCRF2023Submission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  type Query = {
    queryKey: string[];
    queryFn: () =>
      | Promise<BapFormSubmissions>
      | Promise<FormioFRF2022Submission[]>
      | Promise<FormioPRF2022Submission[]>
      | Promise<FormioCRF2022Submission[]>
      | Promise<FormioFRF2023Submission[]>
      | Promise<FormioPRF2023Submission[]>
      | Promise<FormioCRF2023Submission[]>;
    refetchOnWindowFocus: boolean;
  };

  const queries: Query[] =
    rebateYear === "2022"
      ? [bapQuery, formioFRF2022Query, formioPRF2022Query, formioCRF2022Query]
      : rebateYear === "2023"
        ? [bapQuery, formioFRF2023Query, formioPRF2023Query, formioCRF2023Query]
        : [];

  return useQueries({ queries });
}

/**
 * Custom hook to combine FRF submissions, PRF submissions, and CRF submissions
 * from both the BAP and Formio into a single object, with the BAP assigned
 * rebateId as the object's keys.
 **/
function useCombinedSubmissions(rebateYear: RebateYear) {
  const queryClient = useQueryClient();

  const bapFormSubmissions = queryClient.getQueryData<BapFormSubmissions>(["bap/submissions"]); // prettier-ignore

  const formioFRFSubmissions =
    rebateYear === "2022"
      ? queryClient.getQueryData<FormioFRF2022Submission[]>(["formio/2022/frf-submissions"]) // prettier-ignore
      : rebateYear === "2023"
        ? queryClient.getQueryData<FormioFRF2023Submission[]>(["formio/2023/frf-submissions"]) // prettier-ignore
        : undefined;

  const formioPRFSubmissions =
    rebateYear === "2022"
      ? queryClient.getQueryData<FormioPRF2022Submission[]>(["formio/2022/prf-submissions"]) // prettier-ignore
      : rebateYear === "2023"
        ? queryClient.getQueryData<FormioPRF2023Submission[]>(["formio/2023/prf-submissions"]) // prettier-ignore
        : undefined;

  const formioCRFSubmissions =
    rebateYear === "2022"
      ? queryClient.getQueryData<FormioCRF2022Submission[]>(["formio/2022/crf-submissions"]) // prettier-ignore
      : rebateYear === "2023"
        ? queryClient.getQueryData<FormioCRF2023Submission[]>(["formio/2023/crf-submissions"]) // prettier-ignore
        : undefined;

  const submissions: {
    [rebateId: string]: Rebate;
  } = {};

  /* ensure form submissions data has been fetched from both the BAP and Formio */
  if (
    !bapFormSubmissions ||
    !formioFRFSubmissions ||
    !formioPRFSubmissions ||
    !formioCRFSubmissions
  ) {
    return {};
  }

  /**
   * Iterate over Formio FRF submissions, matching them with submissions
   * returned from the BAP, so we can build up each rebate object with the FRF
   * submission data and initialize PRF and CRF submission data structure (both
   * to be updated).
   */
  for (const formioFRFSubmission of formioFRFSubmissions) {
    const bapMatch = bapFormSubmissions[rebateYear].frfs.find((bapFRFSub) => {
      return bapFRFSub.CSB_Form_ID__c === formioFRFSubmission._id;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const mongoId = bapMatch?.CSB_Form_ID__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c || null; // prettier-ignore
    const reimbursementNeeded = bapMatch?.Parent_CSB_Rebate__r?.Reimbursement_Needed__c || false; // prettier-ignore

    /**
     * NOTE: If new FRF submissions have been reciently created in Formio and
     * the BAP's FRF ETL process has not yet run to pick up those new Formio
     * submissions, all of the fields above will be null, so instead of
     * assigning the submission's key as `rebateId` (which will be null), we'll
     * assign it to be an underscore concatenated with the Formio submission's
     * mongoDB ObjectID – just so each submission object still has a unique ID.
     */
    submissions[rebateId || `_${formioFRFSubmission._id}`] = {
      rebateYear,
      frf: {
        formio: { ...formioFRFSubmission },
        bap: {
          modified,
          comboKey,
          mongoId,
          rebateId,
          reviewItemId,
          status,
          reimbursementNeeded,
        },
      },
      prf: { formio: null, bap: null },
      crf: { formio: null, bap: null },
    };
  }

  /**
   * Iterate over Formio PRF submissions, matching them with submissions
   * returned from the BAP, so we can set BAP PRF submission data.
   */
  for (const formioPRFSubmission of formioPRFSubmissions) {
    const formioBapRebateId =
      rebateYear === "2022"
        ? (formioPRFSubmission as FormioPRF2022Submission).data.hidden_bap_rebate_id // prettier-ignore
        : rebateYear === "2023"
          ? (formioPRFSubmission as FormioPRF2023Submission).data._bap_rebate_id
          : null;

    const bapMatch = bapFormSubmissions[rebateYear].prfs.find((bapPRFSub) => {
      return bapPRFSub.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const mongoId = bapMatch?.CSB_Form_ID__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c || null; // prettier-ignore
    const reimbursementNeeded = bapMatch?.Parent_CSB_Rebate__r?.Reimbursement_Needed__c || false; // prettier-ignore

    if (formioBapRebateId && submissions[formioBapRebateId]) {
      submissions[formioBapRebateId].prf = {
        formio: { ...formioPRFSubmission },
        bap: {
          modified,
          comboKey,
          mongoId,
          rebateId,
          reviewItemId,
          status,
          reimbursementNeeded,
        },
      };
    }
  }

  /**
   * Iterate over Formio CRF submissions, matching them with submissions
   * returned from the BAP, so we can set BAP CRF submission data.
   */
  for (const formioCRFSubmission of formioCRFSubmissions) {
    const formioBapRebateId =
      rebateYear === "2022"
        ? (formioCRFSubmission as FormioCRF2022Submission).data.hidden_bap_rebate_id // prettier-ignore
        : rebateYear === "2023"
          ? (formioCRFSubmission as FormioCRF2023Submission).data._bap_rebate_id
          : null;

    const bapMatch = bapFormSubmissions[rebateYear].crfs.find((bapCRFSub) => {
      return bapCRFSub.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const mongoId = bapMatch?.CSB_Form_ID__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Closeout_Request_Status__c || null; // prettier-ignore
    const reimbursementNeeded = bapMatch?.Parent_CSB_Rebate__r?.Reimbursement_Needed__c || false; // prettier-ignore

    if (formioBapRebateId && submissions[formioBapRebateId]) {
      submissions[formioBapRebateId].crf = {
        formio: { ...formioCRFSubmission },
        bap: {
          modified,
          comboKey,
          mongoId,
          rebateId,
          reviewItemId,
          status,
          reimbursementNeeded,
        },
      };
    }
  }

  return submissions;
}

/**
 * Custom hook that sorts submissions by:
 * - Most recient Formio modified date, regardless of form type (FRF, PRF, CRF)
 * - Submissions needing edits, regardless of form type
 * - Selected FRF submissions without a corresponding PRF submission
 * - Funding Approved PRF submissions without a corresponding CRF submission
 **/
function useSortedSubmissions(rebates: { [rebateId: string]: Rebate }) {
  return Object.entries(rebates)
    .map(([rebateId, rebate]) => ({ rebateId, ...rebate }))
    .sort((r1, r2) => {
      const mostRecientR1Modified = [
        Date.parse(r1.frf.formio.modified),
        Date.parse(r1.prf.formio?.modified || ""),
        Date.parse(r1.crf.formio?.modified || ""),
      ].reduce((previous, current) => {
        return current > previous ? current : previous;
      });

      const mostRecientR2Modified = [
        Date.parse(r2.frf.formio.modified),
        Date.parse(r2.prf.formio?.modified || ""),
        Date.parse(r2.crf.formio?.modified || ""),
      ].reduce((previous, current) => {
        return current > previous ? current : previous;
      });

      return mostRecientR2Modified - mostRecientR1Modified;
    })
    .sort((r1, _r2) => {
      const r1FRFNeedsEdits = submissionNeedsEdits({
        formio: r1.frf.formio,
        bap: r1.frf.bap,
      });

      const r1PRFNeedsEdits = submissionNeedsEdits({
        formio: r1.prf.formio,
        bap: r1.prf.bap,
      });

      const r1CRFNeedsEdits = submissionNeedsEdits({
        formio: r1.crf.formio,
        bap: r1.crf.bap,
      });

      const r1FRFSelected = r1.frf.bap?.status === "Accepted";

      const r1FRFSelectedButNoPRF = r1FRFSelected && !Boolean(r1.prf.formio);

      const r1PRFFundingApproved = r1.prf.bap?.status === "Accepted";

      const r1PRFFundingApprovedButNoCRF =
        r1PRFFundingApproved && !Boolean(r1.crf.formio);

      return r1FRFNeedsEdits ||
        r1PRFNeedsEdits ||
        r1CRFNeedsEdits ||
        r1FRFSelectedButNoPRF ||
        r1PRFFundingApprovedButNoCRF
        ? -1
        : 0;
    });
}

/**
 * Custom hook that returns sorted submissions, and logs them if 'debug' search
 * parameter exists.
 */
export function useSubmissions(rebateYear: RebateYear) {
  const [searchParams] = useSearchParams();

  const combinedSubmissions = useCombinedSubmissions(rebateYear);
  const sortedSubmissions = useSortedSubmissions(combinedSubmissions);

  // log combined 'sortedSubmissions' array if 'debug' search parameter exists
  useEffect(() => {
    if (searchParams.has("debug") && sortedSubmissions.length > 0) {
      console.log(sortedSubmissions);
    }
  }, [searchParams, sortedSubmissions]);

  return sortedSubmissions;
}

/**
 * Determines whether a submission needs edits, based on the BAP status
 *
 * NOTE: we can't use the BAP status alone though, because if a submission has
 * been re-submitted and the BAP hasn't yet run their ETL to pickup the status
 * change, we need to ensure we properly display the 'submitted' formio status.
 */
export function submissionNeedsEdits(options: {
  formio: FormioSubmission | null;
  bap: BapSubmission | null;
}) {
  const { formio, bap } = options;

  if (!formio) return false;

  /**
   * The submission has been updated in Formio since the last time the BAP's
   * submissions ETL process has last succesfully run.
   */
  const submissionHasBeenUpdatedSinceLastETL = bap?.modified
    ? new Date(formio.modified) > new Date(bap.modified)
    : false;

  return (
    bap?.status === "Edits Requested" &&
    (formio.state === "draft" ||
      (formio.state === "submitted" && !submissionHasBeenUpdatedSinceLastETL))
  );
}

/**
 * Determines whether a submission needs reimbursement, based on the BAP status
 * and reimbursement status.
 */
export function submissionNeedsReimbursement(options: {
  status: string;
  reimbursementNeeded: boolean;
}) {
  const { status, reimbursementNeeded } = options;

  return status === "Branch Director Approved" && reimbursementNeeded;
}

/**
 * Returns a user’s title and name when provided an email address and a SAM.gov
 * entity/record.
 */
export function getUserInfo(email: string, entity: BapSamEntity) {
  const samEmailFields = [
    "ELEC_BUS_POC_EMAIL__c",
    "ALT_ELEC_BUS_POC_EMAIL__c",
    "GOVT_BUS_POC_EMAIL__c",
    "ALT_GOVT_BUS_POC_EMAIL__c",
  ];

  let matchedEmailField;

  for (const [field, value] of Object.entries(entity)) {
    if (!samEmailFields.includes(field)) continue;
    // NOTE: take the first match only (the assumption is if a user is listed
    // as multiple POCs, their title and name will be the same for all POCs)
    if (
      typeof value === "string" &&
      value.toLowerCase() === email.toLowerCase()
    ) {
      matchedEmailField = field;
      break;
    }
  }

  const fieldPrefix = matchedEmailField?.split("_EMAIL__c").shift();

  return {
    title: entity[`${fieldPrefix}_TITLE__c` as keyof BapSamEntity] as string,
    name: entity[`${fieldPrefix}_NAME__c` as keyof BapSamEntity] as string,
  };
}
