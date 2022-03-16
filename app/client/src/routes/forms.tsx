import { Link } from "react-router-dom";
// ---
import { useUserState } from "contexts/user";

export default function Forms() {
  const { samUserData } = useUserState();

  if (samUserData.status !== "success") return null;

  return (
    <table className="usa-table usa-table--borderless usa-table--striped width-full">
      <thead>
        <tr>
          <th scope="col">UEI</th>
          <th scope="col">Placeholder</th>
          <th scope="col">Placeholder</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {samUserData.fields.map(({ uei }) => {
          return (
            <tr key={uei}>
              <th scope="row">
                <Link to={`/rebate/${uei}`}>{uei}</Link>
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
