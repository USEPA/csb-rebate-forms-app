import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form } from "@formio/react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import { useHelpdeskAccess } from "components/app";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useDialogDispatch } from "contexts/dialog";

type SubmissionState =
  | {
      status: "idle";
      data: {
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "pending";
      data: {
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "success";
      data: {
        formSchema: { url: string; json: object };
        submissionData: {
          // NOTE: more fields are in a form.io submission,
          // but we're only concerned with the fields below
          _id: string;
          state: "submitted" | "draft";
          modified: string;
          data: {
            applicantOrganizationName: string;
            last_updated_by: string;
            // (other fields...)
          };
          // (other fields...)
        };
      };
    }
  | {
      status: "failure";
      data: {
        formSchema: null;
        submissionData: null;
      };
    };

export default function Helpdesk() {
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState("");
  const [formId, setFormId] = useState("");
  const [formDisplayed, setFormDisplayed] = useState(false);

  const { content } = useContentState();
  const { epaUserData } = useUserState();
  const dispatch = useDialogDispatch();
  const helpdeskAccess = useHelpdeskAccess();

  const [rebateFormSubmission, setRebateFormSubmission] =
    useState<SubmissionState>({
      status: "idle",
      data: {
        formSchema: null,
        submissionData: null,
      },
    });

  if (
    epaUserData.status !== "success" ||
    helpdeskAccess === "idle" ||
    helpdeskAccess === "pending"
  ) {
    return <Loading />;
  }

  if (helpdeskAccess === "failure") {
    navigate("/", { replace: true });
  }

  const { formSchema, submissionData } = rebateFormSubmission.data;

  return (
    <>
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={content.data?.helpdeskIntro || ""}
        />
      )}

      <div className="padding-2 border-1px border-base-lighter bg-base-lightest">
        <form
          className="usa-search"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();

            setFormId("");
            setFormDisplayed(false);

            setRebateFormSubmission({
              status: "pending",
              data: {
                formSchema: null,
                submissionData: null,
              },
            });

            fetchData(`${serverUrl}/help/rebate-form-submission/${searchText}`)
              .then((res) => {
                setFormId(res.submissionData._id);
                setRebateFormSubmission({
                  status: "success",
                  data: res,
                });
              })
              .catch((err) => {
                setFormId("");
                setRebateFormSubmission({
                  status: "failure",
                  data: {
                    formSchema: null,
                    submissionData: null,
                  },
                });
              });
          }}
        >
          <label className="usa-sr-only" htmlFor="search-field-rebate-form-id">
            Search by Form ID
          </label>
          <input
            id="search-field-rebate-form-id"
            className="usa-input"
            type="search"
            name="search"
            onChange={(ev) => setSearchText(ev.target.value)}
            value={searchText}
          />
          <button className="usa-button" type="submit">
            <span className="usa-search__submit-text">Search</span>
            <img className="usa-search__submit-icon" src={icon} alt="Search" />
          </button>
        </form>
      </div>

      {rebateFormSubmission.status === "pending" && <Loading />}

      {rebateFormSubmission.status === "failure" && (
        <Message
          type="error"
          text="Error loading rebate form submission. Please confirm the form ID is correct and search again."
        />
      )}

      {/*
        NOTE: when the rebate form submission data is succesfully fetched, the
        response should contain the submission data, but since it's coming from
        an external server, we should check that it exists first before using it
      */}
      {rebateFormSubmission.status === "success" &&
        !rebateFormSubmission.data && (
          <Message
            type="error"
            text="Error loading rebate form submission. Please confirm the form ID is correct and search again."
          />
        )}

      {rebateFormSubmission.status === "success" &&
        formSchema &&
        submissionData && (
          <>
            <div className="usa-table-container--scrollable" tabIndex={0}>
              <table className="usa-table usa-table--stacked usa-table--borderless usa-table--striped width-full">
                <thead>
                  <tr className="font-sans-2xs text-no-wrap">
                    <th scope="col">
                      <span className="usa-sr-only">Open</span>
                    </th>
                    <th scope="col">
                      <TextWithTooltip
                        text="Form ID"
                        tooltip="Form ID returned from Forms.gov"
                      />
                    </th>
                    <th scope="col">
                      <TextWithTooltip
                        text="Applicant"
                        tooltip="Legal Business Name from SAM.gov for this UEI"
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
                        text="Status"
                        tooltip="submitted or draft"
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
                        onClick={(ev) => setFormDisplayed(true)}
                      >
                        <span className="usa-sr-only">Open Form {formId}</span>
                        <span className="display-flex flex-align-center">
                          <svg
                            className="usa-icon"
                            aria-hidden="true"
                            focusable="false"
                            role="img"
                          >
                            <use href={`${icons}#edit`} />
                          </svg>
                          <span className="mobile-lg:display-none margin-left-1">
                            Open Form
                          </span>
                        </span>
                      </button>
                    </th>
                    <td>{submissionData._id}</td>
                    <td>{submissionData.data.applicantOrganizationName}</td>
                    <td>{submissionData.data.last_updated_by}</td>
                    <td>
                      {new Date(submissionData.modified).toLocaleDateString()}
                    </td>
                    <td>{submissionData.state}</td>
                    <td>
                      <button
                        className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                        disabled={submissionData.state === "draft"}
                        onClick={(ev) => {
                          dispatch({
                            type: "DISPLAY_DIALOG",
                            payload: {
                              dismissable: true,
                              heading:
                                "Are you sure you want to change this submission's state back to draft?",
                              description:
                                "Once the submission is back in a draft state, all users with access to this submission will be able to further edit it.",
                              confirmText: "Yes",
                              cancelText: "Cancel",
                              confirmedAction: () => {
                                setFormDisplayed(false);

                                setRebateFormSubmission({
                                  status: "pending",
                                  data: {
                                    formSchema: null,
                                    submissionData: null,
                                  },
                                });

                                fetchData(
                                  `${serverUrl}/help/rebate-form-submission/${formId}`,
                                  {}
                                )
                                  .then((res) => {
                                    setRebateFormSubmission({
                                      status: "success",
                                      data: res,
                                    });
                                  })
                                  .catch((err) => {
                                    setRebateFormSubmission({
                                      status: "failure",
                                      data: {
                                        formSchema: null,
                                        submissionData: null,
                                      },
                                    });
                                  });
                              },
                            },
                          });
                        }}
                      >
                        <span className="usa-sr-only">
                          Set {formId} to draft
                        </span>
                        <span className="display-flex flex-align-center">
                          <svg
                            className="usa-icon"
                            aria-hidden="true"
                            focusable="false"
                            role="img"
                          >
                            <use href={`${icons}#update`} />
                          </svg>
                          <span className="mobile-lg:display-none margin-left-1">
                            Update Form
                          </span>
                        </span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {formDisplayed && (
              <>
                <h3>Application ID: {submissionData._id}</h3>

                <Form
                  form={formSchema.json}
                  url={formSchema.url} // NOTE: used for file uploads
                  submission={{ data: submissionData.data }}
                  options={{ readOnly: true }}
                />
              </>
            )}
          </>
        )}
    </>
  );
}
