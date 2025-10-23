import { useEffect } from "react";
import {
  type UseQueryOptions,
  type UseQueryResult,
  useQueryClient,
  useQuery,
  useQueries,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Formio } from "@formio/js";
// ---
import {
  type RebateYear,
  type CSBFormType,
  type Content,
  type UserData,
  type ConfigData,
  type BapSamEntity,
  type BapSamData,
  type BapFormSubmission,
  type BapFormSubmissions,
  type BapSubmissionData,
  type FormioSubmission,
  type FormioFRF2022DashboardSubmission,
  type FormioPRF2022DashboardSubmission,
  type FormioCRF2022DashboardSubmission,
  type FormioFRF2023DashboardSubmission,
  type FormioPRF2023DashboardSubmission,
  type FormioCRF2023DashboardSubmission,
  type FormioChange2023DashboardSubmission,
  type FormioFRF2024DashboardSubmission,
  type FormioPRF2024DashboardSubmission,
  type FormioCRF2024DashboardSubmission,
  type FormioChange2024DashboardSubmission,
  type Rebate2022,
  type Rebate2023,
  type Rebate2024,
} from "@/types";
import { serverUrl, formioBapRebateIdField } from "@/config";
import {
  useRebateYearState,
  useRebateYearActions,
} from "@/contexts/rebateYear";

/** Formio Change Request submissions by rebate year. */
/* prettier-ignore */
type FormioChangeRequestsByYear<Year> =
  Year extends "2022" ? never[] | undefined :
  Year extends "2023" ? FormioChange2023DashboardSubmission[] | undefined :
  Year extends "2024" ? FormioChange2024DashboardSubmission[] | undefined :
  never;

/** BAP and Formio submissions by rebate year. */
/* prettier-ignore */
type BapAndFormioSubmissionsByYear<Year> =
  Year extends "2022" ? BapFormSubmissions | FormioFRF2022DashboardSubmission[] | FormioPRF2022DashboardSubmission[] | FormioCRF2022DashboardSubmission[] :
  Year extends "2023" ? BapFormSubmissions | FormioFRF2023DashboardSubmission[] | FormioPRF2023DashboardSubmission[] | FormioCRF2023DashboardSubmission[] :
  Year extends "2024" ? BapFormSubmissions | FormioFRF2024DashboardSubmission[] | FormioPRF2024DashboardSubmission[] | FormioCRF2024DashboardSubmission[] :
  never;

/**
 * Formio and BAP submissions connected by rebate ID across all three forms
 * (FRF, PRF, CRF) for a given rebate year.
 */
/* prettier-ignore */
type RebateByYear<Year> =
  Year extends "2022" ? Rebate2022 :
  Year extends "2023" ? Rebate2023 :
  Year extends "2024" ? Rebate2024 :
  never;

/** Formio SAM.gov entity combo key field name by rebate year. */
const comboKeyFieldNamesByYear = {
  "2022": "bap_hidden_entity_combo_key",
  "2023": "_bap_entity_combo_key",
  "2024": "_bap_entity_combo_key",
} as const;

/** Formio CSB Rebate Id field name by rebate year. */
const rebateIdFieldNamesByYear = {
  "2022": "hidden_bap_rebate_id",
  "2023": "_bap_rebate_id",
  "2024": "_bap_rebate_id",
} as const;

export function getComboKeyFieldName<
  Year extends keyof typeof comboKeyFieldNamesByYear,
>(rebateYear: Year): (typeof comboKeyFieldNamesByYear)[Year] {
  return comboKeyFieldNamesByYear[rebateYear];
}

export function getRebateIdFieldName<
  Year extends keyof typeof rebateIdFieldNamesByYear,
>(rebateYear: Year): (typeof rebateIdFieldNamesByYear)[Year] {
  return rebateIdFieldNamesByYear[rebateYear];
}

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
  const query = useQuery({
    queryKey: ["content"],
    queryFn: () => getData<Content>(`${serverUrl}/api/content`),
    refetchOnWindowFocus: false,
  });

  return query;
}

/** Custom hook that returns cached fetched content data. */
export function useContentData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<Content>(["content"]);
}

/** Custom hook to fetch user data. */
export function useUserQuery() {
  const query = useQuery({
    queryKey: ["user"],
    queryFn: () => getData<UserData>(`${serverUrl}/api/user`),
    enabled: false,
    retry: false,
  });

  return query;
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

/** Custom hook to fetch CSB config and set Formio URLs and rebate year. */
export function useConfigQuery() {
  const state = useRebateYearState();
  const { setRebateYear } = useRebateYearActions();

  const query = useQuery({
    queryKey: ["config"],
    queryFn: () => getData<ConfigData>(`${serverUrl}/api/config`),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const { formioBaseUrl, formioProjectName, rebateYear } = query.data ?? {};

    if (query.status === "success" && formioBaseUrl) {
      Formio.setBaseUrl(formioBaseUrl);
    }

    if (query.status === "success" && formioBaseUrl && formioProjectName) {
      Formio.setProjectUrl(`${formioBaseUrl}/${formioProjectName}`);
    }

    if (query.status === "success" && rebateYear) {
      /**
       * NOTE: `state.rebateYear` is initialized as null, so only redefine it on
       * the initial config data fetch.
       */
      if (state.rebateYear === null) {
        setRebateYear(rebateYear);
      }
    }
  }, [query.status, query.data, state.rebateYear, setRebateYear]);

  return query;
}

/** Custom hook that returns cached fetched CSB config. */
export function useConfigData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<ConfigData>(["config"]);
}

/**
 * Custom hook to fetch BAP SAM.gov data and handle logging user out if they
 * have no SAM.gov results or if there was an error fetching the data.
 */
export function useBapSamQuery() {
  const query = useQuery({
    queryKey: ["bap/sam"],
    queryFn: () => getData<BapSamData>(`${serverUrl}/api/bap/sam`),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const { results } = query.data ?? {};

    if (query.status === "success" && !results) {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?info=bap-sam-results`;
    }

    if (query.status === "error") {
      window.location.href = `${serverUrl}/logout?RelayState=/welcome?error=bap-sam-fetch`;
    }
  }, [query.status, query.data]);

  return query;
}

/** Custom hook that returns cached fetched BAP SAM.gov data. */
export function useBapSamData() {
  const queryClient = useQueryClient();
  return queryClient.getQueryData<BapSamData>(["bap/sam"]);
}

/** Custom hook to fetch a PDF of a form submission from Formio. */
export function useSubmissionPDFQuery(options: {
  rebateYear: RebateYear;
  formType: CSBFormType;
  mongoId: string | undefined;
}) {
  const { rebateYear, formType, mongoId } = options;

  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({
      queryKey: [`formio/${rebateYear}/${formType}-pdf`],
    });
  }, [queryClient, formType, rebateYear]);

  const query = useQuery({
    queryKey: [`formio/${rebateYear}/${formType}-pdf`, { id: mongoId }],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/${rebateYear}/pdf/${formType}/${mongoId}`;
      return getData<string>(url);
    },
    enabled: false,
  });

  async function downloadPDF() {
    if (!mongoId) return;

    const result = await query.refetch();

    if (result.data) {
      const link = document.createElement("a");
      link.setAttribute("href", `data:application/pdf;base64,${result.data}`);
      link.setAttribute("download", `${mongoId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  return { ...query, downloadPDF };
}

/** Custom hook to fetch Change Request form submissions from Formio. */
export function useChangeRequestsQuery<Year extends RebateYear>(
  rebateYear: Year,
): UseQueryResult<FormioChangeRequestsByYear<Year>> {
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
      return getData<FormioChange2023DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const changeRequest2024Query = {
    queryKey: ["formio/2024/changes"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2024/changes`;
      return getData<FormioChange2024DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  /* NOTE: Fallback (not used, as rebate year will match a query above) */
  const changeRequestFallbackQuery = {
    queryKey: ["formio/changes"],
    queryFn: () => Promise.resolve([]),
    refetchOnWindowFocus: false,
  };

  const query: UseQueryOptions<FormioChangeRequestsByYear<RebateYear>> =
    rebateYear === "2022"
      ? changeRequest2022Query
      : rebateYear === "2023"
        ? changeRequest2023Query
        : rebateYear === "2024"
          ? changeRequest2024Query
          : changeRequestFallbackQuery;

  return useQuery(query) as UseQueryResult<FormioChangeRequestsByYear<Year>>;
}

/**
 * Custom hook that returns cached fetched Change Request form submissions from
 * Formio.
 */
export function useChangeRequests<Year extends RebateYear>(
  rebateYear: Year,
): FormioChangeRequestsByYear<Year> {
  const queryClient = useQueryClient();

  const changeRequest2022Data = queryClient.getQueryData<[]>(["formio/2022/changes"]); // prettier-ignore
  const changeRequest2023Data = queryClient.getQueryData<FormioChange2023DashboardSubmission[]>(["formio/2023/changes"]); // prettier-ignore
  const changeRequest2024Data = queryClient.getQueryData<FormioChange2024DashboardSubmission[]>(["formio/2024/changes"]); // prettier-ignore

  const result: FormioChangeRequestsByYear<RebateYear> =
    rebateYear === "2022"
      ? changeRequest2022Data
      : rebateYear === "2023"
        ? changeRequest2023Data
        : rebateYear === "2024"
          ? changeRequest2024Data
          : undefined;

  return result as FormioChangeRequestsByYear<Year>;
}

/** Custom hook to fetch submissions from the BAP and Formio. */
export function useSubmissionsQueries<Year extends RebateYear>(
  rebateYear: Year,
): UseQueryResult<BapAndFormioSubmissionsByYear<Year>>[] {
  const bapQuery = {
    queryKey: ["bap/submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/bap/submissions`;
      return getData<BapFormSubmission[]>(url).then((res) => {
        if (!Array.isArray(res)) {
          return Promise.reject(res);
        }

        const submissions: BapFormSubmissions = res.reduce(
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
            2024: {
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
      return getData<FormioFRF2022DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioPRF2022Query = {
    queryKey: ["formio/2022/prf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2022/prf-submissions`;
      return getData<FormioPRF2022DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioCRF2022Query = {
    queryKey: ["formio/2022/crf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2022/crf-submissions`;
      return getData<FormioCRF2022DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioFRF2023Query = {
    queryKey: ["formio/2023/frf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/frf-submissions`;
      return getData<FormioFRF2023DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioPRF2023Query = {
    queryKey: ["formio/2023/prf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/prf-submissions`;
      return getData<FormioPRF2023DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioCRF2023Query = {
    queryKey: ["formio/2023/crf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2023/crf-submissions`;
      return getData<FormioCRF2023DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioFRF2024Query = {
    queryKey: ["formio/2024/frf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2024/frf-submissions`;
      return getData<FormioFRF2024DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioPRF2024Query = {
    queryKey: ["formio/2024/prf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2024/prf-submissions`;
      return getData<FormioPRF2024DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const formioCRF2024Query = {
    queryKey: ["formio/2024/crf-submissions"],
    queryFn: () => {
      const url = `${serverUrl}/api/formio/2024/crf-submissions`;
      return getData<FormioCRF2024DashboardSubmission[]>(url);
    },
    refetchOnWindowFocus: false,
  };

  const queries: UseQueryOptions<BapAndFormioSubmissionsByYear<RebateYear>>[] =
    rebateYear === "2022"
      ? [bapQuery, formioFRF2022Query, formioPRF2022Query, formioCRF2022Query]
      : rebateYear === "2023"
        ? [bapQuery, formioFRF2023Query, formioPRF2023Query, formioCRF2023Query]
        : rebateYear === "2024"
          ? [bapQuery, formioFRF2024Query, formioPRF2024Query, formioCRF2024Query] // prettier-ignore
          : [];

  return useQueries({ queries }) as UseQueryResult<
    BapAndFormioSubmissionsByYear<Year>
  >[];
}

/**
 * Custom hook to combine FRF submissions, PRF submissions, and CRF submissions
 * from both the BAP and Formio into a single object, with the BAP assigned
 * rebateId as the object's keys.
 **/
function useCombinedSubmissions<Year extends RebateYear>(
  rebateYear: Year,
): { [rebateId: string]: RebateByYear<Year> } {
  const queryClient = useQueryClient();

  const bapFormSubmissions = queryClient.getQueryData<BapFormSubmissions>(["bap/submissions"]); // prettier-ignore

  const formioFRF2022Data = queryClient.getQueryData<FormioFRF2022DashboardSubmission[]>(["formio/2022/frf-submissions"]); // prettier-ignore
  const formioFRF2023Data = queryClient.getQueryData<FormioFRF2023DashboardSubmission[]>(["formio/2023/frf-submissions"]); // prettier-ignore
  const formioFRF2024Data = queryClient.getQueryData<FormioFRF2024DashboardSubmission[]>(["formio/2024/frf-submissions"]); // prettier-ignore

  const formioPRF2022Data = queryClient.getQueryData<FormioPRF2022DashboardSubmission[]>(["formio/2022/prf-submissions"]); // prettier-ignore
  const formioPRF2023Data = queryClient.getQueryData<FormioPRF2023DashboardSubmission[]>(["formio/2023/prf-submissions"]); // prettier-ignore
  const formioPRF2024Data = queryClient.getQueryData<FormioPRF2024DashboardSubmission[]>(["formio/2024/prf-submissions"]); // prettier-ignore

  const formioCRF2022Data = queryClient.getQueryData<FormioCRF2022DashboardSubmission[]>(["formio/2022/crf-submissions"]); // prettier-ignore
  const formioCRF2023Data = queryClient.getQueryData<FormioCRF2023DashboardSubmission[]>(["formio/2023/crf-submissions"]); // prettier-ignore
  const formioCRF2024Data = queryClient.getQueryData<FormioCRF2024DashboardSubmission[]>(["formio/2024/crf-submissions"]); // prettier-ignore

  const formioFRFSubmissions =
    rebateYear === "2022"
      ? formioFRF2022Data
      : rebateYear === "2023"
        ? formioFRF2023Data
        : rebateYear === "2024"
          ? formioFRF2024Data
          : undefined;

  const formioPRFSubmissions =
    rebateYear === "2022"
      ? formioPRF2022Data
      : rebateYear === "2023"
        ? formioPRF2023Data
        : rebateYear === "2024"
          ? formioPRF2024Data
          : undefined;

  const formioCRFSubmissions =
    rebateYear === "2022"
      ? formioCRF2022Data
      : rebateYear === "2023"
        ? formioCRF2023Data
        : rebateYear === "2024"
          ? formioCRF2024Data
          : undefined;

  const submissions: {
    [rebateId: string]: RebateByYear<Year>;
  } = {};

  /* ensure form submissions data has been fetched from both the BAP and Formio */
  if (
    !bapFormSubmissions ||
    !formioFRFSubmissions ||
    !formioPRFSubmissions ||
    !formioCRFSubmissions
  ) {
    return submissions;
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
    } as RebateByYear<Year>;
  }

  /**
   * Iterate over Formio PRF submissions, matching them with submissions
   * returned from the BAP, so we can set BAP PRF submission data.
   */
  for (const formioPRFSubmission of formioPRFSubmissions) {
    const formioBapPrfRebateIdField = formioBapRebateIdField[rebateYear].prf;
    const formioBapRebateId =
      (formioPRFSubmission.data?.[formioBapPrfRebateIdField] as string) || null;

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
      } as RebateByYear<Year>["prf"];
    }
  }

  /**
   * Iterate over Formio CRF submissions, matching them with submissions
   * returned from the BAP, so we can set BAP CRF submission data.
   */
  for (const formioCRFSubmission of formioCRFSubmissions) {
    const formioBapCrfRebateIdField = formioBapRebateIdField[rebateYear].crf;
    const formioBapRebateId =
      (formioCRFSubmission.data?.[formioBapCrfRebateIdField] as string) || null;

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
      } as RebateByYear<Year>["crf"];
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
function useSortedSubmissions<Year extends RebateYear>(rebates: {
  [rebateId: string]: RebateByYear<Year>;
}): (RebateByYear<Year> & { rebateId: string })[] {
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
export function useSubmissions<Year extends RebateYear>(rebateYear: Year) {
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
  bap: BapSubmissionData | null;
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
 * Determines whether a SAM.gov entity is active.
 */
export function entityIsActive(entity: BapSamEntity) {
  return entity.ENTITY_STATUS__c === "Active";
}

/**
 * Determines whether a SAM.gov entity has an exclusion status.
 */
export function entityHasExclusionStatus(entity: BapSamEntity) {
  return entity.EXCLUSION_STATUS_FLAG__c === "D";
}

/**
 * Determines whether a SAM.gov entity has a debt subject to offset.
 */
export function entityHasDebtSubjectToOffset(entity: BapSamEntity) {
  return entity.DEBT_SUBJECT_TO_OFFSET_FLAG__c === "Y";
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
