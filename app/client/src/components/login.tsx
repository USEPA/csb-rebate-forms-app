import { useLocation, useNavigate } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { useApiState, fetchData } from "contexts/api";
import { useUserDispatch } from "contexts/user";

type LocationState = {
  redirectedFrom: string;
};

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const { apiUrl } = useApiState();
  const dispatch = useUserDispatch();

  // page user was previously on before they were redirected to "/login"
  const destination = (location.state as LocationState).redirectedFrom || "/";

  return (
    <div className="padding-9 text-center bg-base-lightest">
      <button
        className="usa-button margin-0 font-sans-2xs"
        onClick={(ev) => {
          dispatch({ type: "FETCH_EPA_USER_DATA_REQUEST" });

          fetchData(`${apiUrl}/api/v1/login`)
            .then((loginRes) => {
              dispatch({
                type: "FETCH_EPA_USER_DATA_SUCCESS",
                payload: { epaUserData: loginRes },
              });

              dispatch({ type: "USER_SIGN_IN" });

              // NOTE: { replace: true } passed so an entry for "/login"
              // isn't added to the history stack, so the user can click
              // the back button and not go back to this login page
              navigate(destination, { replace: true });
            })
            .catch((loginErr) => {
              console.error("Error fetching EPA user data");
              dispatch({ type: "FETCH_EPA_USER_DATA_FAILURE" });
            });
        }}
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
      </button>
    </div>
  );
}
