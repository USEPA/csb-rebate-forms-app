import { useEffect } from "react";
import { Link } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";
import { useFormsState, useFormsDispatch } from "contexts/forms";

export default function AllRebateForms() {
  const { rebateFormSubmissions } = useFormsState();
  const dispatch = useFormsDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_REQUEST" });

    fetchData(`${serverUrl}/api/v1/rebate-form-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_REBATE_FORM_SUBMISSIONS_SUCCESS",
          payload: { rebateFormSubmissions: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_FAILURE" });
      });
  }, [dispatch]);

  if (rebateFormSubmissions.status === "idle") {
    return null;
  }

  if (rebateFormSubmissions.status === "pending") {
    return <Loading />;
  }

  if (rebateFormSubmissions.status === "failure") {
    return (
      <Message type="error" text="Error loading rebate form submissions." />
    );
  }

  // TODO: add tooltips for all acronymns

  return (
    <table className="usa-table usa-table--borderless usa-table--striped usa-table--stacked width-full">
      <thead>
        <tr>
          <th scope="col" className="font-sans-2xs">
            &nbsp;
          </th>
          <th scope="col" className="font-sans-2xs">
            Form Type
          </th>
          <th scope="col" className="font-sans-2xs">
            UEI
          </th>
          <th scope="col" className="font-sans-2xs">
            EFT
          </th>
          <th scope="col" className="font-sans-2xs">
            UEI Entity Name
          </th>
          <th scope="col" className="font-sans-2xs">
            School District Name
          </th>
          <th scope="col" className="font-sans-2xs">
            Updated By
          </th>
          <th scope="col" className="font-sans-2xs text-right">
            Updated Date
          </th>
          <th scope="col" className="font-sans-2xs">
            Status
          </th>
        </tr>
      </thead>
      <tbody>
        {rebateFormSubmissions.data.map((submission) => {
          const {
            _id,
            formType,
            uei,
            eft,
            ueiEntityName,
            schoolDistrictName,
            lastUpdatedBy,
            lastUpdatedDate,
            status,
          } = submission;

          return (
            <tr key={_id}>
              <th scope="row">
                <Link
                  to={`/rebate/${_id}`}
                  className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
                >
                  <span className="display-flex flex-align-center">
                    <svg
                      className="usa-icon"
                      aria-hidden="true"
                      focusable="false"
                      role="img"
                    >
                      <use href={`${icons}#edit`} />
                    </svg>
                  </span>
                </Link>
              </th>
              <th>
                {formType === "rebate-application"
                  ? "Application"
                  : formType === "payment-request"
                  ? "Payment Request"
                  : formType === "close-out"
                  ? "Close-Out"
                  : ""}
              </th>
              <th>{uei}</th>
              <td>{eft}</td>
              <td>{ueiEntityName}</td>
              <td>{schoolDistrictName}</td>
              <td>{lastUpdatedBy}</td>
              <td className="text-right">
                {new Date(lastUpdatedDate).toLocaleDateString()}
              </td>
              <td>
                {status === "draft"
                  ? "Draft"
                  : status === "submitted"
                  ? "Submitted"
                  : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
