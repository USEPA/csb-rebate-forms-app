import { Link, Outlet } from "react-router-dom";
import { Formio } from "formiojs";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "../config";
import { useUserState } from "contexts/user";

Formio.use(uswds);

export default function Dashboard() {
  const { userData } = useUserState();

  return (
    <div>
      <h1>Clean School Bus Rebate Forms</h1>

      <div className="display-flex flex-justify border-bottom padding-bottom-1">
        <nav>
          <Link to="/" className="usa-button font-sans-2xs">
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#list`} />
              </svg>
              <span className="margin-left-1">All Rebates</span>
            </span>
          </Link>

          <Link to="/rebate/new" className="usa-button font-sans-2xs">
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#add_circle`} />
              </svg>
              <span className="margin-left-1">New Rebate</span>
            </span>
          </Link>
        </nav>

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
