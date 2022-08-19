import { Fragment, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData, messages } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useFormsState, useFormsDispatch } from "contexts/forms";

export default function AllRebates() {
  const navigate = useNavigate();
  const { content } = useContentState();
  const { csbData, bapUserData } = useUserState();
  const { rebateFormSubmissions } = useFormsState();
  const dispatch = useFormsDispatch();

  const [message, setMessage] = useState<{
    displayed: boolean;
    type: "info" | "success" | "warning" | "error";
    text: string;
  }>({
    displayed: false,
    type: "info",
    text: "",
  });

  useEffect(() => {
    if (bapUserData.status !== "success" || !bapUserData.data.samResults) {
      return;
    }

    dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_REQUEST" });

    fetchData(`${serverUrl}/api/rebate-form-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_REBATE_FORM_SUBMISSIONS_SUCCESS",
          payload: { rebateFormSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_FAILURE" });
      });
  }, [bapUserData, dispatch]);

  if (
    bapUserData.status === "idle" ||
    bapUserData.status === "pending" ||
    rebateFormSubmissions.status === "idle" ||
    rebateFormSubmissions.status === "pending"
  ) {
    return <Loading />;
  }

  if (bapUserData.status === "failure") {
    return <Message type="error" text={messages.bapFetchError} />;
  }

  if (rebateFormSubmissions.status === "failure") {
    return <Message type="error" text={messages.rebateSubmissionsError} />;
  }

  /**
   * Formio submissions, merged with rebate submissions returned from the BAP,
   * so we can include CSB rebate status, CSB review item ID, and last updated
   * datetime.
   */
  const submissions = rebateFormSubmissions.data.map((formioSubmission) => {
    const matchedSubmission = bapUserData.data.rebateSubmissions.find(
      (bapSubmission) => bapSubmission.CSB_Form_ID__c === formioSubmission._id
    );

    return {
      ...formioSubmission,
      bap: {
        lastModified: matchedSubmission
          ? matchedSubmission?.CSB_Form_Modified__c
          : null,
        rebateId: matchedSubmission
          ? matchedSubmission?.Parent_Rebate_ID__c
          : null,
        rebateStatus: matchedSubmission
          ? matchedSubmission?.Parent_CSB_Rebate__r?.CSB_Rebate_Status__c
          : null,
      },
    };
  });

  const enrollmentClosed =
    csbData.status === "success" && csbData.data.enrollmentClosed;

  return (
    <>
      {submissions.length === 0 ? (
        <div className="margin-top-4">
          <Message type="info" text={messages.newRebateApplication} />
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
              className="usa-table usa-table--stacked usa-table--borderless usa-table--striped width-full"
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
                      tooltip="submitted or draft"
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
                {submissions.map((submission) => {
                  const { bap, _id, state, modified, data } = submission;
                  const {
                    applicantUEI,
                    applicantEfti,
                    applicantEfti_display,
                    applicantOrganizationName,
                    schoolDistrictName,
                    last_updated_by,
                  } = data;

                  const date = new Date(modified).toLocaleDateString();
                  const time = new Date(modified).toLocaleTimeString();

                  /**
                   * The submission has been updated since the last time the
                   * BAP's submissions ETL process has succesfully run.
                   */
                  const submissionHasBeenUpdated = bap.lastModified
                    ? new Date(modified) > new Date(bap.lastModified)
                    : false;

                  const submissionNeedsEdits =
                    bap.rebateStatus === "Edits Requested" &&
                    (state === "draft" ||
                      (state === "submitted" && !submissionHasBeenUpdated));

                  const submissionHasBeenResubmitted =
                    bap.rebateStatus === "Edits Requested" &&
                    state === "submitted" &&
                    submissionHasBeenUpdated;

                  const statusClassNames = submissionNeedsEdits
                    ? "csb-needs-edits"
                    : enrollmentClosed || state === "submitted"
                    ? "text-italic text-base-dark"
                    : "";

                  /* NOTE: when a form is first initially created, and the user
has not yet clicked the "Next" or "Save" buttons, any fields that the formio
form definition sets automatically (based on hidden fields we inject on form
creation) will not yet be part of the form submission data. As soon as the user
clicks the "Next" or "Save" buttons the first time, those fields will be set and
stored in the submission. Since we display some of those fields in the table
below, we need to check if their values exist, and if they don't (for cases
where the user has not yet advanced past the first screen of the form...which we
believe is a bit of an edge case, as most users will likely do that after
starting a new application), indicate to the user they need to first save the
form for the fields to be displayed. */
                  return (
                    <Fragment key={_id}>
                      <tr>
                        <th scope="row" className={statusClassNames}>
                          {submissionNeedsEdits ? (
                            <button
                              className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                              onClick={(ev) => {
                                // clear out existing message
                                setMessage({
                                  displayed: false,
                                  type: "info",
                                  text: "",
                                });

                                // change the submission's state to draft, then
                                // redirect to the form to allow user to edit
                                fetchData(
                                  `${serverUrl}/api/rebate-form-submission/${_id}`,
                                  { data, state: "draft" }
                                )
                                  .then((res) => {
                                    navigate(`/rebate/${res._id}`);
                                  })
                                  .catch((err) => {
                                    setMessage({
                                      displayed: true,
                                      type: "error",
                                      text: `Error updating Rebate ${bap.rebateId}. Please try again.`,
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
                                  <use href={`${icons}#edit`} />
                                </svg>
                                <span className="margin-left-1">Edit</span>
                              </span>
                            </button>
                          ) : state === "draft" ? (
                            <Link
                              to={`/rebate/${_id}`}
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
                          ) : state === "submitted" ? (
                            <Link
                              to={`/rebate/${_id}`}
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
                          ) : null}
                        </th>

                        <td className={statusClassNames}>
                          {bap.rebateId ? (
                            <span title={`Form ID: ${_id}`}>
                              {bap.rebateId}
                            </span>
                          ) : (
                            <TextWithTooltip
                              text=" "
                              tooltip="Rebate ID will be displayed within 24hrs. after starting a new rebate form application"
                            />
                          )}
                        </td>

                        <td className={statusClassNames}>
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
                                  submissionNeedsEdits
                                    ? `${icons}#priority_high`
                                    : submissionHasBeenResubmitted ||
                                      state === "submitted"
                                    ? `${icons}#check`
                                    : state === "draft"
                                    ? `${icons}#more_horiz`
                                    : `${icons}#remove` // fallback, not used
                                }
                              />
                            </svg>
                            <span className="margin-left-05">
                              {submissionHasBeenResubmitted
                                ? "resubmitted"
                                : submissionNeedsEdits
                                ? bap.rebateStatus
                                : state}
                            </span>
                          </span>
                        </td>

                        <td className={statusClassNames}>
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
The initial version of the rebate form definition included the `applicantEfti`
field, which is configured via the form definition (in formio/forms.gov) to set
its value based on the value of the `sam_hidden_applicant_efti` field, which we
inject on initial form submission. That value comes from the BAP (SAM.gov data),
which could be an empty string.

To handle the potentially empty string, the formio form definition was updated
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

                        <td className={statusClassNames}>
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

                        <td className={statusClassNames}>
                          {last_updated_by}
                          <br />
                          <span title={`${date} ${time}`}>{date}</span>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
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
