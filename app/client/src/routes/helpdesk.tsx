import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Form } from "@formio/react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages } from "../config";
import {
  getData,
  postData,
  useContentData,
  BapFormSubmission,
} from "../utilities";
import { useHelpdeskAccess } from "components/app";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/tooltip";

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
      formio: null;
      bap: BapFormSubmission;
    }
  | {
      formSchema: { url: string; json: object };
      formio: FormioSubmission;
      bap: BapFormSubmission;
    };

function formatDate(field: string) {
  return new Date(field).toLocaleDateString();
}

function formatTime(field: string) {
  return new Date(field).toLocaleTimeString();
}

export function Helpdesk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const content = useContentData();
  const helpdeskAccess = useHelpdeskAccess();

  const [formType, setFormType] = useState<FormType>("application");
  const [searchText, setSearchText] = useState("");
  const [lastSearchedText, setLastSearchedText] = useState("");
  const [formDisplayed, setFormDisplayed] = useState(false);

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["helpdesk"] });
  }, [queryClient]);

  const url = `${serverUrl}/help/formio-submission/${formType}/${searchText}`;

  const query = useQuery({
    queryKey: ["helpdesk"],
    queryFn: () => getData<ServerResponse>(url),
    enabled: false,
  });

  const mutation = useMutation({
    mutationFn: () => postData<ServerResponse>(url, {}),
    onSuccess: (data) => queryClient.setQueryData(["helpdesk"], data),
  });

  const { formSchema, formio, bap } = query.data ?? {};

  if (helpdeskAccess === "pending") {
    return <Loading />;
  }

  if (helpdeskAccess === "failure") {
    navigate("/", { replace: true });
  }

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
            setLastSearchedText(searchText);
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
            value={searchText}
            onChange={(ev) => setSearchText(ev.target.value)}
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
      ) : query.isSuccess && !!formSchema && !!formio && !!bap ? (
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

                  {lastSearchedText.length === 6 ? (
                    <th scope="col">
                      <TextWithTooltip
                        text="Rebate ID"
                        tooltip="Unique Clean School Bus Rebate ID"
                      />
                    </th>
                  ) : (
                    <th scope="col">
                      <TextWithTooltip
                        text="MongoDB Object ID"
                        tooltip="Formio submission's MongoDB Object ID"
                      />
                    </th>
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
                      text="BAP Date Updated"
                      tooltip="Last date this form was updated, as returned from the BAP"
                    />
                  </th>

                  <th scope="col">
                    <TextWithTooltip
                      text="BAP Internal Status"
                      tooltip="Internal status returned from the BAP"
                    />
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

                  {lastSearchedText.length === 6 ? (
                    <td>{bap.Parent_Rebate_ID__c}</td>
                  ) : (
                    <td>{bap.CSB_Form_ID__c}</td>
                  )}

                  {formType === "application" ? (
                    <td>{formio.data.sam_hidden_applicant_name as string}</td>
                  ) : formType === "payment-request" ? (
                    <td>{formio.data.applicantName as string}</td>
                  ) : formType === "close-out" ? (
                    <td>{formio.data.signatureName as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  {formType === "application" ? (
                    <td>{formio.data.last_updated_by as string}</td>
                  ) : formType === "payment-request" ? (
                    <td>{formio.data.hidden_current_user_email as string}</td>
                  ) : formType === "close-out" ? (
                    <td>{formio.data.hidden_current_user_email as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  <td>
                    <span
                      title={
                        `${formatDate(bap.CSB_Modified_Full_String__c)} ` +
                        `${formatTime(bap.CSB_Modified_Full_String__c)}`
                      }
                    >
                      {formatDate(bap.CSB_Modified_Full_String__c)}
                    </span>
                  </td>

                  {formType === "application" ? (
                    <td>
                      {bap.Parent_CSB_Rebate__r.CSB_Funding_Request_Status__c}
                    </td>
                  ) : formType === "payment-request" ? (
                    <td>
                      {bap.Parent_CSB_Rebate__r.CSB_Payment_Request_Status__c}
                    </td>
                  ) : formType === "close-out" ? (
                    <td>
                      {bap.Parent_CSB_Rebate__r.CSB_Closeout_Request_Status__c}
                    </td>
                  ) : (
                    <td>&nbsp;</td>
                  )}
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
                    <strong>MongoDB Object ID:</strong> {bap.CSB_Form_ID__c}
                  </div>
                </li>

                <li className="usa-icon-list__item">
                  <div className="usa-icon-list__icon text-primary">
                    <svg className="usa-icon" aria-hidden="true" role="img">
                      <use href={`${icons}#local_offer`} />
                    </svg>
                  </div>
                  <div className="usa-icon-list__content">
                    <strong>Rebate ID:</strong> {bap.Parent_Rebate_ID__c}
                  </div>
                </li>
              </ul>

              <Form
                form={formSchema.json}
                url={formSchema.url} // NOTE: used for file uploads
                submission={{ data: formio.data }}
                options={{ readOnly: true }}
              />
            </>
          )}
        </>
      ) : null}
    </>
  );
}
