import { useEffect } from "react";
import { Link } from "react-router-dom";
// ---
import { useApiState, fetchData } from "contexts/api";
import { useFormsState, useFormsDispatch } from "contexts/forms";

export default function Forms() {
  const { apiUrl } = useApiState();
  const { rebateFormSubmissions } = useFormsState();
  const dispatch = useFormsDispatch();

  useEffect(() => {
    dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_REQUEST" });

    fetchData(`${apiUrl}/api/v1/rebate-form-submissions`)
      .then((res) => {
        dispatch({
          type: "FETCH_REBATE_FORM_SUBMISSIONS_SUCCESS",
          payload: { rebateFormSubmissions: res },
        });
      })
      .catch((err) => {
        console.error("Error fetching form submissions");
        dispatch({ type: "FETCH_REBATE_FORM_SUBMISSIONS_FAILURE" });
      });
  }, [apiUrl, dispatch]);

  if (rebateFormSubmissions.status === "pending") {
    return <p>Loading...</p>;
  }

  if (rebateFormSubmissions.status === "failure") {
    return <p>Error</p>;
  }

  return (
    <table className="usa-table usa-table--borderless usa-table--striped width-full">
      <thead>
        <tr>
          <th scope="col">UEI</th>
          <th scope="col">Entity Name</th>
          <th scope="col">Application Name</th>
          <th scope="col">Last Updated By</th>
          <th scope="col">Last Updated Date</th>
        </tr>
      </thead>
      <tbody>
        {rebateFormSubmissions.data.map((submission) => {
          const {
            _id,
            uei,
            entityName,
            applicationName,
            lastUpdatedBy,
            modified,
          } = submission;

          return (
            <tr key={_id}>
              <th scope="row">{uei}</th>
              <td>
                <Link to={`/rebate/${_id}`}>{entityName}</Link>
              </td>
              <td>{applicationName}</td>
              <td>{lastUpdatedBy}</td>
              <td>{modified}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
