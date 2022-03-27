import { Link, Outlet, useLocation } from "react-router-dom";
import { Formio } from "formiojs";
import uswds from "@formio/uswds";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "../config";
import { useUserState } from "contexts/user";

Formio.use(uswds);

type IconTextProps = {
  order: "icon-text" | "text-icon";
  icon: string;
  text: string;
};

function IconText({ order, icon, text }: IconTextProps) {
  const Icon = (
    <svg className="usa-icon" aria-hidden="true" focusable="false" role="img">
      <use href={`${icons}#${icon}`} />
    </svg>
  );

  const Text = (
    <span className={`margin-${order === "icon-text" ? "left" : "right"}-1`}>
      {text}
    </span>
  );

  return (
    <span className="display-flex flex-align-center">
      {order === "icon-text" ? [Icon, Text] : [Text, Icon]}
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
              <IconText order="icon-text" icon="list" text="All Rebates" />
            </button>

            <Link to="/rebate/new" className="usa-button font-sans-2xs">
              <IconText order="icon-text" icon="add_circle" text="New Rebate" />
            </Link>
          </nav>
        ) : (
          <nav>
            <Link to="/" className="usa-button font-sans-2xs">
              <IconText order="icon-text" icon="list" text="All Rebates" />
            </Link>

            <button className="usa-button font-sans-2xs" disabled>
              <IconText order="icon-text" icon="add_circle" text="New Rebate" />
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
            <IconText order="text-icon" icon="logout" text="Sign out" />
          </a>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
