import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import icons from "@uswds/uswds/img/sprite.svg";
// ---
import { serverUrl, messages } from "@/config";
import { usePublicConfigData } from "@/utilities";
import { Loading } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";

export function Welcome() {
  const [searchParams, setSearchParams] = useSearchParams();

  const publicConfigData = usePublicConfigData();
  const { loginEnabled, staticContent } = publicConfigData || {};

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

    if (searchParams.get("error") === "bap-sam-fetch") {
      setMessage({
        displayed: true,
        type: "error",
        text: messages.bapSamFetchError,
      });
    }

    if (searchParams.get("info") === "bap-sam-results") {
      setMessage({
        displayed: true,
        type: "info",
        text: messages.bapNoSamResults,
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

  if (!staticContent) {
    return <Loading />;
  }

  return (
    <>
      <h1>Clean School Bus Rebate Forms: Applicant Login</h1>

      {message.displayed && <Message type={message.type} text={message.text} />}

      {!loginEnabled ? (
        <div className="margin-top-4">
          {/**
           * NOTE: The markup below is from the `Message` component. We can't
           * use it directly because it renders the `text` prop as a string
           * within a paragraph element. The `MarkdownContent` component (which
           * we use to include the scheduled maintenance message text) will
           * render at least a paragraph element itself, which would result in
           * invalid HTML due to the nested paragraphs (`<p><p>...</p></p>`).
           */}
          <div className="usa-alert usa-alert--info" role="alert">
            <div className="usa-alert__body">
              <MarkdownContent
                children={staticContent.scheduledMaintenance}
                components={{
                  p: (props) => <p className="usa-alert__text">{props.children}</p>, // prettier-ignore
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="padding-9 border-1px border-base-lighter bg-base-lightest text-center">
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
      )}
    </>
  );
}
