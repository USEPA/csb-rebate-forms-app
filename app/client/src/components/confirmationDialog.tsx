import { useRef } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
// ---
import { useDialogState, useDialogActions } from "@/contexts/dialog";

export function ConfirmationDialog() {
  const {
    dialogShown,
    dismissable,
    heading,
    description,
    confirmText,
    dismissText,
    confirmedAction,
    dismissedAction,
  } = useDialogState();
  const { resetDialog } = useDialogActions();

  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Transition show={dialogShown}>
      <Dialog
        className={clsx("tw:relative tw:z-10")}
        initialFocus={cancelRef}
        open={dialogShown}
        onClose={(_ev) => {
          if (dismissable) {
            dismissedAction?.();
            resetDialog();
          }
        }}
      >
        <TransitionChild
          enter={clsx("tw:duration-300 tw:ease-out")}
          enterFrom={clsx("tw:opacity-0")}
          enterTo={clsx("tw:opacity-100")}
          leave={clsx("tw:duration-200 tw:ease-in")}
          leaveFrom={clsx("tw:opacity-100")}
          leaveTo={clsx("tw:opacity-0")}
        >
          <DialogBackdrop
            className={clsx(
              "tw:fixed tw:inset-0 tw:bg-black/70 tw:transition-colors",
            )}
          />
        </TransitionChild>

        <div className={clsx("tw:fixed tw:inset-0 tw:z-10 tw:overflow-y-auto")}>
          <div
            className={clsx(
              "tw:flex tw:min-h-full tw:items-end tw:justify-center tw:p-4",
              "tw:sm:items-center",
            )}
          >
            <TransitionChild
              enter={clsx("tw:duration-300 tw:ease-out")}
              enterFrom={clsx(
                "tw:translate-y-4 tw:opacity-0",
                "tw:sm:translate-y-0",
              )}
              enterTo={clsx("tw:translate-y-0 tw:opacity-100")}
              leave={clsx("tw:duration-200 tw:ease-in")}
              leaveFrom={clsx("tw:translate-y-0 tw:opacity-100")}
              leaveTo={clsx(
                "tw:translate-y-4 tw:opacity-0",
                "tw:sm:translate-y-0",
              )}
            >
              <DialogPanel
                className={clsx(
                  "tw:relative tw:transform tw:overflow-hidden tw:rounded-lg tw:bg-white tw:p-4 tw:shadow-xl tw:transition-all",
                  "tw:sm:w-full tw:sm:max-w-xl tw:sm:p-6",
                )}
              >
                {dismissable && (
                  <div className="twpf">
                    <div
                      className={clsx(
                        "tw:absolute tw:right-0 tw:top-0 tw:pr-4 tw:pt-4",
                      )}
                    >
                      <button
                        type="button"
                        className={clsx(
                          "tw:rounded-md tw:bg-white tw:text-gray-400 tw:transition-none",
                          "tw:hover:text-gray-700",
                          "tw:focus:text-gray-700",
                        )}
                        onClick={(_ev) => {
                          dismissedAction?.();
                          resetDialog();
                        }}
                      >
                        <span className={clsx("tw:sr-only")}>Close</span>
                        <XMarkIcon
                          className={clsx("tw:size-6 tw:transition-none")}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                )}

                <div className={clsx("tw:m-4")}>
                  <DialogTitle className={clsx("tw:text-xl")}>
                    {heading}
                  </DialogTitle>

                  <div className="usa-prose">{description}</div>

                  <div className={clsx("tw:mt-4")}>
                    <ul className="usa-button-group">
                      <li className={clsx("usa-button-group__item", "tw:!m-1")}>
                        <button
                          className="usa-button"
                          onClick={(_ev) => {
                            confirmedAction();
                            resetDialog();
                          }}
                        >
                          {confirmText}
                        </button>
                      </li>

                      {dismissable && dismissText && (
                        <li
                          className={clsx("usa-button-group__item", "tw:!m-1")}
                        >
                          <button
                            className="usa-button"
                            onClick={(_ev) => {
                              dismissedAction?.();
                              resetDialog();
                            }}
                            ref={cancelRef}
                          >
                            {dismissText}
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
