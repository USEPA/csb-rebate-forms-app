import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Form } from "@formio/react";
import clsx from "clsx";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import {
  serverUrl,
  messages,
  formioStatusMap,
  bapStatusMap,
  formioNameField,
  formioEmailField,
} from "@/config";
import {
  type FormType,
  type FormioFRF2022Submission,
  type FormioPRF2022Submission,
  type FormioCRF2022Submission,
  type FormioFRF2023Submission,
  type BapSubmission,
  getData,
  postData,
  useContentData,
  useHelpdeskAccess,
  submissionNeedsEdits,
} from "@/utilities";
import { Loading } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";
import { TextWithTooltip } from "@/components/tooltip";
import {
  type RebateYear,
  useRebateYearState,
  useRebateYearActions,
} from "@/contexts/rebateYear";

type ServerResponse =
  | {
      formSchema: null;
      formio: null;
      bap: BapSubmission;
    }
  | {
      formSchema: { url: string; json: object };
      formio:
        | FormioFRF2022Submission
        | FormioPRF2022Submission
        | FormioCRF2022Submission
        | FormioFRF2023Submission;
      bap: BapSubmission;
    };

function formatDate(dateTimeString: string | null) {
  return dateTimeString ? new Date(dateTimeString).toLocaleDateString() : "";
}

function formatTime(dateTimeString: string | null) {
  return dateTimeString ? new Date(dateTimeString).toLocaleTimeString() : "";
}

function ResultTableRow(props: {
  lastSearchedText: string;
  formType: FormType;
  formio:
    | FormioFRF2022Submission
    | FormioPRF2022Submission
    | FormioCRF2022Submission
    | FormioFRF2023Submission;
  bap: BapSubmission;
}) {
  const { lastSearchedText, formType, formio, bap } = props;
  const { rebateYear } = useRebateYearState();

  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["helpdesk/pdf"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio/pdf/${formio.form}/${formio._id}`;

  const query = useQuery({
    queryKey: ["helpdesk/pdf"],
    queryFn: () => getData<Blob>(url),
    onSuccess: (res) => {
      const link = document.createElement("a");
      link.setAttribute("href", `data:application/pdf;base64,${res}`);
      link.setAttribute("download", `${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    enabled: false,
  });

  const date = formatDate(formio.modified);
  const time = formatTime(formio.modified);

  const bapInternalStatus = bap.status || "";
  const formioStatus = formioStatusMap.get(formio.state);

  const id = lastSearchedText.length === 6 ? bap.rebateId : bap.mongoId;

  const status = submissionNeedsEdits({ formio, bap })
    ? "Edits Requested"
    : bapStatusMap[rebateYear][formType].get(bapInternalStatus) || formioStatus;

  const nameField = formioNameField[rebateYear][formType];
  const emailField = formioEmailField[rebateYear][formType];

  const name = (formio.data[nameField] as string) || "";
  const email = (formio.data[emailField] as string) || "";

  return (
    <>
      <td>{id}</td>
      <td>{status}</td>
      <td>{name}</td>
      <td>{email}</td>
      <td>
        <span title={`${date} ${time}`}>{date}</span>
      </td>

      <td className={clsx("!tw-text-right")}>
        <button
          className={clsx(
            "tw-border-0 tw-border-b-[1.5px] tw-border-transparent tw-p-0 tw-text-sm tw-leading-tight",
            "enabled:tw-cursor-pointer",
            "hover:enabled:tw-border-b-slate-800",
            "focus:enabled:tw-border-b-slate-800",
          )}
          type="button"
          onClick={(_ev) => query.refetch()}
        >
          <span className={clsx("tw-flex tw-items-center")}>
            <span className={clsx("tw-mr-1")}>Download</span>
            <svg
              className="usa-icon"
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <use href={`${icons}#arrow_downward`} />
            </svg>
          </span>
        </button>
      </td>
    </>
  );
}

export function Helpdesk() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const content = useContentData();
  const helpdeskAccess = useHelpdeskAccess();
  const { rebateYear } = useRebateYearState();
  const { setRebateYear } = useRebateYearActions();

  const [formType, setFormType] = useState<FormType>("frf");
  const [searchText, setSearchText] = useState("");
  const [lastSearchedText, setLastSearchedText] = useState("");
  const [resultDisplayed, setResultDisplayed] = useState(false);
  const [formDisplayed, setFormDisplayed] = useState(false);

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["helpdesk/submission"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/help/formio/${rebateYear}/${formType}/${searchText}`;

  const query = useQuery({
    queryKey: ["helpdesk/submission"],
    queryFn: () => getData<ServerResponse>(url),
    onSuccess: (_res) => setResultDisplayed(true),
    enabled: false,
  });

  const mutation = useMutation({
    mutationFn: () => postData<ServerResponse>(url, {}),
    onSuccess: (res) => queryClient.setQueryData(["helpdesk/submission"], res),
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

      <div className="margin-top-1 padding-2 border-1px border-base-lighter bg-base-lightest">
        <nav className="flex-align-center tablet:display-flex">
          <div className="tablet:margin-right-1">
            <label
              htmlFor="rebate-year"
              className="margin-right-1 font-sans-2xs"
            >
              Rebate Year:
            </label>
            <select
              id="rebate-year"
              className={clsx(
                "tw-rounded-md tw-border-0 tw-text-sm tw-font-bold tw-leading-4 tw-ring-1 tw-ring-inset tw-ring-gray-300",
              )}
              name="rebate-year"
              onChange={(ev) => {
                setRebateYear(ev.target.value as RebateYear);
                setResultDisplayed(false);
                queryClient.resetQueries({ queryKey: ["helpdesk/submission"] });
              }}
              defaultValue={rebateYear}
            >
              <option>2022</option>
              <option>2023</option>
            </select>
          </div>

          <div className="tablet:margin-left-1">
            <fieldset className="csb-helpdesk-form-inputs usa-fieldset tablet:display-flex">
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
                    queryClient.resetQueries({
                      queryKey: ["helpdesk/submission"],
                    });
                  }}
                />
                <label
                  className="usa-radio__label tablet:margin-top-0 font-sans-2xs"
                  htmlFor="form-type-frf"
                >
                  Application
                </label>
              </div>

              <div className="usa-radio tablet:margin-left-2">
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
                    queryClient.resetQueries({
                      queryKey: ["helpdesk/submission"],
                    });
                  }}
                />
                <label
                  className="usa-radio__label tablet:margin-top-0 font-sans-2xs"
                  htmlFor="form-type-prf"
                >
                  Payment Request
                </label>
              </div>

              <div className="usa-radio tablet:margin-left-2">
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
                    queryClient.resetQueries({
                      queryKey: ["helpdesk/submission"],
                    });
                  }}
                />
                <label
                  className="usa-radio__label tablet:margin-top-0 font-sans-2xs"
                  htmlFor="form-type-crf"
                >
                  Close Out
                </label>
              </div>
            </fieldset>
          </div>
        </nav>

        <div className="margin-top-2 tablet:margin-top-1">
          <form
            className="usa-search"
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
              <img
                className="usa-search__submit-icon"
                src={icon}
                alt="Search"
              />
            </button>
          </form>
        </div>
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

                  <th scope="col" className={clsx("tw-text-right")}>
                    <TextWithTooltip
                      text="Download PDF"
                      tooltip="Download a PDF of this submission"
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

                  <ResultTableRow
                    lastSearchedText={lastSearchedText}
                    formType={formType}
                    formio={formio}
                    bap={bap}
                  />
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
