import { useEffect } from "react";
import { Link } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { TextWithTooltip } from "components/infoTooltip";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useFormsState, useFormsDispatch } from "contexts/forms";

export default function AllRebateForms() {
  const { content } = useContentState();
  const { samUserData } = useUserState();
  const { rebateFormSubmissions } = useFormsState();
  const dispatch = useFormsDispatch();

  useEffect(() => {
    if (samUserData.status !== "success" || !samUserData.data.results) return;

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
  }, [samUserData, dispatch]);

  if (
    rebateFormSubmissions.status === "idle" ||
    rebateFormSubmissions.status === "pending"
  ) {
    return <Loading />;
  }

  if (rebateFormSubmissions.status === "failure") {
    return (
      <Message type="error" text="Error loading rebate form submissions." />
    );
  }

  return (
    <>
      {rebateFormSubmissions.data.length === 0 ? (
        <div className="margin-top-4">
          <Message
            type="info"
            text="Please select the “New Application” button above to create your first rebate application."
          />
        </div>
      ) : (
        <>
          {content.status === "success" && (
            <MarkdownContent
              className="margin-top-4"
              children={content.data?.allRebateFormsIntro || ""}
            />
          )}

          <div className="usa-table-container--scrollable" tabIndex={0}>
            <table className="usa-table usa-table--stacked usa-table--borderless usa-table--striped width-full">
              <thead>
                <tr className="font-sans-2xs text-no-wrap">
                  <th scope="col">
                    <span className="usa-sr-only">Open</span>
                  </th>
                  <th scope="col">
                    <TextWithTooltip
                      text="Form Type"
                      tooltip="Application, Payment Request, or Close-Out form"
                    />
                  </th>
                  <th scope="col">
                    <TextWithTooltip
                      text="UEI"
                      tooltip="Unique Entity ID from SAM.gov"
                    />
                  </th>
                  <th scope="col">
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
                  </th>
                  <th scope="col">
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
                </tr>
              </thead>
              <tbody>
                {rebateFormSubmissions.data.map((submission) => {
                  const { _id, state, modified, data } = submission;
                  const {
                    applicantUEI,
                    applicantEfti,
                    applicantOrganizationName,
                    schoolDistrictName,
                    last_updated_by,
                  } = data;

                  return (
                    <tr
                      key={_id}
                      className={
                        state === "submitted"
                          ? "text-italic text-base-dark"
                          : ""
                      }
                    >
                      <th scope="row">
                        <Link
                          to={`/rebate/${_id}`}
                          className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                        >
                          <span className="usa-sr-only">Open Form {_id}</span>
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
                        </Link>
                      </th>
                      <td>Application</td>
                      <td>{applicantUEI}</td>
                      <td>{applicantEfti}</td>
                      <td>{applicantOrganizationName}</td>
                      <td>{schoolDistrictName}</td>
                      <td>{last_updated_by}</td>
                      <td>{new Date(modified).toLocaleDateString()}</td>
                      <td>{state}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {content.status === "success" && (
        <div className="margin-top-4 padding-2 padding-bottom-0 border-1px border-base-lighter bg-base-lightest">
          <MarkdownContent children={content.data?.allRebateFormsOutro || ""} />
        </div>
      )}
    </>
  );
}
