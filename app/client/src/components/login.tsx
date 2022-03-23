import { useLocation } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "../index";

type LocationState = {
  redirectedFrom: string;
};

export default function Login() {
  const location = useLocation();

  // page user was previously on before they were redirected to "/login"
  const destination = (location.state as LocationState).redirectedFrom || "/";

  // TODO: append the destination url to the login link's href as a query string
  // param, so it could be used in the server app's /login controller
  // (change the `successRedirect` value of '/' to the destination url)
  console.log("previous url", destination);

  return (
    <div className="padding-9 text-center bg-base-lightest">
      <a
        className="usa-button margin-0 font-sans-2xs"
        href={`${serverUrl}/login`}
      >
        <span className="display-flex flex-align-center">
          <span className="margin-right-1">Sign in</span>
          <svg
            className="usa-icon"
            aria-hidden="true"
            focusable="false"
            role="img"
          >
            <use href={`${icons}#login`} />
          </svg>
        </span>
      </a>
    </div>
  );
}
