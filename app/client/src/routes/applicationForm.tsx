import { useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Formio, Form } from "@formio/react";
import { cloneDeep, isEqual } from "lodash";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, messages, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import {
  submissionNeedsEdits,
  useFetchedFormSubmissions,
  useCombinedSubmissions,
  useSortedRebates,
} from "routes/allRebates";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { useContentState } from "contexts/content";
import { useDialogDispatch } from "contexts/dialog";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import { useBapState } from "contexts/bap";
import { useFormioSubmissionsState } from "contexts/formioSubmissions";
import { useNotificationsDispatch } from "contexts/notifications";

type FormioSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  modified: string; // ISO 8601 date string
  metadata: { [field: string]: unknown };
  data: { [field: string]: unknown };
  state: "submitted" | "draft";
};

type ServerResponse =
  | { userAccess: false; formSchema: null; submission: null }
  | { userAccess: true; formSchema: { url: string; json: object }; submission: FormioSubmission }; // prettier-ignore

export function ApplicationForm() {
  const { epaUserData } = useUserState();
  const email = epaUserData.status !== "success" ? "" : epaUserData.data.mail;

  /**
   * NOTE: The child component only uses the email from the `user` context, but
   * the `epaUserData.data` object includes an `exp` field that changes whenever
   * the JWT is refreshed. Since the user verification process `verifyUser()`
   * gets called from the parent `ProtectedRoute` component, we need to memoize
   * the email address (which won't change) to prevent the child component from
   * needlessly re-rendering.
   */
  return useMemo(() => {
    return <ApplicationFormContent email={email} />;
  }, [email]);
}

function ApplicationFormContent({ email }: { email: string }) {
  const navigate = useNavigate();
  const { mongoId } = useParams<"mongoId">(); // MongoDB ObjectId string
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { content } = useContentState();
  const { csbData } = useCsbState();
  const { samEntities, formSubmissions: bapFormSubmissions } = useBapState();
  const {
    applicationSubmissions: formioApplicationSubmissions,
    paymentRequestSubmissions: formioPaymentRequestSubmissions,
  } = useFormioSubmissionsState();
  const dialogDispatch = useDialogDispatch();
  const notificationsDispatch = useNotificationsDispatch();

  useFetchedFormSubmissions();

  const combinedRebates = useCombinedSubmissions();
  const sortedRebates = useSortedRebates(combinedRebates);

  // log combined 'sortedRebates' array if 'debug' search parameter exists
  useEffect(() => {
    if (searchParams.has("debug") && sortedRebates.length > 0) {
      console.log(sortedRebates);
    }
  }, [searchParams, sortedRebates]);

  // create ref to store when form is being submitted, so it can be referenced
  // in the Form component's `onSubmit` event prop, to prevent double submits
  const formIsBeingSubmitted = useRef(false);

  // create ref to hold submission data, so the latest value can be referenced
  // in the Form component's `onNextPage` event prop
  const storedSubmissionData = useRef<{ [field: string]: unknown }>({});

  const url = `${serverUrl}/api/formio-application-submission/${mongoId}`;

  const query = useQuery({
    queryKey: ["application", { id: mongoId }],
    queryFn: () => {
      return getData<ServerResponse>(url).then((res) => {
        const data = { ...res.submission?.data };

        // set up s3 re-route to wrapper app
        const s3Provider = Formio.Providers.providers.storage.s3;
        Formio.Providers.providers.storage.s3 = function (formio: any) {
          const s3Formio = cloneDeep(formio);
          const comboKey = data.bap_hidden_entity_combo_key;
          s3Formio.formUrl = `${serverUrl}/api/s3/application/${mongoId}/${comboKey}`;
          return s3Provider(s3Formio);
        };

        // remove `ncesDataSource` and `ncesDataLookup` fields
        if (data.hasOwnProperty("ncesDataSource")) delete data.ncesDataSource;
        if (data.hasOwnProperty("ncesDataLookup")) delete data.ncesDataLookup;

        return Promise.resolve(res);
      });
    },
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (updatedSubmission: {
      data: { [field: string]: unknown };
      metadata: { [field: string]: unknown };
      state: "submitted" | "draft";
    }) => {
      return postData<FormioSubmission>(url, updatedSubmission);
    },
    onSuccess: (data) => {
      return queryClient.setQueryData<ServerResponse>(
        ["application", { id: mongoId }],
        (prevData) => {
          return prevData?.submission
            ? { ...prevData, submission: data }
            : prevData;
        }
      );
    },
  });

  const { userAccess, formSchema, submission } = query.data ?? {};

  if (
    email === "" ||
    csbData.status !== "success" ||
    samEntities.status !== "success"
  ) {
    return <Loading />;
  }

  if (
    bapFormSubmissions.status === "idle" ||
    bapFormSubmissions.status === "pending" ||
    formioApplicationSubmissions.status === "idle" ||
    formioApplicationSubmissions.status === "pending" ||
    formioPaymentRequestSubmissions.status === "idle" ||
    formioPaymentRequestSubmissions.status === "pending"
  ) {
    return <Loading />;
  }

  if (
    bapFormSubmissions.status === "failure" ||
    formioApplicationSubmissions.status === "failure" ||
    formioPaymentRequestSubmissions.status === "failure"
  ) {
    return <Message type="error" text={messages.formSubmissionsError} />;
  }

  if (query.isInitialLoading) {
    return <Loading />;
  }

  if (query.isError || !userAccess || !formSchema || !submission) {
    const text = `The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake.`;
    return <Message type="error" text={text} />;
  }

  const { application: applicationFormOpen } =
    csbData.data.submissionPeriodOpen;

  const rebate = sortedRebates.find((item) => {
    return item.application.formio._id === mongoId;
  });

  const applicationNeedsEdits = !rebate
    ? false
    : submissionNeedsEdits({
        formio: rebate.application.formio,
        bap: rebate.application.bap,
      });

  const applicationNeedsEditsAndPaymentRequestExists =
    applicationNeedsEdits && !!rebate?.paymentRequest.formio;

  // NOTE: If the Application form submission needs edits and there's a
  // corresponding Payment Request form submission, display a confirmation
  // dialog prompting the user to delete the Payment Request form submission,
  // as it's data will no longer valid when the Application form submission's
  // data is changed.
  if (applicationNeedsEditsAndPaymentRequestExists) {
    dialogDispatch({
      type: "DISPLAY_DIALOG",
      payload: {
        dismissable: true,
        heading: "Submission Edits Requested",
        description: (
          <>
            <p>
              This Application form submission has been opened at the request of
              the applicant to make edits, but before you can make edits, the
              associated Payment Request form submission needs to be deleted. If
              the request to make edits to your Application form submission was
              made in error, contact the Clean School Bus Program helpline at{" "}
              <a href="mailto:cleanschoolbus@epa.gov">cleanschoolbus@epa.gov</a>
              .
            </p>

            <p>
              If you’d like to view the Payment Request form submission before
              deletion, please close this dialog box, and you will be
              re-directed to the associated Payment Request form.
            </p>

            <p>
              To proceed with deleting the associated Payment Request form
              submission, please select the{" "}
              <strong>Delete Payment Request Form Submission</strong> button
              below, and the Payment Request form submission will be deleted.
              The Application form will then be open for editing.
            </p>

            <div className="usa-alert usa-alert--error" role="alert">
              <div className="usa-alert__body">
                <p className="usa-alert__text">
                  <strong>Please note:</strong> Once deleted, the Payment
                  Request form submission will be removed from your dashboard
                  and cannot be recovered.
                </p>
              </div>
            </div>
          </>
        ),
        confirmText: "Delete Payment Request Form Submission",
        confirmedAction: () => {
          const paymentRequest = rebate.paymentRequest.formio;

          if (!paymentRequest) {
            notificationsDispatch({
              type: "DISPLAY_NOTIFICATION",
              payload: {
                type: "error",
                body: (
                  <>
                    <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                      Error deleting Payment Request <em>{rebate.rebateId}</em>.
                    </p>
                    <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
                      Please notify the helpdesk that a problem exists
                      preventing the deletion of Payment Request form submission{" "}
                      <em>{rebate.rebateId}</em>.
                    </p>
                  </>
                ),
              },
            });

            // NOTE: logging rebate for helpdesk debugging purposes
            console.log(rebate);
            return;
          }

          notificationsDispatch({
            type: "DISPLAY_NOTIFICATION",
            payload: {
              type: "info",
              body: (
                <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                  Deleting Payment Request <em>{rebate.rebateId}</em>...
                </p>
              ),
            },
          });

          const url = `${serverUrl}/api/delete-formio-payment-request-submission`;

          postData(url, {
            mongoId: paymentRequest._id,
            rebateId: paymentRequest.data.hidden_bap_rebate_id,
            comboKey: paymentRequest.data.bap_hidden_entity_combo_key,
          })
            .then((res) => {
              window.location.reload();
            })
            .catch((err) => {
              notificationsDispatch({
                type: "DISPLAY_NOTIFICATION",
                payload: {
                  type: "error",
                  body: (
                    <>
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        Error deleting Payment Request{" "}
                        <em>{rebate.rebateId}</em>.
                      </p>
                      <p className="tw-mt-1 tw-text-sm tw-text-gray-500">
                        Please reload the page to attempt the deletion again, or
                        contact the helpdesk if the problem persists.
                      </p>
                    </>
                  ),
                },
              });
            });
        },
        dismissedAction: () => navigate(`/payment-request/${rebate.rebateId}`),
      },
    });

    return null;
  }

  const formIsReadOnly =
    (submission.state === "submitted" || !applicationFormOpen) &&
    !applicationNeedsEdits;

  const entityComboKey = submission.data.bap_hidden_entity_combo_key;
  const entity = samEntities.data.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c === entityComboKey
    );
  });

  // TODO: do we need to account for when ENTITY_STATUS__c does not equal "Active" (e.g. its expired)?
  if (!entity) return null;

  const { title, name } = getUserInfo(email, entity);

  return (
    <div className="margin-top-2">
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submission.state === "draft"
              ? content.data?.draftApplicationIntro || ""
              : submission.state === "submitted"
              ? content.data?.submittedApplicationIntro || ""
              : ""
          }
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
            <strong>Application ID:</strong> {submission._id}
          </div>
        </li>

        {rebate?.application.bap?.rebateId && (
          <li className="usa-icon-list__item">
            <div className="usa-icon-list__icon text-primary">
              <svg className="usa-icon" aria-hidden="true" role="img">
                <use href={`${icons}#local_offer`} />
              </svg>
            </div>
            <div className="usa-icon-list__content">
              <strong>Rebate ID:</strong> {rebate.application.bap.rebateId}
            </div>
          </li>
        )}
      </ul>

      <div className="csb-form">
        <Form
          form={formSchema.json}
          url={formSchema.url} // NOTE: used for file uploads
          submission={{
            data: {
              ...submission.data,
              last_updated_by: email,
              hidden_current_user_email: email,
              hidden_current_user_title: title,
              hidden_current_user_name: name,
            },
          }}
          options={{
            readOnly: formIsReadOnly,
            noAlerts: true,
          }}
          onSubmit={(onSubmitSubmission: {
            data: { [field: string]: unknown };
            metadata: { [field: string]: unknown };
            state: "submitted" | "draft";
          }) => {
            if (formIsReadOnly) return;

            // account for when form is being submitted to prevent double submits
            if (formIsBeingSubmitted.current) return;
            if (onSubmitSubmission.state === "submitted") {
              formIsBeingSubmitted.current = true;
            }

            const data = { ...onSubmitSubmission.data };

            // remove `ncesDataSource` and `ncesDataLookup` fields
            if (data.hasOwnProperty("ncesDataSource")) delete data.ncesDataSource; // prettier-ignore
            if (data.hasOwnProperty("ncesDataLookup")) delete data.ncesDataLookup; // prettier-ignore

            notificationsDispatch({
              type: "DISPLAY_NOTIFICATION",
              payload: {
                type: "info",
                body: (
                  <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                    {onSubmitSubmission.state === "submitted" ? (
                      <>Submitting...</>
                    ) : (
                      <>Saving draft...</>
                    )}
                  </p>
                ),
              },
            });

            const updatedSubmission = {
              ...onSubmitSubmission,
              data,
            };

            mutation.mutate(updatedSubmission, {
              onSuccess: (res, payload, context) => {
                storedSubmissionData.current = cloneDeep(res.data);

                notificationsDispatch({
                  type: "DISPLAY_NOTIFICATION",
                  payload: {
                    type: "success",
                    body: (
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        {onSubmitSubmission.state === "submitted" ? (
                          <>
                            Application Form <em>{mongoId}</em> submitted
                            successfully.
                          </>
                        ) : (
                          <>Draft saved successfully.</>
                        )}
                      </p>
                    ),
                  },
                });

                if (onSubmitSubmission.state === "submitted") {
                  navigate("/");
                }

                if (onSubmitSubmission.state === "draft") {
                  setTimeout(() => {
                    notificationsDispatch({ type: "DISMISS_NOTIFICATION" });
                  }, 5000);
                }
              },
              onError: (error, payload, context) => {
                formIsBeingSubmitted.current = false;

                notificationsDispatch({
                  type: "DISPLAY_NOTIFICATION",
                  payload: {
                    type: "error",
                    body: (
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        {onSubmitSubmission.state === "submitted" ? (
                          <>Error submitting Application form.</>
                        ) : (
                          <>Error saving draft.</>
                        )}
                      </p>
                    ),
                  },
                });
              },
            });
          }}
          onNextPage={(onNextPageParam: {
            page: number;
            submission: {
              data: { [field: string]: unknown };
              metadata: { [field: string]: unknown };
            };
          }) => {
            if (formIsReadOnly) return;

            const data = { ...onNextPageParam.submission.data };

            // remove `ncesDataSource` and `ncesDataLookup` fields
            if (data.hasOwnProperty("ncesDataSource")) delete data.ncesDataSource; // prettier-ignore
            if (data.hasOwnProperty("ncesDataLookup")) delete data.ncesDataLookup; // prettier-ignore

            // don't post an update if no changes have been made to the form
            // (ignoring current user fields)
            const dataToCheck = { ...data };
            delete dataToCheck.hidden_current_user_email;
            delete dataToCheck.hidden_current_user_title;
            delete dataToCheck.hidden_current_user_name;
            const storedDataToCheck = { ...storedSubmissionData.current };
            delete storedDataToCheck.hidden_current_user_email;
            delete storedDataToCheck.hidden_current_user_title;
            delete storedDataToCheck.hidden_current_user_name;
            if (isEqual(dataToCheck, storedDataToCheck)) return;

            notificationsDispatch({
              type: "DISPLAY_NOTIFICATION",
              payload: {
                type: "info",
                body: (
                  <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                    Saving draft...
                  </p>
                ),
              },
            });

            const updatedSubmission = {
              ...onNextPageParam.submission,
              data,
              state: "draft" as const,
            };

            mutation.mutate(updatedSubmission, {
              onSuccess: (res, payload, context) => {
                storedSubmissionData.current = cloneDeep(res.data);

                notificationsDispatch({
                  type: "DISPLAY_NOTIFICATION",
                  payload: {
                    type: "success",
                    body: (
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        Draft saved successfully.
                      </p>
                    ),
                  },
                });

                setTimeout(() => {
                  notificationsDispatch({ type: "DISMISS_NOTIFICATION" });
                }, 5000);
              },
              onError: (error, payload, context) => {
                notificationsDispatch({
                  type: "DISPLAY_NOTIFICATION",
                  payload: {
                    type: "error",
                    body: (
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        Error saving draft.
                      </p>
                    ),
                  },
                });
              },
            });
          }}
        />
      </div>
    </div>
  );
}
