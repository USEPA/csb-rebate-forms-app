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
    <table className="usa-table usa-table--borderless usa-table--striped width-full">
      <thead>
        <tr>
          <th scope="col">&nbsp;</th>
          <th scope="col">UEI</th>
          <th scope="col">EFT</th>
          <th scope="col">CAGE</th>
          <th scope="col">Entity Name</th>
          <th scope="col">Last Updated By</th>
          <th scope="col" className="text-right">
            Last Updated Date
          </th>
        </tr>
      </thead>
      <tbody>
        {rebateFormSubmissions.data.map((submission) => {
          const { _id, uei, eft, cage, entityName, lastUpdatedBy, modified } =
            submission;

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
              <th>{uei}</th>
              <td>{eft}</td>
              <td>{cage}</td>
              <td>{entityName}</td>
              <td>{lastUpdatedBy}</td>
              <td className="text-right">
                {new Date(modified).toLocaleDateString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
