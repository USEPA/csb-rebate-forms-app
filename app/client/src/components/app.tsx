import { Link, Outlet } from "react-router-dom";
// ---
import "uswds/css/uswds.css";
import "uswds/js/uswds.js";
import icons from "uswds/img/sprite.svg";

function App() {
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
              Forms
            </span>
          </Link>
        </nav>

        <nav>
          <Link
            to="/profile"
            className="usa-button usa-button--outline margin-right-0"
          >
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon margin-right-1"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#account_circle`} />
              </svg>
              Profile
            </span>
          </Link>
        </nav>
      </div>

      <Outlet />
    </div>
  );
}

export default App;
