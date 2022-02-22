import { Link } from "react-router-dom";
// ---
import { getRebates } from "../data";

function Forms() {
  const rebates = getRebates();

  return (
    <table className="usa-table usa-table--borderless usa-table--striped width-full">
      <thead>
        <tr>
          <th scope="col">ID</th>
          <th scope="col">Name</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rebates.map(({ id, name }) => {
          return (
            <tr key={id}>
              <th scope="row">
                <Link to={`/rebate/${id}`}>{id}</Link>
              </th>
              <td>{name}</td>
              <td>(status)</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default Forms;
