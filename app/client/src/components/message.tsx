import { useState } from "react";

type Props = {
  type: "info" | "success" | "warning" | "error";
  text: string;
};

export default function Message({ type, text }: Props) {
  return (
    <div className={`usa-alert usa-alert--${type}`} role="alert">
      <div className="usa-alert__body">
        <p className="usa-alert__text">{text}</p>
      </div>
    </div>
  );
}

export type MessageState = {
  displayed: boolean;
  type: "info" | "success" | "warning" | "error";
  text: string;
};

/**
 * Custom hook that can be used with `<Message />` component to display
 * different USWDS message types.
 */
export function useMessageState() {
  const [message, setMessage] = useState<MessageState>({
    displayed: false,
    type: "info",
    text: "",
  });

  function displayInfoMessage(text: string) {
    setMessage({ displayed: true, type: "info", text });
  }

  function displaySuccessMessage(text: string) {
    setMessage({ displayed: true, type: "success", text });
  }

  function displayWarningMessage(text: string) {
    setMessage({ displayed: true, type: "warning", text });
  }

  function displayErrorMessage(text: string) {
    setMessage({ displayed: true, type: "error", text });
  }

  function resetMessage() {
    setMessage({ displayed: false, type: "info", text: "" });
  }

  return {
    message,
    displayInfoMessage,
    displaySuccessMessage,
    displayWarningMessage,
    displayErrorMessage,
    resetMessage,
  };
}
