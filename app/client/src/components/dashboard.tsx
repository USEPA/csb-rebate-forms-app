import { Link, Outlet } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { useApiState, fetchData } from "contexts/api";
import { useUserState, useUserDispatch } from "contexts/user";

export default function Dashboard() {
  const { apiUrl } = useApiState();
  const { epaUserData } = useUserState();
  const dispatch = useUserDispatch();

  if (epaUserData.status !== "success") return null;

  return (
    <div>
      <h1>Clean School Bus Data Collection System</h1>

      <div className="display-flex flex-justify border-bottom padding-bottom-1">
        <nav>
          <Link to="/" className="usa-button usa-button--outline font-sans-2xs">
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#list`} />
              </svg>
              <span className="margin-left-1">Dashboard</span>
            </span>
          </Link>
        </nav>

        <nav className="display-flex flex-align-center">
          <p className="margin-bottom-0 margin-right-1">
            <span>{epaUserData.data.email}</span>
          </p>

          <button
            className="usa-button usa-button--outline font-sans-2xs margin-right-0"
            onClick={(ev) => {
              fetchData(`${apiUrl}/api/v1/logout`)
                .then((logoutRes) => {
                  dispatch({ type: "USER_SIGN_OUT" });
                })
                .catch((logoutErr) => {
                  console.error("Error logging user out");
                });
            }}
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
          </button>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
