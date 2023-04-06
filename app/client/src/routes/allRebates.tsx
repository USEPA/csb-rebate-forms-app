import { Fragment, useEffect, useState } from "react";
import type { LinkProps } from "react-router-dom";
import {
  Link,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading, LoadingButtonIcon } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/tooltip";
import { useContentData } from "components/app";
import { useCsbData, useBapSamData } from "components/userDashboard";
import { useNotificationsContext } from "contexts/notifications";

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
  };
};

type BapSubmission = {
  modified: string | null; // ISO 8601 date string
  comboKey: string | null; // UEI + EFTI combo key
  rebateId: string | null; // CSB Rebate ID (6 digits)
  reviewItemId: string | null; // CSB Rebate ID with form/version ID (9 digits)
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
    const status =
      bapMatch?.Parent_CSB_Rebate__r?.CSB_Funding_Request_Status__c || null;

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
    const status =
      bapMatch?.Parent_CSB_Rebate__r?.CSB_Payment_Request_Status__c || null;

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
    console.log(formioSubmission); // TODO
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

function ApplicationSubmission(props: { rebate: Rebate }) {
  const { rebate } = props;
  const { application, paymentRequest } = rebate;

  const csbData = useCsbData();

  if (!csbData) return null;

  const applicationFormOpen = csbData.submissionPeriodOpen.application;

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

  const applicationNeedsClarification =
    application.bap?.status === "Needs Clarification";

  const applicationHasBeenWithdrawn = application.bap?.status === "Withdrawn";

  const applicationNotSelected =
    application.bap?.status === "Coordinator Denied";

  const applicationSelected = application.bap?.status === "Accepted";

  const applicationSelectedButNoPaymentRequest =
    applicationSelected && !Boolean(paymentRequest.formio);

  const statusTableCellClassNames =
    application.formio.state === "submitted" || !applicationFormOpen
      ? "text-italic"
      : "";

  const statusIconClassNames = applicationSelected
    ? "usa-icon text-primary" // blue
    : "usa-icon";

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
          {applicationNeedsClarification ? (
            <TextWithTooltip
              text="Needs Clarification"
              tooltip="Check your email for instructions on what needs clarification"
            />
          ) : (
            <>
              <svg
                className={statusIconClassNames}
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
field, which is configured via the form definition (in Formio) to set its value
based on the value of the `sam_hidden_applicant_efti` field, which we inject on
initial form submission. That value comes from the BAP (SAM.gov data), which
could be an empty string.

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

function PaymentRequestSubmission(props: { rebate: Rebate }) {
  const { rebate } = props;
  const { application, paymentRequest } = rebate;

  const navigate = useNavigate();
  const { email } = useOutletContext<{ email: string }>();

  const csbData = useCsbData();
  const bapSamData = useBapSamData();
  const { displayErrorNotification } = useNotificationsContext();

  // NOTE: used to display a loading indicator inside the new Payment Request button
  const [postDataResponsePending, setPostDataResponsePending] = useState(false);

  if (!csbData || !bapSamData) return null;

  const paymentRequestFormOpen = csbData.submissionPeriodOpen.paymentRequest;

  const applicationSelected = application.bap?.status === "Accepted";

  const applicationSelectedButNoPaymentRequest =
    applicationSelected && !Boolean(paymentRequest.formio);

  /** matched SAM.gov entity for the application */
  const entity = bapSamData.entities.find((entity) => {
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

              const { title, name } = getUserInfo(email, entity);

              // create a new draft payment request submission
              postData(`${serverUrl}/api/formio-payment-request-submission/`, {
                email,
                title,
                name,
                entity,
                comboKey: application.bap.comboKey,
                rebateId: application.bap.rebateId, // CSB Rebate ID (6 digits)
                reviewItemId: application.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                applicationFormModified: application.bap.modified,
              })
                .then((res) => {
                  setPostDataResponsePending(false);
                  navigate(`/payment-request/${application.bap?.rebateId}`);
                })
                .catch((err) => {
                  setPostDataResponsePending(false);
                  displayErrorNotification(
                    <>
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        Error creating Payment Request{" "}
                        <em>{application.bap?.rebateId}</em>.
                      </p>
                      <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
                        Please try again.
                      </p>
                    </>
                  );
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

  const statusIconClassNames = "usa-icon";

  const statusIcon = paymentRequestNeedsEdits
    ? `${icons}#priority_high` // !
    : paymentRequestHasBeenWithdrawn
    ? `${icons}#close` // ✕
    : paymentRequestFundingNotApproved
    ? `${icons}#cancel` // ✕ inside a circle
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
              tooltip="Check your email for instructions on what needs clarification"
            />
          ) : paymentRequestFundingApproved ? (
            <TextWithTooltip
              text="Funding Approved"
              tooltip="Check your email for more details on funding"
              iconName="check_circle" // check inside a circle
              iconClassNames="text-primary" // blue
            />
          ) : (
            <>
              <svg
                className={statusIconClassNames}
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
  const content = useContentData();
  const submissionsQueries = useSubmissionsQueries();
  const rebates = useRebates();

  if (submissionsQueries.some((query) => query.isFetching)) {
    return <Loading />;
  }

  if (submissionsQueries.some((query) => query.isError)) {
    return <Message type="error" text={messages.formSubmissionsError} />;
  }

  return (
    <>
      {rebates.length === 0 ? (
        <div className="margin-top-4">
          <Message type="info" text={messages.newApplication} />
        </div>
      ) : (
        <>
          {content && (
            <MarkdownContent
              className="margin-top-4"
              children={content.allRebatesIntro}
            />
          )}

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
                {rebates.map((rebate, index) => (
                  <Fragment key={rebate.rebateId}>
                    <ApplicationSubmission rebate={rebate} />

                    <PaymentRequestSubmission rebate={rebate} />

                    {/* blank row after all rebates but the last one */}
                    {index !== rebates.length - 1 && (
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
        </>
      )}

      {content && (
        <MarkdownContent
          className="margin-top-4 padding-2 padding-bottom-0 border-1px border-base-lighter bg-base-lightest"
          children={content.allRebatesOutro}
        />
      )}
    </>
  );
}
