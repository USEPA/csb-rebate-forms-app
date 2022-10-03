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
  usePageState,
  usePageDispatch,
} from "contexts/page";

export function Helpdesk() {
  const navigate = useNavigate();

  const { content } = useContentState();
  const dialogDispatch = useDialogDispatch();
  const { epaUserData } = useUserState();
  const { csbData } = useCsbState();
  const { formio } = usePageState();
  const pageDispatch = usePageDispatch();
  const helpdeskAccess = useHelpdeskAccess();

  // reset page context state
  useEffect(() => {
    pageDispatch({ type: "RESET_STATE" });
  }, [pageDispatch]);

  const [searchText, setSearchText] = useState("");
  const [formId, setFormId] = useState("");
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

  const { enrollmentClosed } = csbData.data;

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
        <form
          className="usa-search"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();

            setFormId("");
            setFormDisplayed(false);

            pageDispatch({ type: "FETCH_FORMIO_DATA_REQUEST" });

            getData(
              `${serverUrl}/help/formio-application-submission/${searchText}`
            )
              .then((res: FormioFetchedResponse) => {
                if (!res.submission) return;

                setFormId(res.submission._id);
                pageDispatch({
                  type: "FETCH_FORMIO_DATA_SUCCESS",
                  payload: { data: res },
                });
              })
              .catch((err) => {
                setFormId("");
                pageDispatch({ type: "FETCH_FORMIO_DATA_FAILURE" });
              });
          }}
        >
          <label className="usa-sr-only" htmlFor="search-field-application-id">
            Search by Application ID
          </label>
          <input
            id="search-field-application-id"
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

      {formio.status === "pending" && <Loading />}

      {formio.status === "failure" && (
        <Message
          type="error"
          text={messages.helpdeskApplicationSubmissionError}
        />
      )}

      {/*
        NOTE: when the application form submission data is successfully fetched,
        the response should contain the submission data, but since it's coming
        from an external server, we should check that it exists first before
        using it
      */}
      {formio.status === "success" && !formio.data && (
        <Message
          type="error"
          text={messages.helpdeskApplicationSubmissionError}
        />
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
                  <td>{submission._id}</td>
                  <td>{submission.data.applicantOrganizationName as string}</td>
                  <td>{submission.data.last_updated_by as string}</td>
                  <td>{new Date(submission.modified).toLocaleDateString()}</td>
                  <td>{submission.state}</td>
                  <td>
                    <button
                      className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                      disabled={
                        enrollmentClosed || submission.state === "draft"
                      }
                      onClick={(ev) => {
                        dialogDispatch({
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

                              pageDispatch({
                                type: "FETCH_FORMIO_DATA_REQUEST",
                              });

                              postData(
                                `${serverUrl}/help/formio-application-submission/${formId}`,
                                {}
                              )
                                .then((res: FormioFetchedResponse) => {
                                  pageDispatch({
                                    type: "FETCH_FORMIO_DATA_SUCCESS",
                                    payload: { data: res },
                                  });
                                })
                                .catch((err) => {
                                  pageDispatch({
                                    type: "FETCH_FORMIO_DATA_FAILURE",
                                  });
                                });
                            },
                          },
                        });
                      }}
                    >
                      <span className="usa-sr-only">Set {formId} to draft</span>
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
              <h3>Application ID: {submission._id}</h3>

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
