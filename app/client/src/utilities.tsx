import { useEffect } from "react";
import { useQueryClient, useQuery, useQueries } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
// ---
import { serverUrl, serverUrlForHrefs } from "./config";

type Content = {
  siteAlert: string;
  helpdeskIntro: string;
  allRebatesIntro: string;
  allRebatesOutro: string;
  newApplicationDialog: string;
  draftApplicationIntro: string;
  submittedApplicationIntro: string;
  draftPaymentRequestIntro: string;
  submittedPaymentRequestIntro: string;
};

export type CsbData = {
  submissionPeriodOpen: {
    application: boolean;
    paymentRequest: boolean;
    closeOut: boolean;
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
  CSB_Modified_Full_String__c: string; // ISO 8601 date string
  CSB_Review_Item_ID__c: string; // CSB Rebate ID with form/version ID (9 digits)
  Parent_Rebate_ID__c: string; // CSB Rebate ID (6 digits)
  Record_Type_Name__c:
    | "CSB Funding Request"
    | "CSB Payment Request"
    | "CSB Closeout Request";
  Parent_CSB_Rebate__r: {
    CSB_Funding_Request_Status__c: string;
    CSB_Payment_Request_Status__c: string;
    CSB_Closeout_Request_Status__c: string;
    attributes: { type: string; url: string };
  };
  attributes: { type: string; url: string };
};

type FormioApplicationSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    // fields injected upon new draft Application submission creation:
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
};

type FormioPaymentRequestSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    // fields injected upon new draft Payment Request submission creation:
    bap_hidden_entity_combo_key: string;
    hidden_application_form_modified: string; // ISO 8601 date string
    hidden_current_user_email: string;
    hidden_current_user_title: string;
    hidden_current_user_name: string;
    hidden_bap_rebate_id: string;
  };
};

type FormioCloseOutSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  state: "submitted" | "draft";
  modified: string; // ISO 8601 date string
  data: {
    [field: string]: unknown;
    // fields injected upon new draft Payment Request submission creation:
    bap_hidden_entity_combo_key: string;
    hidden_prf_modified: string; // ISO 8601 date string
    hidden_current_user_email: string;
    hidden_current_user_title: string;
    hidden_current_user_name: string;
    hidden_bap_rebate_id: string;
  };
};

type BapSubmission = {
  modified: string | null; // ISO 8601 date string
  comboKey: string | null; // UEI + EFTI combo key
  rebateId: string | null; // CSB Rebate ID (6 digits)
  reviewItemId: string | null; // CSB Rebate ID with form/version ID (9 digits)
  status: string | null;
};

export type Rebate = {
  application: {
    formio: FormioApplicationSubmission;
    bap: BapSubmission | null;
  };
  paymentRequest: {
    formio: FormioPaymentRequestSubmission | null;
    bap: BapSubmission | null;
  };
  closeOut: {
    formio: FormioCloseOutSubmission | null;
    bap: BapSubmission | null;
  };
};

async function fetchData<T = any>(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(response.statusText);
    const contentType = response.headers.get("content-type");
    return contentType?.includes("application/json")
      ? ((await response.json()) as Promise<T>)
      : (Promise.resolve() as Promise<T>);
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

/** Custom hook to fetch CSB data */
export function useCsbQuery() {
  return useQuery({
    queryKey: ["csb-data"],
    queryFn: () => getData<CsbData>(`${serverUrl}/api/csb-data`),
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched CSB data */
export function useCsbData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<CsbData>(["csb-data"]);
}

/** Custom hook to fetch BAP SAM.gov data */
export function useBapSamQuery() {
  return useQuery({
    queryKey: ["bap-sam-data"],
    queryFn: () => getData<BapSamData>(`${serverUrl}/api/bap-sam-data`),
    onSuccess: (res) => {
      if (!res.results) {
        window.location.href = `${serverUrlForHrefs}/logout?RelayState=/welcome?info=bap-sam-results`;
      }
    },
    onError: (err) => {
      window.location.href = `${serverUrlForHrefs}/logout?RelayState=/welcome?error=bap-sam-fetch`;
    },
    refetchOnWindowFocus: false,
  });
}

/** Custom hook that returns cached fetched BAP SAM.gov data */
export function useBapSamData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<BapSamData>(["bap-sam-data"]);
}

/** Custom hook to fetch submissions from the BAP and Formio */
export function useSubmissionsQueries() {
  return useQueries({
    queries: [
      {
        queryKey: ["bap-form-submissions"],
        queryFn: () => {
          const url = `${serverUrl}/api/bap-form-submissions`;
          return getData<BapFormSubmission[]>(url).then((res) => {
            const submissions = res.reduce(
              (object, submission) => {
                const formType =
                  submission.Record_Type_Name__c === "CSB Funding Request"
                    ? "applications"
                    : submission.Record_Type_Name__c === "CSB Payment Request"
                    ? "paymentRequests"
                    : submission.Record_Type_Name__c === "CSB Closeout Request"
                    ? "closeOuts"
                    : null;

                if (formType) object[formType].push(submission);

                return object;
              },
              {
                applications: [] as BapFormSubmission[],
                paymentRequests: [] as BapFormSubmission[],
                closeOuts: [] as BapFormSubmission[],
              }
            );

            return Promise.resolve(submissions);
          });
        },
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["formio-application-submissions"],
        queryFn: () => {
          const url = `${serverUrl}/api/formio-application-submissions`;
          return getData<FormioApplicationSubmission[]>(url);
        },
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["formio-payment-request-submissions"],
        queryFn: () => {
          const url = `${serverUrl}/api/formio-payment-request-submissions`;
          return getData<FormioPaymentRequestSubmission[]>(url);
        },
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["formio-close-out-submissions"],
        queryFn: () => {
          const url = `${serverUrl}/api/formio-close-out-submissions`;
          return getData<FormioCloseOutSubmission[]>(url);
        },
        refetchOnWindowFocus: false,
      },
    ],
  });
}

/**
 * Custom hook to combine Application form submissions data, Payment Request
 * form submissions data, and Close-Out form submissions data from both the BAP
 * and Formio into a single `submissions` object, with the BAP assigned
 * `rebateId` as the keys.
 **/
function useCombinedRebates() {
  const queryClient = useQueryClient();

  const bapFormSubmissions = queryClient.getQueryData<{
    applications: BapFormSubmission[];
    paymentRequests: BapFormSubmission[];
    closeOuts: BapFormSubmission[];
  }>(["bap-form-submissions"]);

  const formioApplicationSubmissions = queryClient.getQueryData<
    FormioApplicationSubmission[]
  >(["formio-application-submissions"]);

  const formioPaymentRequestSubmissions = queryClient.getQueryData<
    FormioPaymentRequestSubmission[]
  >(["formio-payment-request-submissions"]);

  const formioCloseOutSubmissions = queryClient.getQueryData<
    FormioCloseOutSubmission[]
  >(["formio-close-out-submissions"]);

  // ensure form submissions data has been fetched from both the BAP and Formio
  if (
    !bapFormSubmissions ||
    !formioApplicationSubmissions ||
    !formioPaymentRequestSubmissions ||
    !formioCloseOutSubmissions
  ) {
    return {};
  }

  const rebates: { [rebateId: string]: Rebate } = {};

  /**
   * Iterate over Formio Application form submissions, matching them with
   * submissions returned from the BAP, so we can build up each rebate object
   * with the Application form submission data and initialize Payment Request
   * form and Close-out Form submission data structure (both to be updated).
   */
  for (const formioSubmission of formioApplicationSubmissions) {
    const bapMatch = bapFormSubmissions.applications.find((bapSub) => {
      return bapSub.CSB_Form_ID__c === formioSubmission._id;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c || null; // prettier-ignore

    /**
     * NOTE: If new Application form submissions have been reciently created in
     * Formio and the BAP's ETL process has not yet run to pickup those new
     * Formio submissions, all of the fields above will be null, so instead of
     * assigning the submission's key as `rebateId` (which will be null), we'll
     * assign it to be an underscore concatenated with the Formio submission's
     * mongoDB ObjectID – just so each submission object still has a unique ID.
     */
    rebates[rebateId || `_${formioSubmission._id}`] = {
      application: {
        formio: { ...formioSubmission },
        bap: { modified, comboKey, rebateId, reviewItemId, status },
      },
      paymentRequest: { formio: null, bap: null },
      closeOut: { formio: null, bap: null },
    };
  }

  /**
   * Iterate over Formio Payment Request form submissions, matching them with
   * submissions returned from the BAP, so we can set the Payment Request form
   * submission data.
   *
   * NOTE: For there to be any Formio Payment Request form submissions at all,
   * the BAP's ETL process must be running, as the `hidden_bap_rebate_id` field
   * of a Payment Request form submission is injected in the creation of a brand
   * new submission in the `/api/formio-payment-request-submission` POST request
   * where he BAP Rebate ID (along with other fields) are fetched from the BAP
   * and then posted to Formio in a new Payment Request form submission.
   *
   * That said, if the BAP ETL isn't returning data, we should make sure we
   * handle that situation gracefully (see NOTE below).
   */
  for (const formioSubmission of formioPaymentRequestSubmissions) {
    const formioBapRebateId = formioSubmission.data.hidden_bap_rebate_id;

    const bapMatch = bapFormSubmissions.paymentRequests.find((bapSub) => {
      return bapSub.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c || null; // prettier-ignore

    /**
     * NOTE: If the BAP ETL is running, there should be a submission with a
     * `formioBapRebateId` key for each Formio Payment Request form submission
     * (as it would have been set in the `formioApplicationSubmissions` loop
     * above). That said, we should first check that it exists before assigning
     * the Payment Request data to it, so if the BAP ETL process isn't returning
     * data, it won't break our app.
     */
    if (rebates[formioBapRebateId]) {
      rebates[formioBapRebateId].paymentRequest = {
        formio: { ...formioSubmission },
        bap: { modified, comboKey, rebateId, reviewItemId, status },
      };
    }
  }

  /**
   * Iterate over Formio Close-Out form submissions, matching them with
   * submissions returned from the BAP, so we can set the Close-Out form
   * submission data.
   */
  for (const formioSubmission of formioCloseOutSubmissions) {
    const formioBapRebateId = formioSubmission.data.hidden_bap_rebate_id;

    const bapMatch = bapFormSubmissions.closeOuts.find((bapSub) => {
      return bapSub.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status = bapMatch?.Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c || null; // prettier-ignore

    if (rebates[formioBapRebateId]) {
      rebates[formioBapRebateId].closeOut = {
        formio: { ...formioSubmission },
        bap: { modified, comboKey, rebateId, reviewItemId, status },
      };
    }
  }

  return rebates;
}

/**
 * Custom hook that sorts rebates by:
 * - most recient formio modified date, regardless of form
 *   (Application, Payment Request, or Close-Out)
 * - Application submissions needing edits
 * - selected Applications submissions without a corresponding Payment Request
 *   submission
 **/
function useSortedRebates(rebates: { [rebateId: string]: Rebate }) {
  return Object.entries(rebates)
    .map(([rebateId, rebate]) => ({ rebateId, ...rebate }))
    .sort((r1, r2) => {
      const mostRecientR1Modified = [
        Date.parse(r1.application.formio.modified),
        Date.parse(r1.paymentRequest.formio?.modified || ""),
        Date.parse(r1.closeOut.formio?.modified || ""),
      ].reduce((previous, current) => {
        return current > previous ? current : previous;
      });

      const mostRecientR2Modified = [
        Date.parse(r2.application.formio.modified),
        Date.parse(r2.paymentRequest.formio?.modified || ""),
        Date.parse(r2.closeOut.formio?.modified || ""),
      ].reduce((previous, current) => {
        return current > previous ? current : previous;
      });

      return mostRecientR2Modified - mostRecientR1Modified;
    })
    .sort((r1, _r2) => {
      const r1ApplicationNeedsEdits = submissionNeedsEdits({
        formio: r1.application.formio,
        bap: r1.application.bap,
      });

      const r1PaymentRequestNeedsEdits = submissionNeedsEdits({
        formio: r1.paymentRequest.formio,
        bap: r1.paymentRequest.bap,
      });

      const r1ApplicationSelected = r1.application.bap?.status === "Accepted";

      const r1ApplicationSelectedButNoPaymentRequest =
        r1ApplicationSelected && !Boolean(r1.paymentRequest.formio);

      return r1ApplicationNeedsEdits ||
        r1PaymentRequestNeedsEdits ||
        r1ApplicationSelectedButNoPaymentRequest
        ? -1
        : 0;
    });
}

/**
 * Custom hook that returns sorted rebates, and logs them if 'debug' search
 * parameter exists.
 */
export function useRebates() {
  const [searchParams] = useSearchParams();

  const combinedRebates = useCombinedRebates();
  const sortedRebates = useSortedRebates(combinedRebates);

  // log combined 'sortedRebates' array if 'debug' search parameter exists
  useEffect(() => {
    if (searchParams.has("debug") && sortedRebates.length > 0) {
      console.log(sortedRebates);
    }
  }, [searchParams, sortedRebates]);

  return sortedRebates;
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
    | FormioApplicationSubmission
    | FormioPaymentRequestSubmission
    | FormioCloseOutSubmission
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
