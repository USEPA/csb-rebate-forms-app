import { Fragment } from "react";
import { Transition } from "@headlessui/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { XMarkIcon } from "@heroicons/react/20/solid";
// ---
import {
  useNotificationsState,
  useNotificationsActions,
} from "@/contexts/notifications";

export function Notifications() {
  const { displayed, type, body } = useNotificationsState();
  const { dismissNotification } = useNotificationsActions();

  return (
    <div className="twpf">
      <div
        aria-live="assertive"
        className="tw-pointer-events-none tw-fixed tw-inset-0 tw-z-20 tw-flex tw-items-end tw-p-4 sm:tw-items-start"
      >
        <div className="tw-flex tw-w-full tw-flex-col tw-items-center tw-space-y-4 sm:tw-items-end">
          <Transition
            show={displayed}
            as={Fragment}
            enter="tw-transform tw-transition tw-duration-300 tw-ease-out"
            enterFrom="tw-translate-y-2 tw-opacity-0 sm:tw-translate-y-0 sm:tw-translate-x-2"
            enterTo="tw-translate-y-0 tw-opacity-100 sm:tw-translate-x-0"
            leave="tw-transition tw-duration-100 tw-ease-in"
            leaveFrom="tw-opacity-100"
            leaveTo="tw-opacity-0"
          >
            <div className="tw-pointer-events-auto tw-w-full tw-max-w-sm tw-overflow-hidden tw-rounded-lg tw-bg-white tw-shadow-xl tw-ring-1 tw-ring-black/10">
              <div className="tw-p-4">
                <div className="tw-flex tw-items-start">
                  <div className="tw-flex-shrink-0">
                    {type === "info" ? (
                      <InformationCircleIcon
                        className="tw-h-6 tw-w-6 tw-text-blue-400"
                        aria-hidden="true"
                      />
                    ) : type === "success" ? (
                      <CheckCircleIcon
                        className="tw-h-6 tw-w-6 tw-text-green-400"
                        aria-hidden="true"
                      />
                    ) : type === "warning" ? (
                      <ExclamationTriangleIcon
                        className="tw-h-6 tw-w-6 tw-text-yellow-400"
                        aria-hidden="true"
                      />
                    ) : type === "error" ? (
                      <XCircleIcon
                        className="tw-h-6 tw-w-6 tw-text-red-400"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>

                  <div className="tw-mx-3 tw-w-0 tw-flex-1 tw-pt-0.5">
                    {body}
                  </div>

                  <div className="tw-flex-shrink-0">
                    <button
                      type="button"
                      className="tw-inline-flex tw-rounded-md tw-bg-white tw-text-gray-400 tw-transition-none hover:tw-text-gray-700 focus:tw-text-gray-700"
                      onClick={() => dismissNotification({ id: 0 })}
                    >
                      <span className="tw-sr-only">Close</span>
                      <XMarkIcon
                        className="tw-h-5 tw-w-5 tw-transition-none"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  );
}
