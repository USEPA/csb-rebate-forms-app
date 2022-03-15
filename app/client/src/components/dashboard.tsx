import { Link, Outlet } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { useUserState, useUserDispatch } from "contexts/user";

function Dashboard() {
  const { epaData } = useUserState();
  const dispatch = useUserDispatch();

  const { email } = epaData;

  return (
    <div>
      <h1>Clean School Bus Data Collection System</h1>

      <div className="display-flex flex-justify border-bottom padding-bottom-1">
        <nav>
          <Link to="/" className="usa-button usa-button--outline">
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon margin-right-1"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#list`} />
              </svg>
              Dashboard
            </span>
          </Link>
        </nav>

        <nav className="display-flex flex-align-center">
          <p className="margin-bottom-0 margin-right-1">
            <span>{email}</span>
          </p>

          <button
            className="usa-button usa-button--outline margin-right-0"
            onClick={(ev) => {
              // TODO: placeholder...integrate with server app's SAML login
              dispatch({ type: "SIGN_OUT" });
            }}
          >
            Sign out
          </button>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}

export default Dashboard;
