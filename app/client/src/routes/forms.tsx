import { useEffect } from "react";
import { Link } from "react-router-dom";
// ---
import { useUserState } from "contexts/user";

function Forms() {
  const { samData } = useUserState();

  useEffect(() => {
    // TODO: fetch formio form schema and submissions
  }, []);

  return (
    <table className="usa-table usa-table--borderless usa-table--striped width-full">
      <thead>
        <tr>
          <th scope="col">UID</th>
          <th scope="col">Placeholder</th>
          <th scope="col">Placeholder</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {samData.map(({ uid }) => {
          return (
            <tr key={uid}>
              <th scope="row">
                <Link to={`/rebate/${uid}`}>{uid}</Link>
              </th>
              <td>(placeholder)</td>
              <td>(placeholder)</td>
              <td>(status)</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default Forms;
