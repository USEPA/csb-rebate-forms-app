import { Link, Outlet } from 'react-router-dom';
// ---
import 'uswds/css/uswds.css';
import 'uswds/js/uswds.js';
import icons from 'uswds/img/sprite.svg';

function App() {
  return (
    <div>
      <h1>Clean School Bus Data Collection System</h1>

      <div className="display-flex flex-justify border-bottom padding-bottom-1">
        <nav>
          <Link to="/rebates">Rebates</Link>
        </nav>

        <nav>
          <Link to="/profile" className="usa-button">
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon margin-right-1"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#account_circle`}></use>
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
