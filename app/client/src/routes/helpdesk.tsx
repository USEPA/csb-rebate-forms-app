import { useState } from "react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useDialogDispatch } from "contexts/dialog";

type SubmissionState =
  | {
      status: "idle";
      data: null;
    }
  | {
      status: "pending";
      data: null;
    }
  | {
      status: "success";
      data: {
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
    }
  | {
      status: "failure";
      data: null;
    };

export default function Helpdesk() {
  const [searchText, setSearchText] = useState("");
  const [formId, setFormId] = useState("");

  const { content } = useContentState();
  const dispatch = useDialogDispatch();

  const [rebateFormSubmission, setRebateFormSubmission] =
    useState<SubmissionState>({
      status: "idle",
      data: null,
    });

  function confirmatSubmissionChange() {
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
          const submissionUrl = `${serverUrl}/help/rebate-form-submission/${formId}`;
          const submissionData = rebateFormSubmission.data;
          if (!submissionData) return;

          fetchData(submissionUrl, {
            state: "draft",
            data: {
              ...submissionData.data,
              last_updated_by: "(helpdesk)", // TODO: get logged in user and pass it here
            },
          })
            .then((postRes) => {
              setRebateFormSubmission({
                status: "pending",
                data: null,
              });

              fetchData(submissionUrl).then((getRes) => {
                setRebateFormSubmission({
                  status: "success",
                  data: getRes,
                });
              });
            })
            .catch((err) => {
              setRebateFormSubmission({
                status: "failure",
                data: null,
              });
            });
        },
      },
    });
  }

  return (
    <>
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={content.data.helpdeskIntro}
        />
      )}

      <div className="padding-2 border-1px border-base-lighter bg-base-lightest">
        <form
          className="usa-search"
          role="search"
          onSubmit={(ev) => {
            ev.preventDefault();

            setFormId("");

            setRebateFormSubmission({
              status: "pending",
              data: null,
            });

            fetchData(`${serverUrl}/help/rebate-form-submission/${searchText}`)
              .then((res) => {
                setFormId(res._id);
                setRebateFormSubmission({
                  status: "success",
                  data: res,
                });
              })
              .catch((err) => {
                setFormId("");
                setRebateFormSubmission({
                  status: "failure",
                  data: null,
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

      {rebateFormSubmission.status === "success" && (
        <table className="usa-table usa-table--borderless usa-table--striped width-full">
          <thead>
            <tr className="font-sans-2xs text-no-wrap">
              <th scope="col">&nbsp;</th>
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
                <TextWithTooltip text="Status" tooltip="submitted or draft" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <button
                  className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                  disabled={rebateFormSubmission.data.state === "draft"}
                  onClick={(ev) => confirmatSubmissionChange()}
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
                  </span>
                </button>
              </th>
              <td>{rebateFormSubmission.data._id}</td>
              <td>
                {rebateFormSubmission.data.data.applicantOrganizationName}
              </td>
              <td>{rebateFormSubmission.data.data.last_updated_by}</td>
              <td>
                {new Date(
                  rebateFormSubmission.data.modified
                ).toLocaleDateString()}
              </td>
              <td>{rebateFormSubmission.data.state}</td>
            </tr>
          </tbody>
        </table>
      )}
    </>
  );
}
