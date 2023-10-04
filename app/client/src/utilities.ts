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
  Record_Type_Name__c:
    | "CSB Funding Request"
    | "CSB Payment Request"
    | "CSB Close Out Request";
  Parent_CSB_Rebate__r: {
    CSB_Funding_Request_Status__c: string;
    CSB_Payment_Request_Status__c: string;
    CSB_Closeout_Request_Status__c: string;
    attributes: { type: string; url: string };
  };
  attributes: { type: string; url: string };
};

type FormioSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
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

export type BapSubmission = {
  modified: string | null; // ISO 8601 date time string
  comboKey: string | null; // UEI + EFTI combo key
  mongoId: string | null; // MongoDB Object ID
  rebateId: string | null; // CSB Rebate ID (6 digits)
  reviewItemId: string | null; // CSB Rebate ID with form/version ID (9 digits)
  status: string | null;
};

export type Rebate =
  | {
      rebateYear: "2022";
      frf: {
        formio: FormioFRF2022Submission;
        bap: BapSubmission | null;
      };
      prf: {
        formio: FormioPRF2022Submission | null;
        bap: BapSubmission | null;
      };
      crf: {
        formio: FormioCRF2022Submission | null;
        bap: BapSubmission | null;
      };
    }
  | {
      rebateYear: "2023";
      frf: {
        formio: FormioFRF2023Submission;
        bap: null;
      };
      prf: {
        formio: null;
        bap: null;
      };
      crf: {
        formio: null;
        bap: null;
      };
    };

async function fetchData<T = any>(url: string, options: RequestInit) {
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
 * web service URL or handles any other OK response returned from the server
 */
export function getData<T = any>(url: string) {
  return fetchData<T>(url, {
    method: "GET",
    credentials: "include" as const,
  });
}

/**
 * Posts JSON data and returns a promise containing JSON fetched from a provided
 * web service URL or handles any other OK response returned from the server
 */
export function postData<T = any>(url: string, data: object) {
  return fetchData<T>(url, {
    method: "POST",
    credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** Custom hook to fetch content data */
export function useContentQuery() {
  return useQuery({
    queryKey: ["content"],
    queryFn: () => getData<Content>(`${serverUrl}/api/content`),
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched content data */
export function useContentData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Content>(["content"]);
}

/** Custom hook to fetch user data */
export function useUserQuery() {
  return useQuery({
    queryKey: ["user"],
    queryFn: () => getData<UserData>(`${serverUrl}/api/user`),
    enabled: false,
    retry: false,
  });
}

/** Custom hook that returns cached fetched user data */
export function useUserData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<UserData>(["user"]);
}

/** Custom hook to fetch CSB config */
export function useConfigQuery() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => getData<ConfigData>(`${serverUrl}/api/config`),
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched CSB config */
export function useConfigData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<ConfigData>(["config"]);
}

/** Custom hook to fetch BAP SAM.gov data */
export function useBapSamQuery() {
  return useQuery({
    queryKey: ["bap/sam"],
    queryFn: () => getData<BapSamData>(`${serverUrl}/api/bap/sam`),
    onSuccess: (res) => {
      if (!res.results) {
        window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=bap-sam-results`;
      }
    },
    onError: (err) => {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?error=bap-sam-fetch`;
    },
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched BAP SAM.gov data */
export function useBapSamData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<BapSamData>(["bap/sam"]);
}

/** Custom hook to fetch submissions from the BAP and Formio */
export function useSubmissionsQueries(rebateYear: RebateYear) {
  const bapQuery = {
    queryKey: ["bap/submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/bap/submissions`;
      return getData<BapFormSubmission[]>(url).then((res) => {
        const submissions = res.reduce(
          (object, submission) => {
            const formType =
              submission.Record_Type_Name__c === "CSB Funding Request"
                ? "frfs"
                : submission.Record_Type_Name__c === "CSB Payment Request"
                ? "prfs"
                : submission.Record_Type_Name__c === "CSB Close Out Request"
                ? "crfs"
                : null;

            if (formType) object[formType].push(submission);

            return object;
          },
          {
            frfs: [] as BapFormSubmission[],
            prfs: [] as BapFormSubmission[],
            crfs: [] as BapFormSubmission[],
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

  type Query = {
    queryKey: string[];
    queryFn: () =>
      | Promise<{
          frfs: BapFormSubmission[];
          prfs: BapFormSubmission[];
          crfs: BapFormSubmission[];
        }>
      | Promise<FormioFRF2022Submission[]>
      | Promise<FormioPRF2022Submission[]>
      | Promise<FormioCRF2022Submission[]>
      | Promise<FormioFRF2023Submission[]>;
    refetchOnWindowFocus: boolean;
  };

  const queries: Query[] =
    rebateYear === "2022"
      ? [bapQuery, formioFRF2022Query, formioPRF2022Query, formioCRF2022Query]
      : rebateYear === "2023"
      ? [formioFRF2023Query]
      : [];

  return useQueries({ queries });
}

function combine2022Submissions(options: {
  bapFormSubmissions:
    | {
        frfs: BapFormSubmission[];
        prfs: BapFormSubmission[];
        crfs: BapFormSubmission[];
      }
    | undefined;
  formioFRFSubmissions: FormioFRF2022Submission[] | undefined;
  formioPRFSubmissions: FormioPRF2022Submission[] | undefined;
  formioCRFSubmissions: FormioCRF2022Submission[] | undefined;
}) {
  const {
    bapFormSubmissions,
    formioFRFSubmissions,
    formioPRFSubmissions,
    formioCRFSubmissions,
  } = options;

  // ensure form submissions data has been fetched from both the BAP and Formio
  if (
    !bapFormSubmissions ||
    !formioFRFSubmissions ||
    !formioPRFSubmissions ||
    !formioCRFSubmissions
  ) {
    return {};
  }

  const rebates: {
    [rebateId: string]: Extract<Rebate, { rebateYear: "2022" }>;
  } = {};

  /**
   * Iterate over Formio FRF submissions, matching them with submissions
   * returned from the BAP, so we can build up each rebate object with the FRF
   * submission data and initialize PRF and CRF submission data structure (both
   * to be updated).
   */
  for (const formioFRFSubmission of formioFRFSubmissions) {
    const bapMatch = bapFormSubmissions.frfs.find((bapFRFSubmission) => {
      return bapFRFSubmission.CSB_Form_ID__c === formioFRFSubmission._id;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const mongoId = bapMatch?.CSB_Form_ID__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c || null; // prettier-ignore

    /**
     * NOTE: If new FRF submissions have been reciently created in Formio and
     * the BAP's ETL process has not yet run to pickup those new Formio
     * submissions, all of the fields above will be null, so instead of
     * assigning the submission's key as `rebateId` (which will be null), we'll
     * assign it to be an underscore concatenated with the Formio submission's
     * mongoDB ObjectID – just so each submission object still has a unique ID.
     */
    rebates[rebateId || `_${formioFRFSubmission._id}`] = {
      rebateYear: "2022",
      frf: {
        formio: { ...formioFRFSubmission },
        bap: { modified, comboKey, mongoId, rebateId, reviewItemId, status },
      },
      prf: { formio: null, bap: null },
      crf: { formio: null, bap: null },
    };
  }

  /**
   * Iterate over Formio PRF submissions, matching them with submissions
   * returned from the BAP, so we can set the PRF submission data.
   *
   * NOTE: For there to be any Formio PRF submissions at all, the BAP's ETL
   * process must be running, as the `hidden_bap_rebate_id` field of a PRF
   * submission is injected in the creation of a brand new submission in the
   * `/api/formio/2022/prf-submission` POST request where he BAP Rebate ID
   * (along with other fields) are fetched from the BAP and then posted to
   * Formio in a new PRF submission.
   *
   * That said, if the BAP ETL isn't returning data, we should make sure we
   * handle that situation gracefully (see NOTE below).
   */
  for (const formioPRFSubmission of formioPRFSubmissions) {
    const formioBapRebateId = formioPRFSubmission.data.hidden_bap_rebate_id;

    const bapMatch = bapFormSubmissions.prfs.find((bapPRFSubmission) => {
      return bapPRFSubmission.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const mongoId = bapMatch?.CSB_Form_ID__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c || null; // prettier-ignore

    /**
     * NOTE: If the BAP ETL is running, there should be a submission with a
     * `formioBapRebateId` key for each Formio PRF submission (as it would have
     * been set in the `formioFRFSubmissions` loop above). That said, we should
     * first check that it exists before assigning the PRF data to it, so if the
     * BAP ETL process isn't returning data, it won't break our app.
     */
    if (rebates[formioBapRebateId]) {
      rebates[formioBapRebateId].prf = {
        formio: { ...formioPRFSubmission },
        bap: { modified, comboKey, mongoId, rebateId, reviewItemId, status },
      };
    }
  }

  /**
   * Iterate over Formio CRF submissions, matching them with submissions
   * returned from the BAP, so we can set the CRF submission data.
   */
  for (const formioCRFSubmission of formioCRFSubmissions) {
    const formioBapRebateId = formioCRFSubmission.data.hidden_bap_rebate_id;

    const bapMatch = bapFormSubmissions.crfs.find((bapCRFSubmission) => {
      return bapCRFSubmission.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const mongoId = bapMatch?.CSB_Form_ID__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Closeout_Request_Status__c || null; // prettier-ignore

    if (rebates[formioBapRebateId]) {
      rebates[formioBapRebateId].crf = {
        formio: { ...formioCRFSubmission },
        bap: { modified, comboKey, mongoId, rebateId, reviewItemId, status },
      };
    }
  }

  return rebates;
}

function combine2023Submissions(options: {
  formioFRFSubmissions: FormioFRF2023Submission[] | undefined;
}) {
  const { formioFRFSubmissions } = options;

  // ensure form submissions data has been fetched from Formio
  if (!formioFRFSubmissions) {
    return {};
  }

  const rebates: {
    [rebateId: string]: Extract<Rebate, { rebateYear: "2023" }>;
  } = {};

  /**
   * Iterate over Formio FRF submissions so we can build up each rebate object
   * with the FRF submission data and initialize PRF and CRF submission data
   * structure (both to be updated).
   */
  for (const formioFRFSubmission of formioFRFSubmissions) {
    rebates[`_${formioFRFSubmission._id}`] = {
      rebateYear: "2023",
      frf: {
        formio: { ...formioFRFSubmission },
        bap: null,
      },
      prf: { formio: null, bap: null },
      crf: { formio: null, bap: null },
    };
  }

  return rebates;
}

/**
 * Custom hook to combine FRF submissions, PRF submissions, and CRF submissions
 * from both the BAP and Formio into a single object, with the BAP assigned
 * rebateId as the object's keys.
 **/
function useCombinedSubmissions(rebateYear: RebateYear) {
  const queryClient = useQueryClient();

  const bapFormSubmissions = queryClient.getQueryData<{
    frfs: BapFormSubmission[];
    prfs: BapFormSubmission[];
    crfs: BapFormSubmission[];
  }>(["bap/submissions"]);

  const formioFRF2022Submissions = queryClient.getQueryData<
    FormioFRF2022Submission[]
  >(["formio/2022/frf-submissions"]);

  const formioPRF2022Submissions = queryClient.getQueryData<
    FormioPRF2022Submission[]
  >(["formio/2022/prf-submissions"]);

  const formioCRF2022Submissions = queryClient.getQueryData<
    FormioCRF2022Submission[]
  >(["formio/2022/crf-submissions"]);

  const formioFRF2023Submissions = queryClient.getQueryData<
    FormioFRF2023Submission[]
  >(["formio/2023/frf-submissions"]);

  const submissions =
    rebateYear === "2022"
      ? combine2022Submissions({
          bapFormSubmissions,
          formioFRFSubmissions: formioFRF2022Submissions,
          formioPRFSubmissions: formioPRF2022Submissions,
          formioCRFSubmissions: formioCRF2022Submissions,
        })
      : rebateYear === "2023"
      ? combine2023Submissions({
          formioFRFSubmissions: formioFRF2023Submissions,
        })
      : {};

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
  formio:
    | FormioFRF2022Submission
    | FormioPRF2022Submission
    | FormioCRF2022Submission
    | FormioFRF2023Submission
    | null;
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
