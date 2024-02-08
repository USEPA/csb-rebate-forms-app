import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl } from "@/config";
import {
  type FormType,
  type FormioChange2023Submission,
  postData,
} from "@/utilities";
import { LoadingButtonIcon } from "@/components/loading";
import { useNotificationsActions } from "@/contexts/notifications";

export function New2023ChangeRequest(props: {
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

  const navigate = useNavigate();

  const { displayErrorNotification } = useNotificationsActions();

  /**
   * Stores when data is being posted to the server, so a loading indicator can
   * be rendered inside the "Change" button, and we can prevent double submits/
   * creations of new Change Request form submissions.
   */
  const [dataIsPosting, setDataIsPosting] = useState(false);

  return (
    <button
      className={clsx(
        "tw-border-0 tw-border-b-[1.5px] tw-border-transparent tw-p-0 tw-text-sm tw-leading-tight",
        "enabled:tw-cursor-pointer",
        "hover:enabled:tw-border-b-slate-800",
        "focus:enabled:tw-border-b-slate-800",
      )}
      type="button"
      disabled={disabled || !rebateId}
      onClick={(_ev) => {
        if (disabled || !rebateId) return;

        // account for when data is posting to prevent double submits
        if (dataIsPosting) return;
        setDataIsPosting(true);

        // create a new change request
        postData<FormioChange2023Submission>(
          `${serverUrl}/api/formio/2023/change/`,
          {
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
          },
        )
          .then((res) => {
            navigate(`/change/2023/${res._id}`);
          })
          .catch((_err) => {
            displayErrorNotification({
              id: Date.now(),
              body: (
                <>
                  <p
                    className={clsx(
                      "tw-text-sm tw-font-medium tw-text-gray-900",
                    )}
                  >
                    Error creating Change Request for{" "}
                    <em>
                      {formType.toUpperCase()} {rebateId}
                    </em>
                    .
                  </p>
                  <p className={clsx("tw-mt-1 tw-text-sm tw-text-gray-500")}>
                    Please try again.
                  </p>
                </>
              ),
            });
          })
          .finally(() => {
            setDataIsPosting(false);
          });
      }}
    >
      <span className={clsx("tw-flex tw-items-center")}>
        {dataIsPosting && <LoadingButtonIcon position="start" />}
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
  );
}
