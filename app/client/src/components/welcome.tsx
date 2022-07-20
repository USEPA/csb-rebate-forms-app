import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, serverUrlForLinks, fetchData, messages } from "../config";
import Message from "components/message";
import { useUserState, useUserDispatch } from "contexts/user";

export default function Welcome() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [message, setMessage] = useState<{
    displayed: boolean;
    type: "info" | "success" | "warning" | "error";
    text: string;
  }>({
    displayed: false,
    type: "info",
    text: "",
  });

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setMessage({
        displayed: true,
        type: "error",
        text: messages.authError,
      });
    }

    if (searchParams.get("error") === "saml") {
      setMessage({
        displayed: true,
        type: "error",
        text: messages.samlError,
      });
    }

    if (searchParams.get("error") === "sam-fetch") {
      setMessage({
        displayed: true,
        type: "error",
        text: messages.samFetchError,
      });
    }

    if (searchParams.get("info") === "sam-results") {
      setMessage({
        displayed: true,
        type: "info",
        text: messages.samNoResults,
      });
    }

    if (searchParams.get("info") === "timeout") {
      setMessage({
        displayed: true,
        type: "info",
        text: messages.timeout,
      });
    }

    if (searchParams.get("success") === "logout") {
      setMessage({
        displayed: true,
        type: "success",
        text: messages.logout,
      });
    }

    setSearchParams("");
  }, [searchParams, setSearchParams]);

  const { isAuthenticated } = useUserState();
  const dispatch = useUserDispatch();

  useEffect(() => {
    fetchData(`${serverUrl}/api/epa-data`)
      .then((res) => dispatch({ type: "USER_SIGN_IN" }))
      .catch((err) => dispatch({ type: "USER_SIGN_OUT" }));
  }, [dispatch]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <h1>Clean School Bus Rebate Forms: Applicant Login</h1>

      {message.displayed && <Message type={message.type} text={message.text} />}

      <div className="padding-9 border-1px border-base-lighter text-center bg-base-lightest">
        <p>
          Click the <strong>Sign in</strong> button below to login to the{" "}
          <em>Clean School Bus Rebate Dashboard</em> using Login.gov.
        </p>

        <a
          className="usa-button margin-top-1 margin-right-0 font-sans-2xs"
          href={`${serverUrlForLinks}/login`}
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
    </>
  );
}
