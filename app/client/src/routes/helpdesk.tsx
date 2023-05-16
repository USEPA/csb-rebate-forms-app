import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Form } from "@formio/react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages } from "../config";
import { getData, postData, useContentData, useCsbData } from "../utilities";
import { useHelpdeskAccess } from "components/app";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/tooltip";
import { useDialogActions } from "contexts/dialog";

type FormType = "application" | "payment-request" | "close-out";

type FormioSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  modified: string; // ISO 8601 date string
  metadata: { [field: string]: unknown };
  data: { [field: string]: unknown };
  state: "submitted" | "draft";
};

type ServerResponse =
  | {
      formSchema: null;
      submission: null;
    }
  | {
      formSchema: { url: string; json: object };
      submission: FormioSubmission;
    };

export function Helpdesk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const content = useContentData();
  const csbData = useCsbData();
  const { displayDialog } = useDialogActions();
  const helpdeskAccess = useHelpdeskAccess();

  const [formType, setFormType] = useState<FormType>("application");
  const [searchId, setSearchId] = useState("");
  const [formDisplayed, setFormDisplayed] = useState(false);

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["helpdesk"] });
  }, [queryClient]);

  const url = `${serverUrl}/help/formio-submission/${formType}/${searchId}`;

  const query = useQuery({
    queryKey: ["helpdesk"],
    queryFn: () => getData<ServerResponse>(url),
    enabled: false,
  });

  const mutation = useMutation({
    mutationFn: () => postData<ServerResponse>(url, {}),
    onSuccess: (data) => queryClient.setQueryData(["helpdesk"], data),
  });

  const { formSchema, submission } = query.data ?? {};

  if (!csbData || helpdeskAccess === "pending") {
    return <Loading />;
  }

  if (helpdeskAccess === "failure") {
    navigate("/", { replace: true });
  }

  const applicationFormOpen = csbData.submissionPeriodOpen.application;
  const paymentRequestFormOpen = csbData.submissionPeriodOpen.paymentRequest;
  const closeOutFormOpen = csbData.submissionPeriodOpen.closeOut;

  return (
    <>
      {content && (
        <MarkdownContent
          className="margin-top-4"
          children={content.helpdeskIntro}
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
                queryClient.resetQueries({ queryKey: ["helpdesk"] });
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
                queryClient.resetQueries({ queryKey: ["helpdesk"] });
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
                queryClient.resetQueries({ queryKey: ["helpdesk"] });
              }}
            />
            <label
              className="usa-radio__label mobile-lg:margin-top-0"
              htmlFor="form-type-close-out"
            >
              Close Out
            </label>
          </div>
        </fieldset>

        <form
          className="usa-search margin-top-2"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();
            setFormDisplayed(false);
            query.refetch();
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

      {query.isFetching || mutation.isLoading ? (
        <Loading />
      ) : query.isError || mutation.isError ? (
        <Message type="error" text={messages.helpdeskSubmissionSearchError} />
      ) : query.isSuccess && !!formSchema && !!submission ? (
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
                  ) : formType === "close-out" ? (
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
                  ) : formType === "close-out" ? (
                    <td>{submission.data.signatureName as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  {formType === "application" ? (
                    <td>{submission.data.last_updated_by as string}</td>
                  ) : formType === "payment-request" ? (
                    <td>
                      {submission.data.hidden_current_user_email as string}
                    </td>
                  ) : formType === "close-out" ? (
                    <td>
                      {submission.data.hidden_current_user_email as string}
                    </td>
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

                  {/*
                    TODO: investigate removing the changing of a submission's
                    formio status now that the BAP team's workflow is in place
                  */}

                  <td>
                    <button
                      className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                      disabled={
                        // prettier-ignore
                        submission.state === "draft" ||
                          (formType === "application" && !applicationFormOpen) ||
                          (formType === "payment-request" && !paymentRequestFormOpen) ||
                          (formType === "close-out" && !closeOutFormOpen)
                      }
                      onClick={(_ev) => {
                        displayDialog({
                          dismissable: true,
                          heading:
                            "Are you sure you want to change this submission's state back to draft?",
                          description: (
                            <p>
                              Once the submission is back in a draft state, all
                              users with access to this submission will be able
                              to further edit it.
                            </p>
                          ),
                          confirmText: "Yes",
                          dismissText: "Cancel",
                          confirmedAction: () => {
                            setFormDisplayed(false);
                            mutation.mutate();
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
      ) : null}
    </>
  );
}
