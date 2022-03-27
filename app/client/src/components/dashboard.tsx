import { Link, Outlet, useLocation } from "react-router-dom";
import { Formio } from "formiojs";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "../config";
import { useUserState } from "contexts/user";

Formio.use(uswds);

function AllRebatesText() {
  return (
    <span className="display-flex flex-align-center">
      <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
        <use href={`${icons}#list`} />
      </svg>
      <span className="margin-left-1">All Rebates</span>
    </span>
  );
}

function NewRebateText() {
  return (
    <span className="display-flex flex-align-center">
      <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
        <use href={`${icons}#add_circle`} />
      </svg>
      <span className="margin-left-1">New Rebate</span>
    </span>
  );
}

export default function Dashboard() {
  const { pathname } = useLocation();
  const { userData } = useUserState();

  return (
    <div>
      <h1>Clean School Bus Rebate Forms</h1>

      <div className="display-flex flex-justify border-bottom padding-bottom-1">
        {pathname === "/" ? (
          <nav>
            <button className="usa-button font-sans-2xs" disabled>
              <AllRebatesText />
            </button>

            <Link to="/rebate/new" className="usa-button font-sans-2xs">
              <NewRebateText />
            </Link>
          </nav>
        ) : (
          <nav>
            <Link to="/" className="usa-button font-sans-2xs">
              <AllRebatesText />
            </Link>

            <button className="usa-button font-sans-2xs" disabled>
              <NewRebateText />
            </button>
          </nav>
        )}

        <nav className="display-flex flex-align-center">
          <p className="margin-bottom-0 margin-right-1">
            <span>
              {userData.status === "success" && userData.data.epaUserData.mail}
            </span>
          </p>

          <a
            className="usa-button font-sans-2xs margin-right-0"
            href={`${serverUrl}/logout`}
          >
            <span className="display-flex flex-align-center">
              <span className="margin-right-1">Sign out</span>
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#logout`} />
              </svg>
            </span>
          </a>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
