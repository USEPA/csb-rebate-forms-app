import { Fragment } from "react";
import { Link, Outlet } from "react-router-dom";
// ---
import { getRebates } from "../data";

function Rebates() {
  const rebates = getRebates();

  return (
    <Fragment>
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
                  <Link to={`/rebates/${id}`}>{id}</Link>
                </th>
                <td>{name}</td>
                <td>(status)</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Outlet />
    </Fragment>
  );
}

export default Rebates;
