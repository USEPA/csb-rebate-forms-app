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
  useConfigData,
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
import {
  RebateYear,
  useRebateYearState,
  useRebateYearActions,
} from "contexts/rebateYear";

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

function FRFSubmission(props: { rebate: Rebate }) {
  const { rebate } = props;
  const { frf, prf, crf } = rebate;

  const configData = useConfigData();
  const { rebateYear } = useRebateYearState();

  if (!configData) return null;

  const frfSubmissionPeriodOpen =
    configData.submissionPeriodOpen[rebateYear].frf;

  const {
    applicantUEI,
    applicantEfti,
    applicantEfti_display,
    applicantOrganizationName,
    schoolDistrictName,
    last_updated_by,
  } = frf.formio.data;

  const date = new Date(frf.formio.modified).toLocaleDateString();
  const time = new Date(frf.formio.modified).toLocaleTimeString();

  const frfNeedsEdits = submissionNeedsEdits({
    formio: frf.formio,
    bap: frf.bap,
  });

  const frfNeedsClarification = frf.bap?.status === "Needs Clarification";

  const frfHasBeenWithdrawn = frf.bap?.status === "Withdrawn";

  const frfNotSelected = frf.bap?.status === "Coordinator Denied";

  const frfSelected = frf.bap?.status === "Accepted";

  const frfSelectedButNoPRF = frfSelected && !Boolean(prf.formio);

  const prfFundingApproved = prf.bap?.status === "Accepted";

  const prfFundingApprovedButNoCRF = prfFundingApproved && !Boolean(crf.formio);

  const statusTableCellClassNames =
    frf.formio.state === "submitted" || !frfSubmissionPeriodOpen
      ? "text-italic"
      : "";

  const statusIconClassNames = frfSelected
    ? "usa-icon text-primary" // blue
    : "usa-icon";

  const statusIcon = frfNeedsEdits
    ? `${icons}#priority_high` // !
    : frfHasBeenWithdrawn
    ? `${icons}#close` // ✕
    : frfNotSelected
    ? `${icons}#cancel` // x inside a circle
    : frfSelected
    ? `${icons}#check_circle` // check inside a circle
    : frf.formio.state === "draft"
    ? `${icons}#more_horiz` // three horizontal dots
    : frf.formio.state === "submitted"
    ? `${icons}#check` // check
    : `${icons}#remove`; // — (fallback, not used)

  const statusText = frfNeedsEdits
    ? "Edits Requested"
    : frfHasBeenWithdrawn
    ? "Withdrawn"
    : frfNotSelected
    ? "Not Selected"
    : frfSelected
    ? "Selected"
    : frf.formio.state === "draft"
    ? "Draft"
    : frf.formio.state === "submitted"
    ? "Submitted"
    : ""; // fallback, not used

  const frfUrl = `/rebate/${frf.formio._id}`;

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
        frfNeedsEdits || frfSelectedButNoPRF || prfFundingApprovedButNoCRF
          ? highlightedTableRowClassNames
          : defaultTableRowClassNames
      }
    >
      <th scope="row" className={statusTableCellClassNames}>
        {frfNeedsEdits ? (
          <ButtonLink type="edit" to={frfUrl} />
        ) : frf.formio.state === "submitted" || !frfSubmissionPeriodOpen ? (
          <ButtonLink type="view" to={frfUrl} />
        ) : frf.formio.state === "draft" ? (
          <ButtonLink type="edit" to={frfUrl} />
        ) : null}
      </th>

      <td className={statusTableCellClassNames}>
        {frf.bap?.rebateId ? (
          <span title={`Application ID: ${frf.formio._id}`}>
            {frf.bap.rebateId}
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
          {frfNeedsClarification ? (
            <TextWithTooltip
              text="Needs Clarification"
              tooltip="Check your email for instructions on what needs clarification"
              iconClassNames="text-base-darkest"
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

function PRFSubmission(props: { rebate: Rebate }) {
  const { rebate } = props;
  const { frf, prf, crf } = rebate;

  const navigate = useNavigate();
  const { email } = useOutletContext<{ email: string }>();

  const configData = useConfigData();
  const bapSamData = useBapSamData();
  const { displayErrorNotification } = useNotificationsActions();
  const { rebateYear } = useRebateYearState();

  /**
   * Stores when data is being posted to the server, so a loading indicator can
   * be rendered inside the "New Payment Request" button, and we can prevent
   * double submits/creations of new PRF submissions.
   */
  const [dataIsPosting, setDataIsPosting] = useState(false);

  if (!configData || !bapSamData) return null;

  const prfSubmissionPeriodOpen =
    configData.submissionPeriodOpen[rebateYear].prf;

  const frfSelected = frf.bap?.status === "Accepted";

  const frfSelectedButNoPRF = frfSelected && !Boolean(prf.formio);

  /** matched SAM.gov entity for the FRF submission */
  const entity = bapSamData.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c === frf.formio.data.bap_hidden_entity_combo_key
    );
  });

  if (frfSelectedButNoPRF) {
    return (
      <tr className={highlightedTableRowClassNames}>
        <th scope="row" colSpan={6}>
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            onClick={(ev) => {
              if (!frf.bap || !entity) return;

              // account for when data is posting to prevent double submits
              if (dataIsPosting) return;
              setDataIsPosting(true);

              const { title, name } = getUserInfo(email, entity);

              // create a new draft PRF submission
              postData(`${serverUrl}/api/formio-2022-prf-submission/`, {
                email,
                title,
                name,
                entity,
                comboKey: frf.bap.comboKey,
                rebateId: frf.bap.rebateId, // CSB Rebate ID (6 digits)
                frfReviewItemId: frf.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                frfFormModified: frf.bap.modified,
              })
                .then((res) => {
                  navigate(`/payment-request/${frf.bap?.rebateId}`);
                })
                .catch((err) => {
                  displayErrorNotification({
                    id: Date.now(),
                    body: (
                      <>
                        <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                          Error creating Payment Request{" "}
                          <em>{frf.bap?.rebateId}</em>.
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
  if (!prf.formio) return null;

  const { hidden_current_user_email, hidden_bap_rebate_id } = prf.formio.data;

  const date = new Date(prf.formio.modified).toLocaleDateString();
  const time = new Date(prf.formio.modified).toLocaleTimeString();

  const frfNeedsEdits = submissionNeedsEdits({
    formio: frf.formio,
    bap: frf.bap,
  });

  const prfNeedsEdits = submissionNeedsEdits({
    formio: prf.formio,
    bap: prf.bap,
  });

  const prfNeedsClarification = prf.bap?.status === "Needs Clarification";

  const prfHasBeenWithdrawn = prf.bap?.status === "Withdrawn";

  const prfFundingNotApproved = prf.bap?.status === "Coordinator Denied";

  const prfFundingApproved = prf.bap?.status === "Accepted";

  const prfFundingApprovedButNoCRF = prfFundingApproved && !Boolean(crf.formio);

  const statusTableCellClassNames =
    prf.formio.state === "submitted" || !prfSubmissionPeriodOpen
      ? "text-italic"
      : "";

  const statusIconClassNames = prfFundingApproved
    ? "usa-icon text-primary" // blue
    : "usa-icon";

  const statusIcon = prfNeedsEdits
    ? `${icons}#priority_high` // !
    : prfHasBeenWithdrawn
    ? `${icons}#close` // ✕
    : prfFundingNotApproved
    ? `${icons}#cancel` // ✕ inside a circle
    : prfFundingApproved
    ? `${icons}#check_circle` // check inside a circle
    : prf.formio.state === "draft"
    ? `${icons}#more_horiz` // three horizontal dots
    : prf.formio.state === "submitted"
    ? `${icons}#check` // check
    : `${icons}#remove`; // — (fallback, not used)

  const statusText = prfNeedsEdits
    ? "Edits Requested"
    : prfHasBeenWithdrawn
    ? "Withdrawn"
    : prfFundingNotApproved
    ? "Funding Not Approved"
    : prfFundingApproved
    ? "Funding Approved"
    : prf.formio.state === "draft"
    ? "Draft"
    : prf.formio.state === "submitted"
    ? "Submitted"
    : ""; // fallback, not used

  const prfUrl = `/payment-request/${hidden_bap_rebate_id}`;

  return (
    <tr
      className={
        prfNeedsEdits || prfFundingApprovedButNoCRF
          ? highlightedTableRowClassNames
          : defaultTableRowClassNames
      }
    >
      <th scope="row" className={statusTableCellClassNames}>
        {frfNeedsEdits ? (
          <ButtonLink type="view" to={prfUrl} />
        ) : prfNeedsEdits ? (
          <ButtonLink type="edit" to={prfUrl} />
        ) : prf.formio.state === "submitted" || !prfSubmissionPeriodOpen ? (
          <ButtonLink type="view" to={prfUrl} />
        ) : prf.formio.state === "draft" ? (
          <ButtonLink type="edit" to={prfUrl} />
        ) : null}
      </th>

      <td className={statusTableCellClassNames}>&nbsp;</td>

      <td className={statusTableCellClassNames}>
        <span>Payment Request</span>
        <br />
        <span className="display-flex flex-align-center font-sans-2xs">
          {prfNeedsClarification ? (
            <TextWithTooltip
              text="Needs Clarification"
              tooltip="Check your email for instructions on what needs clarification"
              iconClassNames="text-base-darkest"
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

function CRFSubmission(props: { rebate: Rebate }) {
  const { rebate } = props;
  const { frf, prf, crf } = rebate;

  const navigate = useNavigate();
  const { email } = useOutletContext<{ email: string }>();

  const configData = useConfigData();
  const bapSamData = useBapSamData();
  const { displayErrorNotification } = useNotificationsActions();
  const { rebateYear } = useRebateYearState();

  /**
   * Stores when data is being posted to the server, so a loading indicator can
   * be rendered inside the "New Close Out" button, and we can prevent double
   * submits/creations of new Close Out form submissions.
   */
  const [dataIsPosting, setDataIsPosting] = useState(false);

  if (!configData || !bapSamData) return null;

  const crfSubmissionPeriodOpen =
    configData.submissionPeriodOpen[rebateYear].crf;

  const prfFundingApproved = prf.bap?.status === "Accepted";

  const prfFundingApprovedButNoCRF = prfFundingApproved && !Boolean(crf.formio);

  /** matched SAM.gov entity for the PRF submission */
  const entity = bapSamData.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c ===
        prf.formio?.data.bap_hidden_entity_combo_key
    );
  });

  if (prfFundingApprovedButNoCRF) {
    return (
      <tr className={highlightedTableRowClassNames}>
        <th scope="row" colSpan={6}>
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            onClick={(ev) => {
              if (!frf.bap || !prf.bap || !entity) return;

              // account for when data is posting to prevent double submits
              if (dataIsPosting) return;
              setDataIsPosting(true);

              const { title, name } = getUserInfo(email, entity);

              // create a new draft CRF submission
              postData(`${serverUrl}/api/formio-2022-crf-submission/`, {
                email,
                title,
                name,
                entity,
                comboKey: prf.bap.comboKey,
                rebateId: prf.bap.rebateId, // CSB Rebate ID (6 digits)
                frfReviewItemId: frf.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                prfReviewItemId: prf.bap.reviewItemId, // CSB Rebate ID with form/version ID (9 digits)
                prfModified: prf.bap.modified,
              })
                .then((res) => {
                  navigate(`/close-out/${prf.bap?.rebateId}`);
                })
                .catch((err) => {
                  displayErrorNotification({
                    id: Date.now(),
                    body: (
                      <>
                        <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                          Error creating Close Out <em>{prf.bap?.rebateId}</em>.
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
  if (!crf.formio) return null;

  const { hidden_current_user_email, hidden_bap_rebate_id } = crf.formio.data;

  const date = new Date(crf.formio.modified).toLocaleDateString();
  const time = new Date(crf.formio.modified).toLocaleTimeString();

  const crfNeedsEdits = submissionNeedsEdits({
    formio: crf.formio,
    bap: crf.bap,
  });

  const crfNeedsClarification = crf.bap?.status === "Needs Clarification";

  const crfReimbursementNeeded = crf.bap?.status === "Reimbursement Needed";

  const crfNotApproved = crf.bap?.status === "Branch Director Denied";

  const crfApproved = crf.bap?.status === "Branch Director Approved";

  const statusTableCellClassNames =
    crf.formio.state === "submitted" || !crfSubmissionPeriodOpen
      ? "text-italic"
      : "";

  const statusIconClassNames = crfApproved
    ? "usa-icon text-primary" // blue
    : "usa-icon";

  const statusIcon = crfNeedsEdits
    ? `${icons}#priority_high` // !
    : crfNotApproved
    ? `${icons}#cancel` // ✕ inside a circle
    : crfApproved
    ? `${icons}#check_circle` // check inside a circle
    : crf.formio.state === "draft"
    ? `${icons}#more_horiz` // three horizontal dots
    : crf.formio.state === "submitted"
    ? `${icons}#check` // check
    : `${icons}#remove`; // — (fallback, not used)

  const statusText = crfNeedsEdits
    ? "Edits Requested"
    : crfNotApproved
    ? "Close Out Not Approved"
    : crfApproved
    ? "Close Out Approved"
    : crf.formio.state === "draft"
    ? "Draft"
    : crf.formio.state === "submitted"
    ? "Submitted"
    : ""; // fallback, not used

  const crfUrl = `/close-out/${hidden_bap_rebate_id}`;

  return (
    <tr
      className={
        crfNeedsEdits || prfFundingApprovedButNoCRF
          ? highlightedTableRowClassNames
          : defaultTableRowClassNames
      }
    >
      <th scope="row" className={statusTableCellClassNames}>
        {crfNeedsEdits ? (
          <ButtonLink type="edit" to={crfUrl} />
        ) : crf.formio.state === "submitted" || !crfSubmissionPeriodOpen ? (
          <ButtonLink type="view" to={crfUrl} />
        ) : crf.formio.state === "draft" ? (
          <ButtonLink type="edit" to={crfUrl} />
        ) : null}
      </th>

      <td className={statusTableCellClassNames}>&nbsp;</td>

      <td className={statusTableCellClassNames}>
        <span>Close Out</span>
        <br />
        <span className="display-flex flex-align-center font-sans-2xs">
          {crfNeedsClarification ? (
            <TextWithTooltip
              text="Needs Clarification"
              tooltip="Check your email for instructions on what needs clarification"
              iconClassNames="text-base-darkest"
            />
          ) : crfReimbursementNeeded ? (
            <TextWithTooltip
              text="Reimbursement Needed"
              tooltip="Check your email for information on reimbursement needed"
              iconClassNames="text-base-darkest"
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

function NewApplicationIconText() {
  return (
    <span className="display-flex flex-align-center">
      <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
        <use href={`${icons}#add_circle`} />
      </svg>
      <span className="margin-left-1 text-left">New Application</span>
    </span>
  );
}

export function AllRebates() {
  const content = useContentData();
  const configData = useConfigData();
  const bapSamData = useBapSamData();
  const submissionsQueries = useSubmissionsQueries();
  const rebates = useRebates();
  const { rebateYear } = useRebateYearState();
  const { setRebateYear } = useRebateYearActions();

  const frfSubmissionPeriodOpen = configData
    ? configData.submissionPeriodOpen[rebateYear].frf
    : false;

  const btnClassNames =
    "usa-button margin-0 padding-x-2 padding-y-1 width-full font-sans-2xs";

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

      <div className="margin-top-1 padding-top-1 padding-x-1 border-1px border-base-lighter bg-base-lightest">
        <nav className="flex-align-center mobile-lg:display-flex mobile-lg:padding-x-1">
          <div className="margin-bottom-1 mobile-lg:margin-right-1">
            <label
              htmlFor="rebate-year"
              className="margin-right-1 font-sans-2xs"
            >
              Rebate Year:
            </label>
            <select
              id="rebate-year"
              name="rebate-year"
              className="tw-rounded-md tw-border-0 tw-text-sm tw-font-bold tw-leading-4 tw-ring-1 tw-ring-inset tw-ring-gray-300"
              onChange={(ev) => setRebateYear(ev.target.value as RebateYear)}
              defaultValue={rebateYear}
            >
              <option>2022</option>
              <option>2023</option>
            </select>
          </div>

          <div className="margin-bottom-1 mobile-lg:margin-right-1">
            {!frfSubmissionPeriodOpen ? (
              <button className={btnClassNames} disabled>
                <NewApplicationIconText />
              </button>
            ) : (
              <Link to="/rebate/new" className={btnClassNames}>
                <NewApplicationIconText />
              </Link>
            )}
          </div>
        </nav>
      </div>

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
                    <FRFSubmission rebate={rebate} />
                    <PRFSubmission rebate={rebate} />
                    <CRFSubmission rebate={rebate} />
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
