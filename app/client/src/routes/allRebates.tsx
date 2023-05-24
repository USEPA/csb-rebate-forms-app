import { Fragment, useState } from "react";
import type { LinkProps } from "react-router-dom";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages } from "../config";
import {
  Rebate,
  postData,
  useContentData,
  useCsbData,
  useBapSamData,
  useSubmissionsQueries,
  useRebates,
  submissionNeedsEdits,
  getUserInfo,
} from "../utilities";
import { Loading, LoadingButtonIcon } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/tooltip";
import { useNotificationsActions } from "contexts/notifications";

const defaultTableRowClassNames = "bg-gray-5";
const highlightedTableRowClassNames = "bg-primary-lighter";

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
  const { application, paymentRequest, closeOut } = rebate;

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

  const paymentRequestFundingApproved =
    paymentRequest.bap?.status === "Accepted";

  const paymentRequestFundingApprovedButNoCloseOut =
    paymentRequestFundingApproved && !Boolean(closeOut.formio);

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
    ? `${icons}#cancel` // x inside a circle
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
    ? "Not Selected"
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
        applicationNeedsEdits ||
        applicationSelectedButNoPaymentRequest ||
        paymentRequestFundingApprovedButNoCloseOut
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
            tooltip="Rebate ID should be displayed within 24hrs. after submitting a rebate form application"
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
  const { application, paymentRequest, closeOut } = rebate;

  const navigate = useNavigate();
  const { email } = useOutletContext<{ email: string }>();

  const csbData = useCsbData();
  const bapSamData = useBapSamData();
  const { displayErrorNotification } = useNotificationsActions();

  /**
   * Stores when data is being posted to the server, so a loading indicator can
   * be rendered inside the "New Payment Request" button, and we can prevent
   * double submits/creations of new Payment Request form submissions.
   */
  const [dataIsPosting, setDataIsPosting] = useState(false);

  if (!csbData || !bapSamData) return null;

  const paymentRequestFormOpen = csbData.submissionPeriodOpen.paymentRequest;

  const applicationSelected = application.bap?.status === "Accepted";

  const applicationSelectedButNoPaymentRequest =
    applicationSelected && !Boolean(paymentRequest.formio);

  /** matched SAM.gov entity for the Application submission */
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
              if (!application.bap || !entity) return;

              // account for when data is posting to prevent double submits
              if (dataIsPosting) return;
              setDataIsPosting(true);

              const { title, name } = getUserInfo(email, entity);

              // create a new draft Payment Request form submission
              postData(`${serverUrl}/api/formio-payment-request-submission/`, {
                email,
                title,
                name,
                entity,
                comboKey: application.bap.comboKey,
                rebateId: application.bap.rebateId, // CSB Rebate ID (6 digits)
                applicationReviewItemId: application.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                applicationFormModified: application.bap.modified,
              })
                .then((res) => {
                  navigate(`/payment-request/${application.bap?.rebateId}`);
                })
                .catch((err) => {
                  displayErrorNotification({
                    id: Date.now(),
                    body: (
                      <>
                        <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                          Error creating Payment Request{" "}
                          <em>{application.bap?.rebateId}</em>.
                        </p>
                        <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
                          Please try again.
                        </p>
                      </>
                    ),
                  });
                })
                .finally(() => {
                  setDataIsPosting(false);
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
              {dataIsPosting && <LoadingButtonIcon />}
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

  const paymentRequestFundingApprovedButNoCloseOut =
    paymentRequestFundingApproved && !Boolean(closeOut.formio);

  const statusTableCellClassNames =
    paymentRequest.formio.state === "submitted" || !paymentRequestFormOpen
      ? "text-italic"
      : "";

  const statusIconClassNames = paymentRequestFundingApproved
    ? "usa-icon text-primary" // blue
    : "usa-icon";

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
        paymentRequestNeedsEdits || paymentRequestFundingApprovedButNoCloseOut
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

function CloseOutSubmission(props: { rebate: Rebate }) {
  const { rebate } = props;
  const { application, paymentRequest, closeOut } = rebate;

  const navigate = useNavigate();
  const { email } = useOutletContext<{ email: string }>();

  const csbData = useCsbData();
  const bapSamData = useBapSamData();
  const { displayErrorNotification } = useNotificationsActions();

  /**
   * Stores when data is being posted to the server, so a loading indicator can
   * be rendered inside the "New Close Out" button, and we can prevent double
   * submits/creations of new Close Out form submissions.
   */
  const [dataIsPosting, setDataIsPosting] = useState(false);

  if (!csbData || !bapSamData) return null;

  const closeOutFormOpen = csbData.submissionPeriodOpen.closeOut;

  const paymentRequestFundingApproved =
    paymentRequest.bap?.status === "Accepted";

  const paymentRequestFundingApprovedButNoCloseOut =
    paymentRequestFundingApproved && !Boolean(closeOut.formio);

  /** matched SAM.gov entity for the Payment Request submission */
  const entity = bapSamData.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c ===
        paymentRequest.formio?.data.bap_hidden_entity_combo_key
    );
  });

  if (paymentRequestFundingApprovedButNoCloseOut) {
    return (
      <tr className={highlightedTableRowClassNames}>
        <th scope="row" colSpan={6}>
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            onClick={(ev) => {
              if (!application.bap || !paymentRequest.bap || !entity) return;

              // account for when data is posting to prevent double submits
              if (dataIsPosting) return;
              setDataIsPosting(true);

              const { title, name } = getUserInfo(email, entity);

              // create a new draft Close Out form submission
              postData(`${serverUrl}/api/formio-close-out-submission/`, {
                email,
                title,
                name,
                entity,
                comboKey: paymentRequest.bap.comboKey,
                rebateId: paymentRequest.bap.rebateId, // CSB Rebate ID (6 digits)
                applicationReviewItemId: application.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                paymentRequestReviewItemId: paymentRequest.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                paymentRequestFormModified: paymentRequest.bap.modified,
              })
                .then((res) => {
                  navigate(`/close-out/${paymentRequest.bap?.rebateId}`);
                })
                .catch((err) => {
                  displayErrorNotification({
                    id: Date.now(),
                    body: (
                      <>
                        <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                          Error creating Close Out{" "}
                          <em>{paymentRequest.bap?.rebateId}</em>.
                        </p>
                        <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
                          Please try again.
                        </p>
                      </>
                    ),
                  });
                })
                .finally(() => {
                  setDataIsPosting(false);
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
              <span className="margin-left-1">New Close Out</span>
              {dataIsPosting && <LoadingButtonIcon />}
            </span>
          </button>
        </th>
      </tr>
    );
  }

  // return if a Close Out submission has not been created for this rebate
  if (!closeOut.formio) return null;

  const { hidden_current_user_email, hidden_bap_rebate_id } =
    closeOut.formio.data;

  const date = new Date(closeOut.formio.modified).toLocaleDateString();
  const time = new Date(closeOut.formio.modified).toLocaleTimeString();

  const closeOutNeedsEdits = submissionNeedsEdits({
    formio: closeOut.formio,
    bap: closeOut.bap,
  });

  const closeOutNeedsClarification =
    closeOut.bap?.status === "Needs Clarification";

  const closeOutNotApproved = closeOut.bap?.status === "Branch Director Denied";

  const closeOutReimbursementNeeded =
    closeOut.bap?.status === "Reimbursement Needed";

  const closeOutApproved = closeOut.bap?.status === "Branch Director Approved";

  const statusTableCellClassNames =
    closeOut.formio.state === "submitted" || !closeOutFormOpen
      ? "text-italic"
      : "";

  const statusIconClassNames = closeOutApproved
    ? "usa-icon text-primary" // blue
    : "usa-icon";

  const statusIcon = closeOutNeedsEdits
    ? `${icons}#priority_high` // !
    : closeOutNotApproved
    ? `${icons}#cancel` // ✕ inside a circle
    : closeOutReimbursementNeeded
    ? `${icons}#priority_high` // !
    : closeOutApproved
    ? `${icons}#check_circle` // check inside a circle
    : closeOut.formio.state === "draft"
    ? `${icons}#more_horiz` // three horizontal dots
    : closeOut.formio.state === "submitted"
    ? `${icons}#check` // check
    : `${icons}#remove`; // — (fallback, not used)

  const statusText = closeOutNeedsEdits
    ? "Edits Requested"
    : closeOutNotApproved
    ? "Close Out Not Approved"
    : closeOutReimbursementNeeded
    ? "Reimbursement Needed"
    : closeOutApproved
    ? "Close Out Approved"
    : closeOut.formio.state === "draft"
    ? "Draft"
    : closeOut.formio.state === "submitted"
    ? "Submitted"
    : ""; // fallback, not used

  const closeOutFormUrl = `/close-out/${hidden_bap_rebate_id}`;

  return (
    <tr
      className={
        closeOutNeedsEdits || paymentRequestFundingApprovedButNoCloseOut
          ? highlightedTableRowClassNames
          : defaultTableRowClassNames
      }
    >
      <th scope="row" className={statusTableCellClassNames}>
        {closeOutNeedsEdits ? (
          <ButtonLink type="edit" to={closeOutFormUrl} />
        ) : closeOut.formio.state === "submitted" || !closeOutFormOpen ? (
          <ButtonLink type="view" to={closeOutFormUrl} />
        ) : closeOut.formio.state === "draft" ? (
          <ButtonLink type="edit" to={closeOutFormUrl} />
        ) : null}
      </th>

      <td className={statusTableCellClassNames}>&nbsp;</td>

      <td className={statusTableCellClassNames}>
        <span>Close Out</span>
        <br />
        <span className="display-flex flex-align-center font-sans-2xs">
          {closeOutNeedsClarification ? (
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
  const bapSamData = useBapSamData();
  const submissionsQueries = useSubmissionsQueries();
  const rebates = useRebates();

  if (!bapSamData) return null;

  if (submissionsQueries.some((query) => query.isFetching)) {
    return <Loading />;
  }

  if (submissionsQueries.some((query) => query.isError)) {
    return <Message type="error" text={messages.formSubmissionsError} />;
  }

  return (
    <>
      {bapSamData.entities.some((e) => e.ENTITY_STATUS__c !== "Active") && (
        <Message
          type="warning"
          text={messages.bapSamAtLeastOneEntityNotActive}
        />
      )}

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
                      tooltip="Application, Payment Request, or Close Out form"
                    />
                    <br />
                    <TextWithTooltip
                      text="Form Status"
                      tooltip="Draft, Edits Requested, Submitted, Withdrawn, Selected, or Not Selected" // TODO: update to reflect other statuses
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
                    <CloseOutSubmission rebate={rebate} />
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
