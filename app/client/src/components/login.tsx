import icons from "uswds/img/sprite.svg";
// ---
import { useUserDispatch } from "contexts/user";

function Login() {
  const dispatch = useUserDispatch();

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <button
          className="usa-button font-sans-2xs"
          onClick={(ev) => {
            // TODO: placeholder...
            // integrate with server app's SAML login and BAP API call
            setTimeout(() => {
              dispatch({ type: "SIGN_IN" });
              dispatch({
                type: "SET_USER_DATA",
                payload: {
                  epaData: {
                    firstName: "George",
                    lastName: "Washington",
                    email: "george.washington@epa.gov",
                  },
                },
              });
              dispatch({
                type: "SET_SAM_DATA",
                payload: {
                  samData: [
                    { uid: "056143447853" },
                    { uid: "779442964145" },
                    { uid: "960885252143" },
                    { uid: "549203627426" },
                    { uid: "569160091719" },
                  ],
                },
              });
            }, 300);
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

export default Login;
