import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Form } from "@formio/react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import {
  serverUrl,
  messages,
  formioStatusMap,
  bapApplicationStatusMap,
  bapPaymentRequestStatusMap,
  bapCloseOutStatusMap,
} from "../config";
import {
  FormioApplicationSubmission,
  FormioPaymentRequestSubmission,
  FormioCloseOutSubmission,
  BapSubmission,
  getData,
  postData,
  useContentData,
  submissionNeedsEdits,
} from "../utilities";
import { useHelpdeskAccess } from "components/app";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { TextWithTooltip } from "components/tooltip";

type FormType = "frf" | "prf" | "crf";

type ServerResponse =
  | {
      formSchema: null;
      formio: null;
      bap: BapSubmission;
    }
  | {
      formSchema: { url: string; json: object };
      formio:
        | FormioApplicationSubmission
        | FormioPaymentRequestSubmission
        | FormioCloseOutSubmission;
      bap: BapSubmission;
    };

function formatDate(dateTimeString: string | null) {
  return dateTimeString ? new Date(dateTimeString).toLocaleDateString() : "";
}

function formatTime(dateTimeString: string | null) {
  return dateTimeString ? new Date(dateTimeString).toLocaleTimeString() : "";
}

/**
 * Returns a submission's status by checking the BAP internal status first,
 * then falling back to the Formio status if the BAP internal status is not
 * explicitly accounted for.
 */
function getStatus(options: {
  formType: FormType;
  formio:
    | FormioApplicationSubmission
    | FormioPaymentRequestSubmission
    | FormioCloseOutSubmission;
  bap: BapSubmission;
}) {
  const { formType, formio, bap } = options;
  const bapInternalStatus = bap.status;
  const formioStatus = formioStatusMap.get(formio.state);

  if (!bapInternalStatus) return "";

  return submissionNeedsEdits({ formio, bap })
    ? "Edits Requested"
    : formType === "frf"
    ? bapApplicationStatusMap.get(bapInternalStatus) || formioStatus
    : formType === "prf"
    ? bapPaymentRequestStatusMap.get(bapInternalStatus) || formioStatus
    : formType === "crf"
    ? bapCloseOutStatusMap.get(bapInternalStatus) || formioStatus
    : "";
}

export function Helpdesk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const content = useContentData();
  const helpdeskAccess = useHelpdeskAccess();

  const [formType, setFormType] = useState<FormType>("frf");
  const [searchText, setSearchText] = useState("");
  const [lastSearchedText, setLastSearchedText] = useState("");
  const [resultDisplayed, setResultDisplayed] = useState(false);
  const [formDisplayed, setFormDisplayed] = useState(false);

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["helpdesk"] });
  }, [queryClient]);

  const url = `${serverUrl}/help/formio-submission/${formType}/${searchText}`;

  const query = useQuery({
    queryKey: ["helpdesk"],
    queryFn: () => getData<ServerResponse>(url),
    onSuccess: (res) => setResultDisplayed(true),
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
              id="form-type-frf"
              className="usa-radio__input"
              type="radio"
              name="form-type"
              value="frf"
              checked={formType === "frf"}
              onChange={(ev) => {
                setFormType(ev.target.value as FormType);
                setResultDisplayed(false);
                queryClient.resetQueries({ queryKey: ["helpdesk"] });
              }}
            />
            <label
              className="usa-radio__label margin-top-0"
              htmlFor="form-type-frf"
            >
              Application
            </label>
          </div>

          <div className="usa-radio mobile-lg:margin-left-3">
            <input
              id="form-type-prf"
              className="usa-radio__input"
              type="radio"
              name="form-type"
              value="prf"
              checked={formType === "prf"}
              onChange={(ev) => {
                setFormType(ev.target.value as FormType);
                setResultDisplayed(false);
                queryClient.resetQueries({ queryKey: ["helpdesk"] });
              }}
            />
            <label
              className="usa-radio__label mobile-lg:margin-top-0"
              htmlFor="form-type-prf"
            >
              Payment Request
            </label>
          </div>

          <div className="usa-radio mobile-lg:margin-left-3">
            <input
              id="form-type-crf"
              className="usa-radio__input"
              type="radio"
              name="form-type"
              value="crf"
              checked={formType === "crf"}
              onChange={(ev) => {
                setFormType(ev.target.value as FormType);
                setResultDisplayed(false);
                queryClient.resetQueries({ queryKey: ["helpdesk"] });
              }}
            />
            <label
              className="usa-radio__label mobile-lg:margin-top-0"
              htmlFor="form-type-crf"
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
            if (searchText === "") return;
            setLastSearchedText(searchText);
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
      ) : query.isSuccess && !!formio && !!bap && resultDisplayed ? (
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
                      text="Form Status"
                      tooltip="Draft, Edits Requested, Submitted, Withdrawn, Selected, or Not Selected" // TODO: update to reflect other statuses
                    />
                  </th>

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
                    <td>{bap.rebateId}</td>
                  ) : (
                    <td>{bap.mongoId}</td>
                  )}

                  <td>{getStatus({ formType, formio, bap })}</td>

                  {formType === "frf" ? (
                    <td>{formio.data.sam_hidden_applicant_name as string}</td>
                  ) : formType === "prf" ? (
                    <td>{formio.data.applicantName as string}</td>
                  ) : formType === "crf" ? (
                    <td>{formio.data.signatureName as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  {formType === "frf" ? (
                    <td>{formio.data.last_updated_by as string}</td>
                  ) : formType === "prf" ? (
                    <td>{formio.data.hidden_current_user_email as string}</td>
                  ) : formType === "crf" ? (
                    <td>{formio.data.hidden_current_user_email as string}</td>
                  ) : (
                    <td>&nbsp;</td>
                  )}

                  <td>
                    <span
                      title={
                        `${formatDate(formio.modified)} ` +
                        `${formatTime(formio.modified)}`
                      }
                    >
                      {formatDate(formio.modified)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {formDisplayed && !!formSchema && (
            <>
              <ul className="usa-icon-list">
                <li className="usa-icon-list__item">
                  <div className="usa-icon-list__icon text-primary">
                    <svg className="usa-icon" aria-hidden="true" role="img">
                      <use href={`${icons}#local_offer`} />
                    </svg>
                  </div>
                  <div className="usa-icon-list__content">
                    <strong>MongoDB Object ID:</strong> {bap.mongoId}
                  </div>
                </li>

                <li className="usa-icon-list__item">
                  <div className="usa-icon-list__icon text-primary">
                    <svg className="usa-icon" aria-hidden="true" role="img">
                      <use href={`${icons}#local_offer`} />
                    </svg>
                  </div>
                  <div className="usa-icon-list__content">
                    <strong>Rebate ID:</strong> {bap.rebateId}
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
