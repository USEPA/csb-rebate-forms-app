import { Fragment, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import {
  FormioApplicationSubmission,
  FormioPaymentRequestSubmission,
  useFormioState,
  useFormioDispatch,
} from "contexts/formio";
import { useBapState, useBapDispatch } from "contexts/bap";

type Rebate = {
  application: {
    formio: FormioApplicationSubmission;
    bap: {
      comboKey: string | null;
      rebateId: string | null;
      reviewItemId: string | null;
      rebateStatus: string | null;
      lastModified: string | null;
    } | null;
  };
  paymentRequest: {
    formio: FormioPaymentRequestSubmission | null;
    bap: null;
  };
  closeOut: {
    formio: null;
    bap: null;
  };
};

type MessageState = {
  displayed: boolean;
  type: "info" | "success" | "warning" | "error";
  text: string;
};

/** Custom hook to fetch Application form submissions from Forms.gov */
function useFetchedFormioApplicationSubmissions() {
  const { samEntities } = useBapState();
  const dispatch = useFormioDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) {
      return;
    }

    dispatch({ type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/formio-application-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_SUCCESS",
          payload: { applicationSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_FORMIO_APPLICATION_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, dispatch]);
}

/** Custom hook to fetch Application form submissions from the BAP */
function useFetchedBapApplicationSubmissions() {
  const { samEntities } = useBapState();
  const dispatch = useBapDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) {
      return;
    }

    dispatch({ type: "FETCH_BAP_APPLICATION_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/bap-application-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_BAP_APPLICATION_SUBMISSIONS_SUCCESS",
          payload: { applicationSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_BAP_APPLICATION_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, dispatch]);
}

/** Custom hook to fetch Payment Request form submissions from Forms.gov */
function useFetchedFormioPaymentRequestSubmissions() {
  const { samEntities } = useBapState();
  const dispatch = useFormioDispatch();

  useEffect(() => {
    if (samEntities.status !== "success" || !samEntities.data.results) {
      return;
    }

    dispatch({ type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_REQUEST" });

    getData(`${serverUrl}/api/formio-payment-request-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_SUCCESS",
          payload: { paymentRequestSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_FORMIO_PAYMENT_REQUEST_SUBMISSIONS_FAILURE" });
      });
  }, [samEntities, dispatch]);
}

/** Custom hook to fetch Payment Request form submissions from the BAP */
function useFetchedBapPaymentRequestSubmissions() {
  // TODO
}

/**
 * Custom hook to combine Application form submissions data, Payment Request
 * form submissions data, and Close-Out form submissions data from both the BAP
 * and Formio into a single `submissions` object, with the BAP assigned
 * `rebateId` as the keys.
 **/
function useCombinedSubmissions() {
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioState();

  const {
    applicationSubmissions: bapApplicationSubmissions,
    // paymentRequestSubmissions: bapPaymentRequestSubmissions,
  } = useBapState();

  // ensure form submissions data has been fetched from both Formio and the BAP
  if (
    formioApplicationSubmissions.status !== "success" ||
    formioPaymentRequestSubmissions.status !== "success" ||
    bapApplicationSubmissions.status !== "success"
    // bapPaymentRequestSubmissions.status !== "success"
  ) {
    return {};
  }

  const submissions: { [rebateId: string]: Rebate } = {};

  /**
   * Iterate over Formio Application form submissions, matching them with
   * submissions returned from the BAP, so we can build up each rebate object
   * with the Application form submission data, initial Payment Request form
   * and Close-out Form submission data structure (both to be updated/replaced)
   */
  for (const formioSubmission of formioApplicationSubmissions.data) {
    const bapMatch = bapApplicationSubmissions.data.find((bapSubmission) => {
      return bapSubmission.CSB_Form_ID__c === formioSubmission._id;
    });

    /* NOTE: If new Application form submissions have been reciently created in
    Formio and the BAP's ETL process has not yet run to pickup those new Formio
    submissions, all of the fields below will be null, so instead of assigning
    the submission's key as `rebateId` (which will be null), we'll assign it to
    be an underscore concatenated with the Formio submission's mongoDB ObjectID.
    */
    const comboKey = bapMatch?.UEI_EFTI_Combo_Key__c || null;
    const rebateId = bapMatch?.Parent_Rebate_ID__c || null;
    const reviewItemId = bapMatch?.CSB_Review_Item_ID__c || null;
    const rebateStatus =
      bapMatch?.Parent_CSB_Rebate__r?.CSB_Rebate_Status__c || null;
    const lastModified = bapMatch?.CSB_Modified_Full_String__c || null;

    submissions[rebateId || `_${formioSubmission._id}`] = {
      application: {
        formio: { ...formioSubmission },
        bap: { comboKey, rebateId, reviewItemId, rebateStatus, lastModified },
      },
      paymentRequest: { formio: null, bap: null },
      closeOut: { formio: null, bap: null },
    };
  }

  /**
   * Iterate over Formio Payment Request form submissions, matching them with
   * submissions returned from the BAP, so we can set the Payment Request form
   * submission data.
   */
  for (const formioSubmission of formioPaymentRequestSubmissions.data) {
    // const bapMatch = bapPaymentRequestSubmissions.data.find((bapSubmission) => {
    //   return bapSubmission; // TODO
    // });

    const rebateId = formioSubmission.data.hidden_bap_rebate_id;

    submissions[rebateId].paymentRequest = {
      formio: { ...formioSubmission },
      bap: null,
    };
  }

  return submissions;
}

function ApplicationSubmission({
  rebate,
  setMessage,
}: {
  rebate: Rebate;
  setMessage: React.Dispatch<React.SetStateAction<MessageState>>;
}) {
  const navigate = useNavigate();
  const { csbData } = useCsbState();

  if (csbData.status !== "success") return null;
  const { enrollmentClosed } = csbData.data;

  const { application } = rebate;

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

  /**
   * The application has been updated since the last time the BAP's submissions
   * ETL process has last succesfully run.
   */
  const applicationHasBeenUpdated = application.bap?.lastModified
    ? new Date(application.formio.modified) >
      new Date(application.bap.lastModified)
    : false;

  const applicationNeedsEdits =
    application.bap?.rebateStatus === "Edits Requested" &&
    (application.formio.state === "draft" ||
      (application.formio.state === "submitted" && !applicationHasBeenUpdated));

  const applicationHasBeenWithdrawn =
    application.bap?.rebateStatus === "Withdrawn";

  const statusStyles = applicationNeedsEdits
    ? "csb-needs-edits"
    : enrollmentClosed || application.formio.state === "submitted"
    ? "text-italic"
    : "";

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
    <tr className="bg-gray-5">
      <th scope="row" className={statusStyles}>
        {applicationNeedsEdits ? (
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            onClick={(ev) => {
              // clear out existing message
              setMessage({ displayed: false, type: "info", text: "" });

              // change the submission's state to draft, then redirect to the
              // form to allow user to edit
              postData(
                `${serverUrl}/api/formio-application-submission/${application.formio._id}`,
                { data: application.formio.data, state: "draft" }
              )
                .then((res) => navigate(`/rebate/${res._id}`))
                .catch((err) => {
                  const text = `Error updating Application ${application.bap?.rebateId}. Please try again.`;
                  setMessage({ displayed: true, type: "error", text });
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
                <use href={`${icons}#edit`} />
              </svg>
              <span className="margin-left-1">Edit</span>
            </span>
          </button>
        ) : enrollmentClosed || application.formio.state === "submitted" ? (
          <Link
            to={`/rebate/${application.formio._id}`}
            className="usa-button usa-button--base font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
          >
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#visibility`} />
              </svg>
              <span className="margin-left-1">View</span>
            </span>
          </Link>
        ) : application.formio.state === "draft" ? (
          <Link
            to={`/rebate/${application.formio._id}`}
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
          >
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#edit`} />
              </svg>
              <span className="margin-left-1">Edit</span>
            </span>
          </Link>
        ) : null}
      </th>

      <td className={statusStyles}>
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

      <td className={statusStyles}>
        <span>Application</span>
        <br />
        <span className="display-flex flex-align-center font-sans-2xs">
          <svg
            className="usa-icon"
            aria-hidden="true"
            focusable="false"
            role="img"
          >
            <use
              href={
                applicationNeedsEdits
                  ? `${icons}#priority_high`
                  : applicationHasBeenWithdrawn
                  ? `${icons}#close`
                  : application.formio.state === "submitted"
                  ? `${icons}#check`
                  : application.formio.state === "draft"
                  ? `${icons}#more_horiz`
                  : `${icons}#remove` // fallback, not used
              }
            />
          </svg>
          <span className="margin-left-05">
            {
              applicationNeedsEdits || applicationHasBeenWithdrawn
                ? application.bap?.rebateStatus
                : application.formio.state === "draft"
                ? "Draft"
                : application.formio.state === "submitted"
                ? "Submitted"
                : application.formio.state // fallback, not used
            }
          </span>
        </span>
      </td>

      <td className={statusStyles}>
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

      <td className={statusStyles}>
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

      <td className={statusStyles}>
        {last_updated_by}
        <br />
        <span title={`${date} ${time}`}>{date}</span>
      </td>
    </tr>
  );
}

function PaymentRequestSubmission({
  rebate,
  setMessage,
}: {
  rebate: Rebate;
  setMessage: React.Dispatch<React.SetStateAction<MessageState>>;
}) {
  const navigate = useNavigate();
  const { epaUserData } = useUserState();
  const { samEntities } = useBapState();

  if (epaUserData.status !== "success") return null;
  if (samEntities.status !== "success") return null;

  const email = epaUserData.data.mail;
  const { application, paymentRequest } = rebate;

  const applicationHasBeenSelected =
    application.bap?.rebateStatus === "Selected";

  /** matched SAM.gov entity for the application */
  const entity = samEntities.data.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c ===
        application.formio.data.bap_hidden_entity_combo_key
    );
  });

  if (paymentRequest.formio?._id) {
    return (
      <tr className="bg-gray-5">
        <th scope="row" colSpan={6}>
          (Payment Request submission fields)
        </th>
      </tr>
    );
  }

  if (applicationHasBeenSelected) {
    return (
      <tr className="bg-gray-5">
        <th scope="row" colSpan={6}>
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            onClick={(ev) => {
              if (!application.bap?.rebateId || !entity) return;

              const { title, name } = getUserInfo(email, entity);

              // clear out existing message
              setMessage({ displayed: false, type: "info", text: "" });

              // create a new draft payment request submission
              postData(`${serverUrl}/api/formio-payment-request-submission/`, {
                email,
                title,
                name,
                comboKey: application.bap.comboKey,
                rebateId: application.bap.rebateId, // CSB Rebate ID (6 digits)
                reviewItemId: application.bap.reviewItemId, // CSB Rebate ID w/ form/version ID (9 digits)
              })
                .then((res) => {
                  navigate(`/payment-request/${application.bap?.rebateId}`);
                })
                .catch((err) => {
                  const text = `Error creating Payment Request ${application.bap?.rebateId}. Please try again.`;
                  setMessage({ displayed: true, type: "error", text });
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
            </span>
          </button>
        </th>
      </tr>
    );
  }

  return null;
}

export function AllRebates() {
  const { content } = useContentState();
  const { epaUserData } = useUserState();
  const { csbData } = useCsbState();
  const {
    samEntities,
    applicationSubmissions: bapApplicationSubmissions,
    paymentRequestSubmissions: bapPaymentRequestSubmissions,
  } = useBapState();
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioState();

  const [message, setMessage] = useState<MessageState>({
    displayed: false,
    type: "info",
    text: "",
  });

  useFetchedFormioApplicationSubmissions();
  useFetchedBapApplicationSubmissions();

  useFetchedFormioPaymentRequestSubmissions();
  useFetchedBapPaymentRequestSubmissions();

  const submissions = useCombinedSubmissions();

  if (
    csbData.status !== "success" ||
    epaUserData.status !== "success" ||
    samEntities.status === "idle" ||
    samEntities.status === "pending" ||
    formioApplicationSubmissions.status === "idle" ||
    formioApplicationSubmissions.status === "pending" ||
    bapApplicationSubmissions.status === "idle" ||
    bapApplicationSubmissions.status === "pending" ||
    formioPaymentRequestSubmissions.status === "idle" ||
    formioPaymentRequestSubmissions.status === "pending"
  ) {
    return <Loading />;
  }

  if (samEntities.status === "failure") {
    return <Message type="error" text={messages.bapSamFetchError} />;
  }

  if (
    formioApplicationSubmissions.status === "failure" ||
    bapApplicationSubmissions.status === "failure"
  ) {
    return <Message type="error" text={messages.applicationSubmissionsError} />;
  }

  if (formioPaymentRequestSubmissions.status === "failure") {
    return (
      <Message type="error" text={messages.paymentRequestSubmissionsError} />
    );
  }

  return (
    <>
      {Object.keys(submissions).length === 0 ? (
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

          {message.displayed && (
            <Message type={message.type} text={message.text} />
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
                {Object.entries(submissions).map(
                  ([rebateId, rebate], index) => {
                    return (
                      <Fragment key={rebateId}>
                        <ApplicationSubmission
                          rebate={rebate}
                          setMessage={setMessage}
                        />

                        <PaymentRequestSubmission
                          rebate={rebate}
                          setMessage={setMessage}
                        />

                        {/* blank row after each rebate but the last one */}
                        {index !== Object.keys(submissions).length - 1 && (
                          <tr className="bg-white">
                            <th className="p-0" scope="row" colSpan={6}>
                              &nbsp;
                            </th>
                          </tr>
                        )}
                      </Fragment>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>

          {message.displayed && (
            <Message type={message.type} text={message.text} />
          )}
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
