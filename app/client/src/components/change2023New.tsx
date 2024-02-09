import { type Dispatch, type SetStateAction, Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "@/config";
import {
  type FormType,
  type FormioChange2023Submission,
  postData,
} from "@/utilities";
import { useNotificationsActions } from "@/contexts/notifications";

export function ChangeRequest2023Button(props: {
  disabled: boolean;
  data: {
    formType: FormType;
    comboKey: string;
    mongoId: string;
    rebateId: string | null;
    email: string;
    title: string;
    name: string;
  };
}) {
  const { disabled, data } = props;
  const { formType, comboKey, mongoId, rebateId, email, title, name } = data;

  const [dialogShown, setDialogShown] = useState(false);

  return (
    <>
      <button
        className={clsx(
          "tw-border-0 tw-border-b-[1.5px] tw-border-transparent tw-p-0 tw-text-sm tw-leading-tight",
          "enabled:tw-cursor-pointer",
          "hover:enabled:tw-border-b-slate-800",
          "focus:enabled:tw-border-b-slate-800",
        )}
        type="button"
        disabled={disabled}
        onClick={(_ev) => {
          if (disabled) return;
          setDialogShown(true);

          console.log({
            data: {
              _request_form: formType,
              _bap_entity_combo_key: comboKey,
              _bap_rebate_id: rebateId,
              _mongo_id: mongoId,
              _user_email: email,
              _user_title: title,
              _user_name: name,
            },
            state: "draft",
          });
        }}
      >
        <span className={clsx("tw-flex tw-items-center")}>
          <span className={clsx("tw-mr-1")}>Change</span>
          <svg
            className="usa-icon"
            aria-hidden="true"
            focusable="false"
            role="img"
          >
            <use href={`${icons}#launch`} />
          </svg>
        </span>
      </button>

      <ChangeRequest2023Dialog
        dialogShown={dialogShown}
        setDialogShown={setDialogShown}
      />
    </>
  );
}

function ChangeRequest2023Dialog(props: {
  dialogShown: boolean;
  setDialogShown: Dispatch<SetStateAction<boolean>>;
}) {
  const { dialogShown, setDialogShown } = props;

  return (
    <Transition.Root show={dialogShown} as={Fragment}>
      <Dialog
        as="div"
        className={clsx("tw-relative tw-z-10")}
        open={dialogShown}
        onClose={(_value) => setDialogShown(false)}
      >
        <Transition.Child
          as={Fragment}
          enter={clsx("tw-duration-300 tw-ease-out")}
          enterFrom={clsx("tw-opacity-0")}
          enterTo={clsx("tw-opacity-100")}
          leave={clsx("tw-duration-200 tw-ease-in")}
          leaveFrom={clsx("tw-opacity-100")}
          leaveTo={clsx("tw-opacity-0")}
        >
          <div
            className={clsx(
              "tw-fixed tw-inset-0 tw-bg-black/70 tw-transition-colors",
            )}
          />
        </Transition.Child>

        <div className={clsx("tw-fixed tw-inset-0 tw-z-10 tw-overflow-y-auto")}>
          <div
            className={clsx(
              "tw-flex tw-min-h-full tw-items-center tw-justify-center tw-p-4",
            )}
          >
            <Transition.Child
              as={Fragment}
              enter={clsx("tw-duration-300 tw-ease-out")}
              enterFrom={clsx("tw-translate-y-0 tw-opacity-0")}
              enterTo={clsx("tw-translate-y-0 tw-opacity-100")}
              leave={clsx("tw-duration-200 tw-ease-in")}
              leaveFrom={clsx("tw-translate-y-0 tw-opacity-100")}
              leaveTo={clsx("tw-translate-y-0 tw-opacity-0")}
            >
              <Dialog.Panel
                className={clsx(
                  "tw-relative tw-transform tw-overflow-hidden tw-rounded-lg tw-bg-white tw-p-4 tw-shadow-xl tw-transition-all",
                  "sm:tw-w-full sm:tw-max-w-7xl sm:tw-p-6",
                )}
              >
                <div className="twpf">
                  <div
                    className={clsx(
                      "tw-absolute tw-right-0 tw-top-0 tw-pr-4 tw-pt-4",
                    )}
                  >
                    <button
                      className={clsx(
                        "tw-rounded-md tw-bg-white tw-text-gray-400 tw-transition-none",
                        "hover:tw-text-gray-700",
                        "focus:tw-text-gray-700",
                      )}
                      type="button"
                      onClick={(_ev) => setDialogShown(false)}
                    >
                      <span className={clsx("tw-sr-only")}>Close</span>
                      <XMarkIcon
                        className={clsx("tw-h-6 tw-w-6 tw-transition-none")}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                <div className={clsx("tw-m-auto tw-max-w-6xl tw-p-4")}>
                  <ChangeRequest2023Form />
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}

function ChangeRequest2023Form() {
  return (
    <>
      <p>Change Request Form!</p>
    </>
  );
}
