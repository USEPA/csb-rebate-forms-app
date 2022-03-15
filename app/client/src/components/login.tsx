import { useUserDispatch } from "contexts/user";

function Login() {
  const dispatch = useUserDispatch();

  return (
    <div>
      <button
        className="usa-button"
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
        Sign in
      </button>
    </div>
  );
}

export default Login;
