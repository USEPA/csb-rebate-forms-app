import { Fragment, useEffect, useState } from "react";
import type { LinkProps } from "react-router-dom";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading, LoadingButtonIcon } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import type { BapFormSubmission } from "contexts/bap";
import { useBapState, useBapDispatch } from "contexts/bap";
import {
  FormioApplicationSubmission,
  FormioPaymentRequestSubmission,
  FormioCloseOutSubmission,
  useFormioSubmissionsState,
  useFormioSubmissionsDispatch,
} from "contexts/formioSubmissions";
import {
  usePageMessageState,
  usePageMessageDispatch,
} from "contexts/pageMessage";

type LocationState = {
  submissionSuccessMessage: string;
};

type FormioSubmission =
  | FormioApplicationSubmission
  | FormioPaymentRequestSubmission
  | FormioCloseOutSubmission;

type BapSubmission = {
  modified: string | null;
  comboKey: string | null;
  rebateId: string | null;
  reviewItemId: string | null;
  status: string | null;
};

type Rebate = {
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

const defaultTableRowClassNames = "bg-gray-5";
const highlightedTableRowClassNames = "bg-primary-lighter";

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

/** Custom hook to fetch form submissions from the BAP */
export function useFetchedBapFormSubmissions() {
  const { samEntities } = useBapState();
  const bapDispatch = useBapDispatch();

  useEffect(() => {
    // while not used in this code, SAM.gov entities are used in the server
    // app's `/api/bap-form-submissions` route controller
    if (samEntities.status !== "success" || !samEntities.data.results) return;

    bapDispatch({ type: "FETCH_BAP_FORM_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/bap-form-submissions`)
      .then((res: BapFormSubmission[]) => {
        const formSubmissions = res.reduce(
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
          payload: { formSubmissions },
        });
      })
      .catch((err) => {
        bapDispatch({ type: "FETCH_BAP_FORM_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, bapDispatch]);
}

/** Custom hook to fetch Application form submissions from Forms.gov */
function useFetchedFormioApplicationSubmissions() {
  const { samEntities } = useBapState();
  const formioSubmissionsDispatch = useFormioSubmissionsDispatch();

  useEffect(() => {
    // while not used in this code, SAM.gov entities are used in the server
    // app's `/api/formio-application-submissions` route controller
    if (samEntities.status !== "success" || !samEntities.data.results) return;

    formioSubmissionsDispatch({
      type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_REQUEST",
    });

    getData(`${serverUrl}/api/formio-application-submissions`)
      .then((res) => {
        formioSubmissionsDispatch({
          type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_SUCCESS",
          payload: { applicationSubmissions: res },
        });
      })
      .catch((err) => {
        formioSubmissionsDispatch({
          type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_FAILURE",
        });
      });
  }, [samEntities, formioSubmissionsDispatch]);
}

/** Custom hook to fetch Payment Request form submissions from Forms.gov */
function useFetchedFormioPaymentRequestSubmissions() {
  const { samEntities } = useBapState();
  const formioSubmissionsDispatch = useFormioSubmissionsDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) return;

    formioSubmissionsDispatch({
      type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST",
    });

    getData(`${serverUrl}/api/formio-payment-request-submissions`)
      .then((res) => {
        formioSubmissionsDispatch({
          type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_SUCCESS",
          payload: { paymentRequestSubmissions: res },
        });
      })
      .catch((err) => {
        formioSubmissionsDispatch({
          type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_FAILURE",
        });
      });
  }, [samEntities, formioSubmissionsDispatch]);
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

  const submissions: { [rebateId: string]: Rebate } = {};

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
    submissions[rebateId || `_${formioSubmission._id}`] = {
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
    if (submissions[formioBapRebateId]) {
      submissions[formioBapRebateId].paymentRequest = {
        formio: { ...formioSubmission },
        bap: { modified, comboKey, rebateId, reviewItemId, status },
      };
    }
  }

  return submissions;
}

/**
 * Custom hook that sorts submissions by most recient formio modified date,
 * regardless of form (Application, Payment Request, or Close-Out).
 **/
function useSortedSubmissions(submissions: { [rebateId: string]: Rebate }) {
  return Object.entries(submissions)
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

function PageMessage() {
  const { displayed, type, text } = usePageMessageState();
  if (!displayed) return null;
  return <Message type={type} text={text} />;
}

function ButtonLink(props: { type: "edit" | "view"; to: LinkProps["to"] }) {
  const icon = props.type === "edit" ? "edit" : "visibility";
  const text = props.type === "edit" ? "Edit" : "View";
  const linkClassNames =
    `usa-button ` +
    `${props.type === "view" ? "usa-button--base " : ""}` +
    `font-sans-2xs margin-right-0 padding-x-105 padding-y-1`;

  return (
    <Link to={props.to} className={linkClassNames}>
      <span className="display-flex flex-align-center">
        <svg
          className="usa-icon"
          aria-hidden="true"
          focusable="false"
          role="img"
        >
          <use href={`${icons}#${icon}`} />
        </svg>
        <span className="margin-left-1">{text}</span>
      </span>
    </Link>
  );
}

function ApplicationSubmission({ rebate }: { rebate: Rebate }) {
  const { csbData } = useCsbState();

  if (csbData.status !== "success") return null;

  const applicationFormOpen = csbData.data.submissionPeriodOpen.application;

  const { application, paymentRequest } = rebate;

  const {
    applicantUEI,
    applicantEfti,
    applicantEfti_display,
    applicantOrganizationName,
    schoolDistrictName,
    last_updated_by,
  } = application.formio.data;

  const date = new Date(application.formio.modified).toLocaleDateString();
  const time = new Date(application.formio.modified).toLocaleTimeString();

  const applicationNeedsEdits = submissionNeedsEdits({
    formio: application.formio,
    bap: application.bap,
  });

  const applicationHasBeenWithdrawn = application.bap?.status === "Withdrawn";

  const applicationNotSelected =
    paymentRequest.bap?.status === "Coordinator Denied";

  const applicationSelected = application.bap?.status === "Accepted";

  const applicationSelectedButNoPaymentRequest =
    applicationSelected && !Boolean(paymentRequest.formio);

  const statusTableCellClassNames =
    application.formio.state === "submitted" || !applicationFormOpen
      ? "text-italic"
      : "";

  const statusIcon = applicationNeedsEdits
    ? `${icons}#priority_high` // !
    : applicationHasBeenWithdrawn
    ? `${icons}#close` // ✕
    : applicationNotSelected
    ? `${icons}#check` // TODO: eventually use 'cancel' icon if we show 'Not Selected'
    : applicationSelected
    ? `${icons}#check_circle` // check inside a circle
    : application.formio.state === "draft"
    ? `${icons}#more_horiz` // three horizontal dots
    : application.formio.state === "submitted"
    ? `${icons}#check` // check
    : `${icons}#remove`; // — (fallback, not used)

  const statusText = applicationNeedsEdits
    ? "Edits Requested"
    : applicationHasBeenWithdrawn
    ? "Withdrawn"
    : applicationNotSelected
    ? "Submitted" // TODO: eventually show 'Not Selected'
    : applicationSelected
    ? "Selected"
    : application.formio.state === "draft"
    ? "Draft"
    : application.formio.state === "submitted"
    ? "Submitted"
    : ""; // fallback, not used

  const applicationFormUrl = `/rebate/${application.formio._id}`;

  /**
   * NOTE on the usage of `TextWithTooltip` below:
   * When a form is first initially created, and the user has not yet clicked
   * the "Next" or "Save" buttons, any fields that the Formio form definition
   * sets automatically (based on hidden fields we inject on form creation) will
   * not yet be part of the form submission data. As soon as the user clicks the
   * "Next" or "Save" buttons the first time, those fields will be set and
   * stored in the submission. Since we display some of those fields in the
   * table below, we need to check if their values exist, and if they don't (for
   * cases where the user has not yet advanced past the first screen of the
   * form...which we believe is a bit of an edge case, as most users will likely
   * do that after starting a new application), indicate to the user they need
   * to first save the form for the fields to be displayed.
   */
  return (
    <tr
      className={
        applicationNeedsEdits || applicationSelectedButNoPaymentRequest
          ? highlightedTableRowClassNames
          : defaultTableRowClassNames
      }
    >
      <th scope="row" className={statusTableCellClassNames}>
        {applicationNeedsEdits ? (
          <ButtonLink type="edit" to={applicationFormUrl} />
        ) : application.formio.state === "submitted" || !applicationFormOpen ? (
          <ButtonLink type="view" to={applicationFormUrl} />
        ) : application.formio.state === "draft" ? (
          <ButtonLink type="edit" to={applicationFormUrl} />
        ) : null}
      </th>

      <td className={statusTableCellClassNames}>
        {application.bap?.rebateId ? (
          <span title={`Application ID: ${application.formio._id}`}>
            {application.bap.rebateId}
          </span>
        ) : (
          <TextWithTooltip
            text=" "
            tooltip="Rebate ID should be displayed within 24hrs. after starting a new rebate form application"
          />
        )}
      </td>

      <td className={statusTableCellClassNames}>
        <span>Application</span>
        <br />
        <span className="display-flex flex-align-center font-sans-2xs">
          <svg
            className={`usa-icon ${applicationSelected ? "text-primary" : ""}`}
            aria-hidden="true"
            focusable="false"
            role="img"
          >
            <use href={statusIcon} />
          </svg>
          <span className="margin-left-05">{statusText}</span>
        </span>
      </td>

      <td className={statusTableCellClassNames}>
        <>
          {Boolean(applicantUEI) ? (
            applicantUEI
          ) : (
            <TextWithTooltip
              text=" "
              tooltip="Please edit and save the form and the UEI will be displayed"
            />
          )}
          <br />
          {
            /* NOTE:
Initial version of the application form definition included the `applicantEfti`
field, which is configured via the form definition (in Formio/Forms.gov) to set
its value based on the value of the `sam_hidden_applicant_efti` field, which we
inject on initial form submission. That value comes from the BAP (SAM.gov data),
which could be an empty string.

To handle the potentially empty string, the Formio form definition was updated
to include a new `applicantEfti_display` field that's configured in the form
definition to set it's value to the string '0000' if the `applicantEfti` field's
value is an empty string. This logic (again, built into the form definition)
works great for new form submissions that have taken place after the form
definition has been updated to include this `applicantEfti_display` field... */
            Boolean(applicantEfti_display) ? (
              applicantEfti_display
            ) : /* NOTE:
...but we need to handle old/existing submissions that were submitted before the
form definition was updated to include the new `applicantEfti_display` field,
and where the user has already advanced past the first screen (e.g. they've hit
the "Next" or "Save" buttons at least once).

At this point the form definition logic has already kicked in that sets the
`applicaitonEfti` field, but it's value _could_ be an empty string (it won't
necessairly be, but it could be). Since the `applicantEfti` field's value could
be an empty string (which is falsy in JavaScript), we need to check another
field's value that will also set at this point, and whose value will always be
truthy. We'll check the `applicantUEI` field's value, as it's value will always
be set for users that have advanced past the first screen (we could have just as
easily used another field, like the `applicantOrganizationName` field for the
same result). */
            Boolean(applicantUEI) ? (
              /* NOTE:
If the `applicantUEI` field's value is truthy, we know the user has advanced
past the first screen, so we'll render the value of the `applicantEfti` field,
and fall back to "0000", which will be used in cases where the `applicantEfti`
field's value is an empty string. */
              applicantEfti || "0000"
            ) : (
              /* NOTE:
At this point in the conditional logic, we know the user has not advanced past
the first screen, so we'll render the tooltip, indicating the user must edit and
save the form for the EFT indicator to be displayed. */
              <TextWithTooltip
                text=" "
                tooltip="Please edit and save the form and the EFT Indicator will be displayed"
              />
            )
          }
        </>
      </td>

      <td className={statusTableCellClassNames}>
        <>
          {Boolean(applicantOrganizationName) ? (
            applicantOrganizationName
          ) : (
            <TextWithTooltip
              text=" "
              tooltip="Please edit and save the form and the Applicant will be displayed"
            />
          )}
          <br />
          {Boolean(schoolDistrictName) ? (
            schoolDistrictName
          ) : (
            <TextWithTooltip
              text=" "
              tooltip="School District will be displayed after that field has been entered in the form"
            />
          )}
        </>
      </td>

      <td className={statusTableCellClassNames}>
        {last_updated_by}
        <br />
        <span title={`${date} ${time}`}>{date}</span>
      </td>
    </tr>
  );
}

function PaymentRequestSubmission({ rebate }: { rebate: Rebate }) {
  const navigate = useNavigate();

  const { csbData } = useCsbState();
  const { epaUserData } = useUserState();
  const { samEntities } = useBapState();
  const pageMessageDispatch = usePageMessageDispatch();

  // NOTE: used to display a loading indicator inside the new Payment Request button
  const [postDataResponsePending, setPostDataResponsePending] = useState(false);

  if (csbData.status !== "success") return null;
  if (epaUserData.status !== "success") return null;
  if (samEntities.status !== "success") return null;

  const paymentRequestFormOpen =
    csbData.data.submissionPeriodOpen.paymentRequest;

  const email = epaUserData.data.mail;
  const { application, paymentRequest } = rebate;

  const applicationSelected = application.bap?.status === "Accepted";

  const applicationSelectedButNoPaymentRequest =
    applicationSelected && !Boolean(paymentRequest.formio);

  /** matched SAM.gov entity for the application */
  const entity = samEntities.data.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c ===
        application.formio.data.bap_hidden_entity_combo_key
    );
  });

  if (applicationSelectedButNoPaymentRequest) {
    return (
      <tr className={highlightedTableRowClassNames}>
        <th scope="row" colSpan={6}>
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            onClick={(ev) => {
              if (!application.bap?.rebateId || !entity) return;

              setPostDataResponsePending(true);
              pageMessageDispatch({ type: "RESET_MESSAGE" });

              const { title, name } = getUserInfo(email, entity);

              // create a new draft payment request submission
              postData(`${serverUrl}/api/formio-payment-request-submission/`, {
                email,
                title,
                name,
                entity,
                comboKey: application.bap.comboKey,
                rebateId: application.bap.rebateId, // CSB Rebate ID (6 digits)
                reviewItemId: application.bap.reviewItemId, // CSB Rebate ID w/ form/version ID (9 digits)
                applicationFormModified: application.bap.modified,
              })
                .then((res) => {
                  setPostDataResponsePending(false);
                  navigate(`/payment-request/${application.bap?.rebateId}`);
                })
                .catch((err) => {
                  setPostDataResponsePending(false);
                  const text = `Error creating Payment Request ${application.bap?.rebateId}. Please try again.`;
                  pageMessageDispatch({
                    type: "DISPLAY_MESSAGE",
                    payload: { type: "error", text },
                  });
                });
            }}
          >
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#add_circle`} />
              </svg>
              <span className="margin-left-1">New Payment Request</span>
              {postDataResponsePending && <LoadingButtonIcon />}
            </span>
          </button>
        </th>
      </tr>
    );
  }

  // return if a Payment Request submission has not been created for this rebate
  if (!paymentRequest.formio) return null;

  const { hidden_current_user_email, hidden_bap_rebate_id } =
    paymentRequest.formio.data;

  const date = new Date(paymentRequest.formio.modified).toLocaleDateString();
  const time = new Date(paymentRequest.formio.modified).toLocaleTimeString();

  const applicationNeedsEdits = submissionNeedsEdits({
    formio: application.formio,
    bap: application.bap,
  });

  const paymentRequestNeedsEdits = submissionNeedsEdits({
    formio: paymentRequest.formio,
    bap: paymentRequest.bap,
  });

  const paymentRequestNeedsClarification =
    paymentRequest.bap?.status === "Needs Clarification";

  const paymentRequestHasBeenWithdrawn =
    paymentRequest.bap?.status === "Withdrawn";

  const paymentRequestFundingNotApproved =
    paymentRequest.bap?.status === "Coordinator Denied";

  const paymentRequestFundingApproved =
    paymentRequest.bap?.status === "Accepted";

  const statusTableCellClassNames =
    paymentRequest.formio.state === "submitted" || !paymentRequestFormOpen
      ? "text-italic"
      : "";

  const statusIcon = paymentRequestNeedsEdits
    ? `${icons}#priority_high` // !
    : paymentRequestHasBeenWithdrawn
    ? `${icons}#close` // ✕
    : paymentRequestFundingNotApproved
    ? `${icons}#cancel` // ✕ inside a circle
    : paymentRequestFundingApproved
    ? `${icons}#check_circle` // check inside a circle
    : paymentRequest.formio.state === "draft"
    ? `${icons}#more_horiz` // three horizontal dots
    : paymentRequest.formio.state === "submitted"
    ? `${icons}#check` // check
    : `${icons}#remove`; // — (fallback, not used)

  const statusText = paymentRequestNeedsEdits
    ? "Edits Requested"
    : paymentRequestHasBeenWithdrawn
    ? "Withdrawn"
    : paymentRequestFundingNotApproved
    ? "Funding Not Approved"
    : paymentRequestFundingApproved
    ? "Funding Approved"
    : paymentRequest.formio.state === "draft"
    ? "Draft"
    : paymentRequest.formio.state === "submitted"
    ? "Submitted"
    : ""; // fallback, not used

  const paymentRequestFormUrl = `/payment-request/${hidden_bap_rebate_id}`;

  return (
    <tr
      className={
        paymentRequestNeedsEdits
          ? highlightedTableRowClassNames
          : defaultTableRowClassNames
      }
    >
      <th scope="row" className={statusTableCellClassNames}>
        {applicationNeedsEdits ? (
          <ButtonLink type="view" to={paymentRequestFormUrl} />
        ) : paymentRequestNeedsEdits ? (
          <ButtonLink type="edit" to={paymentRequestFormUrl} />
        ) : paymentRequest.formio.state === "submitted" ||
          !paymentRequestFormOpen ? (
          <ButtonLink type="view" to={paymentRequestFormUrl} />
        ) : paymentRequest.formio.state === "draft" ? (
          <ButtonLink type="edit" to={paymentRequestFormUrl} />
        ) : null}
      </th>

      <td className={statusTableCellClassNames}>&nbsp;</td>

      <td className={statusTableCellClassNames}>
        <span>Payment Request</span>
        <br />
        <span className="display-flex flex-align-center font-sans-2xs">
          {paymentRequestNeedsClarification ? (
            <TextWithTooltip
              text="Needs Clarification"
              tooltip="Check email for instructions on what needs clarification"
            />
          ) : (
            <>
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={statusIcon} />
              </svg>
              <span className="margin-left-05">{statusText}</span>
            </>
          )}
        </span>
      </td>

      <td className={statusTableCellClassNames}>&nbsp;</td>

      <td className={statusTableCellClassNames}>&nbsp;</td>

      <td className={statusTableCellClassNames}>
        {hidden_current_user_email}
        <br />
        <span title={`${date} ${time}`}>{date}</span>
      </td>
    </tr>
  );
}

export function AllRebates() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const { content } = useContentState();
  const { formSubmissions: bapFormSubmissions } = useBapState();
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioSubmissionsState();
  const pageMessageDispatch = usePageMessageDispatch();

  // reset page message state since it's used across pages
  useEffect(() => {
    pageMessageDispatch({ type: "RESET_MESSAGE" });
  }, [pageMessageDispatch]);

  const submissionSuccessMessage =
    (location.state as LocationState)?.submissionSuccessMessage || null;

  if (submissionSuccessMessage) {
    pageMessageDispatch({
      type: "DISPLAY_MESSAGE",
      payload: { type: "success", text: submissionSuccessMessage },
    });
  }

  useFetchedBapFormSubmissions();
  useFetchedFormioApplicationSubmissions();
  useFetchedFormioPaymentRequestSubmissions();

  const submissions = useCombinedSubmissions();
  const sortedSubmissions = useSortedSubmissions(submissions);

  // log combined 'sortedSubmissions' array if 'debug' search parameter exists
  useEffect(() => {
    const submissionsAreSet = sortedSubmissions.length > 0;
    if (searchParams.has("debug") && submissionsAreSet) {
      console.log(sortedSubmissions);
    }
  }, [searchParams, sortedSubmissions]);

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

  if (bapFormSubmissions.status === "failure") {
    return <Message type="error" text={messages.bapFormSubmissionsError} />;
  }

  if (formioApplicationSubmissions.status === "failure") {
    return (
      <Message type="error" text={messages.formioApplicationSubmissionsError} />
    );
  }

  if (formioPaymentRequestSubmissions.status === "failure") {
    return (
      <Message
        type="error"
        text={messages.formioPaymentRequestSubmissionsError}
      />
    );
  }

  return (
    <>
      {sortedSubmissions.length === 0 ? (
        <div className="margin-top-4">
          <Message type="info" text={messages.newApplication} />
        </div>
      ) : (
        <>
          {content.status === "success" && (
            <MarkdownContent
              className="margin-top-4"
              children={content.data?.allRebatesIntro || ""}
            />
          )}

          <PageMessage />

          <div className="usa-table-container--scrollable" tabIndex={0}>
            <table
              aria-label="Your Rebate Forms"
              className="usa-table usa-table--stacked usa-table--borderless width-full"
            >
              <thead>
                <tr className="font-sans-2xs text-no-wrap text-bottom">
                  <th scope="col">
                    <span className="usa-sr-only">Open</span>
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Rebate ID"
                      tooltip="Unique Clean School Bus Rebate ID"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Form Type"
                      tooltip="Application, Payment Request, or Close-Out form"
                    />
                    <br />
                    <TextWithTooltip
                      text="Form Status"
                      tooltip="Draft, Edits Requested, Submitted, Withdrawn, Selected, or Not Selected"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="UEI"
                      tooltip="Unique Entity ID from SAM.gov"
                    />
                    <br />
                    <TextWithTooltip
                      text="EFT Indicator"
                      tooltip="Electronic Funds Transfer Indicator listing the associated bank account from SAM.gov"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Applicant"
                      tooltip="Legal Business Name from SAM.gov for this UEI"
                    />
                    <br />
                    <TextWithTooltip
                      text="School District"
                      tooltip="School district represented by applicant"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Updated By"
                      tooltip="Last person that updated this form"
                    />
                    <br />
                    <TextWithTooltip
                      text="Date Updated"
                      tooltip="Last date this form was updated"
                    />
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedSubmissions.map((rebate, index) => (
                  <Fragment key={rebate.rebateId}>
                    <ApplicationSubmission rebate={rebate} />

                    <PaymentRequestSubmission rebate={rebate} />

                    {/* blank row after all rebates but the last one */}
                    {index !== sortedSubmissions.length - 1 && (
                      <tr className="bg-white">
                        <th className="p-0" scope="row" colSpan={6}>
                          &nbsp;
                        </th>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <PageMessage />
        </>
      )}

      {content.status === "success" && (
        <div className="margin-top-4 padding-2 padding-bottom-0 border-1px border-base-lighter bg-base-lightest">
          <MarkdownContent children={content.data?.allRebatesOutro || ""} />
        </div>
      )}
    </>
  );
}
