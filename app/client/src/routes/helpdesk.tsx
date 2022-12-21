import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "@formio/react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, getData, postData } from "../config";
import { useHelpdeskAccess } from "components/app";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useDialogDispatch } from "contexts/dialog";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import {
  FormioFetchedResponse,
  useFormioFormState,
  useFormioFormDispatch,
} from "contexts/formioForm";

type FormType = "application" | "payment-request" | "close-out";

export function Helpdesk() {
  const navigate = useNavigate();

  const { content } = useContentState();
  const dialogDispatch = useDialogDispatch();
  const { epaUserData } = useUserState();
  const { csbData } = useCsbState();
  const { formio } = useFormioFormState();
  const formioFormDispatch = useFormioFormDispatch();
  const helpdeskAccess = useHelpdeskAccess();

  // reset formio form state since it's used across pages
  useEffect(() => {
    formioFormDispatch({ type: "RESET_FORMIO_DATA" });
  }, [formioFormDispatch]);

  const [formType, setFormType] = useState<FormType>("application");
  const [searchId, setSearchId] = useState("");
  const [formDisplayed, setFormDisplayed] = useState(false);

  if (
    csbData.status !== "success" ||
    epaUserData.status !== "success" ||
    helpdeskAccess === "idle" ||
    helpdeskAccess === "pending"
  ) {
    return <Loading />;
  }

  if (helpdeskAccess === "failure") {
    navigate("/", { replace: true });
  }

  const applicationFormOpen = csbData.data.submissionPeriodOpen.application;
  const paymentRequestFormOpen =
    csbData.data.submissionPeriodOpen.paymentRequest;
  const closeOutFormOpen = csbData.data.submissionPeriodOpen.closeOut;

  const { formSchema, submission } = formio.data;

  return (
    <>
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={content.data?.helpdeskIntro || ""}
        />
      )}

      <div className="padding-2 border-1px border-base-lighter bg-base-lightest">
        <fieldset className="usa-fieldset mobile-lg:display-flex">
          <div className="usa-radio">
            <input
              id="form-type-application"
              className="usa-radio__input"
              type="radio"
              name="form-type"
              value="application"
              checked={formType === "application"}
              onChange={(ev) => {
                setFormType(ev.target.value as FormType);
                formioFormDispatch({ type: "RESET_FORMIO_DATA" });
              }}
            />
            <label
              className="usa-radio__label margin-top-0"
              htmlFor="form-type-application"
            >
              Application
            </label>
          </div>

          <div className="usa-radio mobile-lg:margin-left-3">
            <input
              id="form-type-payment-request"
              className="usa-radio__input"
              type="radio"
              name="form-type"
              value="payment-request"
              checked={formType === "payment-request"}
              onChange={(ev) => {
                setFormType(ev.target.value as FormType);
                formioFormDispatch({ type: "RESET_FORMIO_DATA" });
              }}
            />
            <label
              className="usa-radio__label mobile-lg:margin-top-0"
              htmlFor="form-type-payment-request"
            >
              Payment Request
            </label>
          </div>

          <div className="usa-radio mobile-lg:margin-left-3">
            <input
              id="form-type-close-out"
              className="usa-radio__input"
              type="radio"
              name="form-type"
              value="close-out"
              checked={formType === "close-out"}
              onChange={(ev) => {
                setFormType(ev.target.value as FormType);
                formioFormDispatch({ type: "RESET_FORMIO_DATA" });
              }}
              disabled={true} // NOTE: disabled until the close-out form is created
            />
            <label
              className="usa-radio__label mobile-lg:margin-top-0"
              htmlFor="form-type-close-out"
            >
              Close-Out
            </label>
          </div>
        </fieldset>

        <form
          className="usa-search margin-top-2"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();
            setFormDisplayed(false);
            formioFormDispatch({ type: "FETCH_FORMIO_DATA_REQUEST" });
            getData(
              `${serverUrl}/help/formio-submission/${formType}/${searchId}`
            )
              .then((res: FormioFetchedResponse) => {
                if (!res.submission) return;
                formioFormDispatch({
                  type: "FETCH_FORMIO_DATA_SUCCESS",
                  payload: { data: res },
                });
              })
              .catch((err) => {
                formioFormDispatch({ type: "FETCH_FORMIO_DATA_FAILURE" });
              });
          }}
        >
          <label className="usa-sr-only" htmlFor="search-submissions-by-id">
            Search submissions by ID
          </label>
          <input
            id="search-submissions-by-id"
            className="usa-input"
            type="search"
            name="search-submissions"
            value={searchId}
            onChange={(ev) => setSearchId(ev.target.value)}
          />
          <button className="usa-button" type="submit">
            <span className="usa-search__submit-text">Search</span>
            <img className="usa-search__submit-icon" src={icon} alt="Search" />
          </button>
        </form>
      </div>

      {formio.status === "pending" && <Loading />}

      {formio.status === "failure" && (
        <Message type="error" text={messages.helpdeskSubmissionSearchError} />
      )}

      {/*
        NOTE: when the application form submission data is successfully fetched,
        the response should contain the submission data, but since it's coming
        from an external server, we should check that it exists first before
        using it
      */}
      {formio.status === "success" && !formio.data && (
        <Message type="error" text={messages.helpdeskSubmissionSearchError} />
      )}

      {formio.status === "success" && formSchema && submission && (
        <>
          <div className="usa-table-container--scrollable" tabIndex={0}>
            <table
              aria-label="Application Form Search Results"
              className="usa-table usa-table--stacked usa-table--borderless usa-table--striped width-full"
            >
              <thead>
                <tr className="font-sans-2xs text-no-wrap">
                  <th scope="col">
                    <span className="usa-sr-only">Open</span>
                  </th>

                  {formType === "application" ? (
                    <th scope="col">
                      <TextWithTooltip
                        text="Application ID"
                        tooltip="Formio submission's MongoDB Object ID"
                      />
                    </th>
                  ) : formType === "payment-request" ? (
                    <th scope="col">
                      <TextWithTooltip
                        text="Rebate ID"
                        tooltip="Unique Clean School Bus Rebate ID"
                      />
                    </th>
                  ) : (
                    <th scope="col">&nbsp;</th>
                  )}

                  <th scope="col">
                    <TextWithTooltip
                      text="Applicant Name"
                      tooltip="Name of Applicant"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Updated By"
                      tooltip="Last person that updated this form"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Date Updated"
                      tooltip="Last date this form was updated"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="Status (Formio)"
                      tooltip="Submitted or Draft"
                    />
                  </th>

                  <th scope="col">
                    <span className="usa-sr-only">Update</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <th scope="row">
                    <button
                      className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                      onClick={(_ev) => setFormDisplayed(true)}
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
                    </button>
                  </th>

                  {formType === "application" ? (
                    <td>{submission._id}</td>
                  ) : formType === "payment-request" ? (
                    <td>{submission.data.hidden_bap_rebate_id as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  {formType === "application" ? (
                    <td>
                      {submission.data.sam_hidden_applicant_name as string}
                    </td>
                  ) : formType === "payment-request" ? (
                    <td>{submission.data.applicantName as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  {formType === "application" ? (
                    <td>{submission.data.last_updated_by as string}</td>
                  ) : formType === "payment-request" ? (
                    <td>{submission.data.hidden_current_user_email}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  <td>{new Date(submission.modified).toLocaleDateString()}</td>

                  <td>
                    {
                      submission.state === "draft"
                        ? "Draft"
                        : submission.state === "submitted"
                        ? "Submitted"
                        : "" // fallback, not used
                    }
                  </td>

                  <td>
                    <button
                      className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                      disabled={
                        submission.state === "draft" ||
                        (formType === "application" && !applicationFormOpen) ||
                        (formType === "payment-request" &&
                          !paymentRequestFormOpen) ||
                        (formType === "close-out" && !closeOutFormOpen)
                      }
                      onClick={(_ev) => {
                        dialogDispatch({
                          type: "DISPLAY_DIALOG",
                          payload: {
                            dismissable: true,
                            heading:
                              "Are you sure you want to change this submission's state back to draft?",
                            description:
                              "Once the submission is back in a draft state, all users with access to this submission will be able to further edit it.",
                            confirmText: "Yes",
                            dismissText: "Cancel",
                            confirmedAction: () => {
                              setFormDisplayed(false);
                              formioFormDispatch({
                                type: "FETCH_FORMIO_DATA_REQUEST",
                              });
                              postData(
                                `${serverUrl}/help/formio-submission/${formType}/${searchId}`,
                                {}
                              )
                                .then((res: FormioFetchedResponse) => {
                                  formioFormDispatch({
                                    type: "FETCH_FORMIO_DATA_SUCCESS",
                                    payload: { data: res },
                                  });
                                })
                                .catch((err) => {
                                  formioFormDispatch({
                                    type: "FETCH_FORMIO_DATA_FAILURE",
                                  });
                                });
                            },
                          },
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
                          <use href={`${icons}#update`} />
                        </svg>
                        <span className="margin-left-1">Update</span>
                      </span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {formDisplayed && (
            <>
              <ul className="usa-icon-list">
                <li className="usa-icon-list__item">
                  <div className="usa-icon-list__icon text-primary">
                    <svg className="usa-icon" aria-hidden="true" role="img">
                      <use href={`${icons}#local_offer`} />
                    </svg>
                  </div>
                  <div className="usa-icon-list__content">
                    {formType === "application" ? (
                      <>
                        <strong>Application ID:</strong> {submission._id}
                      </>
                    ) : formType === "payment-request" ? (
                      <>
                        <strong>Rebate ID:</strong>{" "}
                        {submission.data.hidden_bap_rebate_id}
                      </>
                    ) : (
                      <>&nbsp;</>
                    )}
                  </div>
                </li>
              </ul>

              <Form
                form={formSchema.json}
                url={formSchema.url} // NOTE: used for file uploads
                submission={{ data: submission.data }}
                options={{ readOnly: true }}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
