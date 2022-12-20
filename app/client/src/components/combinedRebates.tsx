import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
// ---
import { serverUrl, messages, getData } from "../config";
import { Loading } from "components/loading";
import { Message } from "components/message";
import type { BapFormSubmission } from "contexts/bap";
import { useBapState, useBapDispatch } from "contexts/bap";
import type {
  FormioApplicationSubmission,
  FormioPaymentRequestSubmission,
} from "contexts/formioSubmissions";
import {
  useFormioSubmissionsState,
  useFormioSubmissionsDispatch,
} from "contexts/formioSubmissions";
import type {
  FormioSubmission,
  BapSubmission,
  Rebate,
} from "contexts/combinedRebates";
import { useCombinedRebatesDispatch } from "contexts/combinedRebates";

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

/** Custom hook to fetch submissions from the BAP and Forms.gov */
function useFetchedFormSubmissions() {
  const { samEntities } = useBapState();
  const bapDispatch = useBapDispatch();
  const formioSubmissionsDispatch = useFormioSubmissionsDispatch();

  useEffect(() => {
    // while not used in this code, SAM.gov entities are used in the server
    // app's `/api/bap-form-submissions` route controller
    if (samEntities.status !== "success" || !samEntities.data.results) return;

    bapDispatch({
      type: "FETCH_BAP_FORM_SUBMISSIONS_REQUEST",
    });

    formioSubmissionsDispatch({
      type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_REQUEST",
    });

    formioSubmissionsDispatch({
      type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST",
    });

    Promise.all([
      getData(`${serverUrl}/api/bap-form-submissions`),
      getData(`${serverUrl}/api/formio-application-submissions`),
      getData(`${serverUrl}/api/formio-payment-request-submissions`),
    ])
      .then(
        (
          responses: [
            BapFormSubmission[],
            FormioApplicationSubmission[],
            FormioPaymentRequestSubmission[]
          ]
        ) => {
          const [
            bapFormSubmissionsRes,
            formioApplicationFormSubmissionsRes,
            formioPaymentRequestSubmissionsRes,
          ] = responses;

          const bapFormSubmissions = bapFormSubmissionsRes.reduce(
            (submissions, submission) => {
              const formType =
                submission.Record_Type_Name__c === "CSB Funding Request"
                  ? "applications"
                  : submission.Record_Type_Name__c === "CSB Payment Request"
                  ? "paymentRequests"
                  : submission.Record_Type_Name__c === "CSB Closeout Request"
                  ? "closeOuts"
                  : null;

              if (formType) submissions[formType].push(submission);

              return submissions;
            },
            {
              applications: [] as BapFormSubmission[],
              paymentRequests: [] as BapFormSubmission[],
              closeOuts: [] as BapFormSubmission[],
            }
          );

          bapDispatch({
            type: "FETCH_BAP_FORM_SUBMISSIONS_SUCCESS",
            payload: {
              formSubmissions: bapFormSubmissions,
            },
          });

          formioSubmissionsDispatch({
            type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_SUCCESS",
            payload: {
              applicationSubmissions: formioApplicationFormSubmissionsRes,
            },
          });

          formioSubmissionsDispatch({
            type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_SUCCESS",
            payload: {
              paymentRequestSubmissions: formioPaymentRequestSubmissionsRes,
            },
          });
        }
      )
      .catch((err) => {
        bapDispatch({
          type: "FETCH_BAP_FORM_SUBMISSIONS_FAILURE",
        });

        formioSubmissionsDispatch({
          type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_FAILURE",
        });

        formioSubmissionsDispatch({
          type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_FAILURE",
        });
      });
  }, [samEntities, bapDispatch, formioSubmissionsDispatch]);
}

/**
 * Custom hook to combine Application form submissions data, Payment Request
 * form submissions data, and Close-Out form submissions data from both the BAP
 * and Formio into a single `submissions` object, with the BAP assigned
 * `rebateId` as the keys.
 **/
function useCombinedSubmissions() {
  const { formSubmissions: bapFormSubmissions } = useBapState();
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioSubmissionsState();

  // ensure form submissions data has been fetched from both the BAP and Formio
  if (
    bapFormSubmissions.status !== "success" ||
    formioApplicationSubmissions.status !== "success" ||
    formioPaymentRequestSubmissions.status !== "success"
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
  for (const formioSubmission of formioApplicationSubmissions.data) {
    const bapMatch = bapFormSubmissions.data.applications.find((bapSub) => {
      return bapSub.CSB_Form_ID__c === formioSubmission._id;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status =
      bapMatch?.Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c || null;

    /**
     * NOTE: If new Application form submissions have been reciently created in
     * Formio and the BAP's ETL process has not yet run to pickup those new
     * Formio submissions, all of the fields above will be null, so instead of
     * assigning the submission's key as `rebateId` (which will be null), we'll
     * assign it to be an underscore concatenated with the Formio submission's
     * mongoDB ObjectID – just so each submission object still has a unique ID.
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
  for (const formioSubmission of formioPaymentRequestSubmissions.data) {
    const formioBapRebateId = formioSubmission.data.hidden_bap_rebate_id;

    const bapMatch = bapFormSubmissions.data.paymentRequests.find((bapSub) => {
      return bapSub.Parent_Rebate_ID__c === formioBapRebateId;
    });

    const modified = bapMatch?.CSB_Modified_Full_String__c || null;
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const status =
      bapMatch?.Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c || null;

    /**
     * NOTE: If the BAP ETL is running, there should be a submission with a
     * `formioBapRebateId` key for each Formio Payment Request form submission
     * (as it would have been set in the `formioApplicationSubmissions.data`
     * loop above). That said, we should first check that it exists before
     * assigning the Payment Request data to it, so if the BAP ETL process isn't
     * returning data, it won't break our app.
     */
    if (rebates[formioBapRebateId]) {
      rebates[formioBapRebateId].paymentRequest = {
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

      const r1ApplicationSelected = r1.application.bap?.status === "Accepted";

      const r1ApplicationSelectedButNoPaymentRequest =
        r1ApplicationSelected && !Boolean(r1.paymentRequest.formio);

      return r1ApplicationNeedsEdits || r1ApplicationSelectedButNoPaymentRequest
        ? -1
        : 0;
    });
}

export function CombinedRebates({ children }: { children: JSX.Element }) {
  const [searchParams] = useSearchParams();

  const { formSubmissions: bapFormSubmissions } = useBapState();
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioSubmissionsState();
  const combinedRebatesDispatch = useCombinedRebatesDispatch();

  combinedRebatesDispatch({ type: "RESET_COMBINED_REBATES" });

  useFetchedFormSubmissions();

  const combinedRebates = useCombinedSubmissions();
  const sortedRebates = useSortedRebates(combinedRebates);

  combinedRebatesDispatch({
    type: "SET_COMBINED_REBATES",
    payload: { rebates: sortedRebates },
  });

  // log 'sortedRebates' array if 'debug' search parameter exists
  useEffect(() => {
    if (searchParams.has("debug") && sortedRebates.length > 0) {
      console.log(sortedRebates);
    }
  }, [searchParams, sortedRebates]);

  if (
    bapFormSubmissions.status === "idle" ||
    bapFormSubmissions.status === "pending" ||
    formioApplicationSubmissions.status === "idle" ||
    formioApplicationSubmissions.status === "pending" ||
    formioPaymentRequestSubmissions.status === "idle" ||
    formioPaymentRequestSubmissions.status === "pending"
  ) {
    return <Loading />;
  }

  if (
    bapFormSubmissions.status === "failure" ||
    formioApplicationSubmissions.status === "failure" ||
    formioPaymentRequestSubmissions.status === "failure"
  ) {
    return <Message type="error" text={messages.formSubmissionsError} />;
  }

  console.log("combinedRebates rendering");

  return children;
}
