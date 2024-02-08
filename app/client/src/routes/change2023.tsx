import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Dialog } from "@headlessui/react";
import { Form } from "@formio/react";
import clsx from "clsx";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages } from "@/config";
import {
  type FormioChange2023Submission,
  getData,
  postData,
  useContentData,
} from "@/utilities";
import { Loading } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";
import { useNotificationsActions } from "@/contexts/notifications";

type ServerResponse =
  | {
      userAccess: false;
      formSchema: null;
      submission: null;
    }
  | {
      userAccess: true;
      formSchema: { url: string; json: object };
      submission: FormioChange2023Submission;
    };

/** Custom hook to fetch Formio submission data */
function useFormioSubmissionQueryAndMutation(mongoId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["formio/2023/change"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio/2023/change/${mongoId}`;

  const query = useQuery({
    queryKey: ["formio/2023/change", { id: mongoId }],
    queryFn: () => getData<ServerResponse>(url),
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (updatedSubmission: {
      data: { [field: string]: unknown };
      metadata: { [field: string]: unknown };
      state: "submitted";
    }) => {
      return postData<FormioChange2023Submission>(url, updatedSubmission);
    },
    onSuccess: (res) => {
      return queryClient.setQueryData<ServerResponse>(
        ["formio/2023/change", { id: mongoId }],
        (prevData) => {
          return prevData?.submission
            ? { ...prevData, submission: res }
            : prevData;
        },
      );
    },
  });

  return { query, mutation };
}

export function Change2023() {
  const navigate = useNavigate();
  const { id: mongoId } = useParams<"id">(); // MongoDB ObjectId string

  const content = useContentData();
  const {
    displaySuccessNotification,
    displayErrorNotification,
    dismissNotification,
  } = useNotificationsActions();

  const { query, mutation } = useFormioSubmissionQueryAndMutation(mongoId);
  const { userAccess, formSchema, submission } = query.data ?? {};

  /**
   * Stores when data is being posted to the server, so a loading overlay can
   * be rendered over the form, preventing the user from losing input data when
   * the form is re-rendered with data returned from the server's successful
   * post response.
   */
  const dataIsPosting = useRef(false);

  /**
   * Stores when the form is being submitted, so it can be referenced in the
   * Form component's `onSubmit` event prop to prevent double submits.
   */
  const formIsBeingSubmitted = useRef(false);

  if (query.isInitialLoading) {
    return <Loading />;
  }

  if (query.isError || !userAccess || !formSchema || !submission) {
    return <Message type="error" text={messages.formSubmissionError} />;
  }

  const formIsReadOnly = submission.state === "submitted";

  return (
    <div className="margin-top-2">
      {content && (
        <MarkdownContent
          className="margin-top-4"
          children={content.changeRequestIntro}
        />
      )}

      <ul className="usa-icon-list">
        <li className="usa-icon-list__item">
          <div className="usa-icon-list__icon text-primary">
            <svg className="usa-icon" aria-hidden="true" role="img">
              <use href={`${icons}#local_offer`} />
            </svg>
          </div>
          <div className="usa-icon-list__content">
            <strong>Change Request ID:</strong> {submission._id}
          </div>
        </li>

        <li className="usa-icon-list__item">
          <div className="usa-icon-list__icon text-primary">
            <svg className="usa-icon" aria-hidden="true" role="img">
              <use href={`${icons}#local_offer`} />
            </svg>
          </div>
          <div className="usa-icon-list__content">
            <strong>Rebate ID:</strong> {submission.data._bap_rebate_id}
          </div>
        </li>
      </ul>

      <Dialog as="div" open={dataIsPosting.current} onClose={(_value) => {}}>
        <div className={clsx("tw-fixed tw-inset-0 tw-bg-black/30")} />
        <div className={clsx("tw-fixed tw-inset-0 tw-z-20")}>
          <div
            className={clsx(
              "tw-flex tw-min-h-full tw-items-center tw-justify-center",
            )}
          >
            <Dialog.Panel
              className={clsx(
                "tw-rounded-lg tw-bg-white tw-px-4 tw-pb-4 tw-shadow-xl",
              )}
            >
              <Loading />
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>

      <div className="csb-form">
        <Form
          form={formSchema.json}
          url={formSchema.url} // NOTE: used for file uploads
          submission={{
            data: { ...submission.data },
          }}
          options={{
            readOnly: formIsReadOnly,
            noAlerts: true,
          }}
          onSubmit={(onSubmitSubmission: {
            data: { [field: string]: unknown };
            metadata: { [field: string]: unknown };
            state: "submitted";
          }) => {
            if (formIsReadOnly) return;

            // account for when form is being submitted to prevent double submits
            if (formIsBeingSubmitted.current) return;
            formIsBeingSubmitted.current = true;

            const data = { ...onSubmitSubmission.data };

            const updatedSubmission = {
              ...onSubmitSubmission,
              data,
            };

            dismissNotification({ id: 0 });
            dataIsPosting.current = true;

            mutation.mutate(updatedSubmission, {
              onSuccess: (_res, _payload, _context) => {
                /** success notification id */
                const id = Date.now();

                displaySuccessNotification({
                  id,
                  body: (
                    <p
                      className={clsx(
                        "tw-text-sm tw-font-medium tw-text-gray-900",
                      )}
                    >
                      Change Request <em>{mongoId}</em> submitted successfully.
                    </p>
                  ),
                });

                /**
                 * NOTE: we'll keep the success notification displayed and
                 * redirect the user to their dashboard
                 */
                navigate("/");
              },
              onError: (_error, _payload, _context) => {
                displayErrorNotification({
                  id: Date.now(),
                  body: (
                    <p
                      className={clsx(
                        "tw-text-sm tw-font-medium tw-text-gray-900",
                      )}
                    >
                      Error submitting Change Request form.
                    </p>
                  ),
                });
              },
              onSettled: (_data, _error, _payload, _context) => {
                dataIsPosting.current = false;
                formIsBeingSubmitted.current = false;
              },
            });
          }}
        />
      </div>
    </div>
  );
}
