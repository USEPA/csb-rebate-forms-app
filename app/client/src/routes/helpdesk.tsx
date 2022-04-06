import { useState } from "react";
import icon from "uswds/img/usa-icons-bg/search--white.svg";
// ---
import { serverUrl, fetchData } from "../config";
import MarkdownContent from "components/markdownContent";
import { useContentState } from "contexts/content";

type SubmissionState =
  | {
      status: "idle";
      data: { submissionData: null };
    }
  | {
      status: "pending";
      data: { submissionData: null };
    }
  | {
      status: "success";
      data: {
        submissionData: {
          _id: string;
          data: object;
          state: "submitted" | "draft";
        };
      };
    }
  | {
      status: "failure";
      data: { submissionData: null };
    };

export default function Helpdesk() {
  const [searchText, setSearchText] = useState("");
  const { content } = useContentState();

  const [rebateFormSubmission, setRebateFormSubmission] =
    useState<SubmissionState>({
      status: "idle",
      data: { submissionData: null },
    });

  console.log(rebateFormSubmission);

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

            setRebateFormSubmission({
              status: "pending",
              data: { submissionData: null },
            });

            fetchData(`${serverUrl}/help/rebate-form-submission/${searchText}`)
              .then((res) => {
                setRebateFormSubmission({
                  status: "success",
                  data: res,
                });
              })
              .catch((err) => {
                setRebateFormSubmission({
                  status: "failure",
                  data: { submissionData: null },
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
    </>
  );
}
