import icons from "uswds/img/sprite.svg";
// ---
import { useApiState, fetchData } from "contexts/api";
import { useUserDispatch } from "contexts/user";

export default function Login() {
  const { apiUrl } = useApiState();
  const dispatch = useUserDispatch();

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <button
          className="usa-button font-sans-2xs"
          onClick={(ev) => {
            dispatch({ type: "FETCH_EPA_USER_DATA_REQUEST" });

            fetchData(`${apiUrl}/api/v1/login`)
              .then((loginRes) => {
                dispatch({
                  type: "FETCH_EPA_USER_DATA_SUCCESS",
                  payload: { epaUserData: loginRes },
                });

                dispatch({ type: "FETCH_SAM_USER_DATA_REQUEST" });

                fetchData(`${apiUrl}/api/v1/bap`)
                  .then((bapRes) => {
                    dispatch({
                      type: "FETCH_SAM_USER_DATA_SUCCESS",
                      payload: { samUserData: bapRes },
                    });

                    dispatch({ type: "USER_SIGN_IN" });
                  })
                  .catch((bapErr) => {
                    console.error("Error fetching SAM user data");
                    dispatch({ type: "FETCH_SAM_USER_DATA_FAILURE" });
                  });
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
    </div>
  );
}
