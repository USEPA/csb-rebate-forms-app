import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "../config";
import Message from "components/message";

type MessageState = {
  displayed: boolean;
  type: "error" | "info" | "success" | "warning";
  text: string;
};

type LocationState = {
  redirectedFrom: string;
};

export default function Welcome() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [message, setMessage] = useState<MessageState>({
    displayed: false,
    type: "info",
    text: "",
  });

  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setMessage({
        displayed: true,
        type: "error",
        text: "Authentication error. Please log in again or contact support.",
      });
    }

    if (searchParams.get("error") === "saml") {
      setMessage({
        displayed: true,
        type: "error",
        text: "Error logging in. Please try again or contact support.",
      });
    }

    if (searchParams.get("error") === "sam-fetch") {
      setMessage({
        displayed: true,
        type: "error",
        text: "Error retrieving SAM.gov data. Please contact support.",
      });
    }

    if (searchParams.get("info") === "sam-results") {
      setMessage({
        displayed: true,
        type: "info",
        text: "No SAM.gov records found. Please refer to the help documentation to add data to SAM.gov.",
      });
    }

    if (searchParams.get("info") === "timeout") {
      setMessage({
        displayed: true,
        type: "info",
        text: "For security reasons, you have been logged out due to 15 minutes of inactivity.",
      });
    }

    if (searchParams.get("success") === "logout") {
      setMessage({
        displayed: true,
        type: "success",
        text: "You have succesfully logged out.",
      });
    }

    setSearchParams("");
  }, [searchParams, setSearchParams]);

  // page user was previously on before they were redirected to "/welcome"
  const destination = (location.state as LocationState)?.redirectedFrom || "/";

  // TODO: append the destination url to the login link's href as a query string
  // param, so it could be used in the server app's /login controller
  // (change the `successRedirect` value of '/' to the destination url)
  console.log("previous url", destination);

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
    </>
  );
}
