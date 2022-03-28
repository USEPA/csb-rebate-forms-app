import { useRef } from "react";
import {
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogLabel,
  AlertDialogDescription,
} from "@reach/alert-dialog";
import icons from "uswds/img/sprite.svg";
// ---
import { useDialogState, useDialogDispatch } from "contexts/dialog";

export default function ConfirmationDialog() {
  const {
    dialogShown,
    heading,
    description,
    confirmText,
    cancelText,
    confirmedAction,
  } = useDialogState();
  const dispatch = useDialogDispatch();

  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialogOverlay
      isOpen={dialogShown}
      onDismiss={(ev) => dispatch({ type: "RESET_DIALOG" })}
      leastDestructiveRef={cancelRef}
    >
      <AlertDialogContent className="usa-modal">
        <div className="usa-modal__content">
          <div className="usa-modal__main">
            <AlertDialogLabel>
              <h2 className="usa-modal__heading">{heading}</h2>
            </AlertDialogLabel>

            <AlertDialogDescription>
              <div className="usa-prose">
                <p>{description}</p>
              </div>
            </AlertDialogDescription>

            <div className="usa-modal__footer">
              <ul className="usa-button-group">
                <li className="usa-button-group__item">
                  <button
                    className="usa-button"
                    onClick={(ev) => {
                      confirmedAction();
                      dispatch({ type: "RESET_DIALOG" });
                    }}
                  >
                    {confirmText}
                  </button>
                </li>

                <li className="usa-button-group__item">
                  <button
                    ref={cancelRef}
                    className="usa-button"
                    onClick={(ev) => dispatch({ type: "RESET_DIALOG" })}
                  >
                    {cancelText}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <button
            className="usa-button usa-modal__close"
            aria-label="Close this window"
            onClick={(ev) => dispatch({ type: "RESET_DIALOG" })}
          >
            <svg
              className="usa-icon"
              aria-hidden="true"
              focusable="false"
              role="img"
            >
              <use href={`${icons}#close`} />
            </svg>
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogOverlay>
  );
}
