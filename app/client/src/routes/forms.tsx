import { useEffect } from "react";
import { Link } from "react-router-dom";
// ---
import { useApiState, fetchData } from "contexts/api";
import { useUserState } from "contexts/user";
import { useFormsState, useFormsDispatch } from "contexts/forms";

export default function Forms() {
  const { apiUrl } = useApiState();
  const { samUserData } = useUserState();
  const { formSubmissions } = useFormsState();
  const dispatch = useFormsDispatch();

  useEffect(() => {
    if (samUserData.status !== "success") return;

    dispatch({ type: "FETCH_FORM_SCHEMA_REQUEST" });

    fetchData(`${apiUrl}/api/v1/form-schema`)
      .then((schemaRes) => {
        dispatch({
          type: "FETCH_FORM_SCHEMA_SUCCESS",
          payload: { formSchema: schemaRes },
        });
      })
      .catch((schemaErr) => {
        console.error("Error fetching form schema");
        dispatch({ type: "FETCH_FORM_SCHEMA_FAILURE" });
      });

    const ueis = samUserData.data.map((d) => d.uei);

    dispatch({ type: "FETCH_FORM_SUBMISSIONS_REQUEST" });

    fetchData(`${apiUrl}/api/v1/form-submissions`, { ueis })
      .then((submissionsRes) => {
        dispatch({
          type: "FETCH_FORM_SUBMISSIONS_SUCCESS",
          payload: { formSubmissions: submissionsRes },
        });
      })
      .catch((submissionsErr) => {
        console.error("Error fetching form submissions");
        dispatch({ type: "FETCH_FORM_SUBMISSIONS_FAILURE" });
      });
  }, [apiUrl, samUserData, dispatch]);

  if (samUserData.status !== "success") return null;
  if (formSubmissions.status !== "success") return null;

  return (
    <table className="usa-table usa-table--borderless usa-table--striped width-full">
      <thead>
        <tr>
          <th scope="col">UEI</th>
          <th scope="col">Name</th>
          <th scope="col">Placeholder</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {formSubmissions.data.map(({ uei, name }) => {
          return (
            <tr key={uei}>
              <th scope="row">
                <Link to={`/rebate/${uei}`}>{uei}</Link>
              </th>
              <td>{name}</td>
              <td>(placeholder)</td>
              <td>(status)</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
