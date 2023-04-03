import { useEffect, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
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
  useRebates,
} from "routes/allRebates";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { useContentData } from "components/app";
import { useCsbData, useBapSamData } from "components/userDashboard";
import { useDialogDispatch } from "contexts/dialog";
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
  const navigate = useNavigate();
  const { email } = useOutletContext<{ email: string }>();
  const { id: mongoId } = useParams<"id">(); // MongoDB ObjectId string

  const queryClient = useQueryClient();

  const content = useContentData();
  const csbData = useCsbData();
  const bapSamData = useBapSamData();
  const dialogDispatch = useDialogDispatch();
  const notificationsDispatch = useNotificationsDispatch();

  const formSubmissionsQueries = useFetchedFormSubmissions();
  const rebates = useRebates();

  /**
   * Stores when the form is being submitted, so it can be referenced in the
   * Form component's `onSubmit` event prop to prevent double submits
   */
  const formIsBeingSubmitted = useRef(false);

  /**
   * Stores the last succesfully submitted data, so it can be used in the Form
   * component's `onNextPage` event prop's "dirty check" which determines if
   * posting of updated data is needed (so we don't make needless requests if no
   * field data in the form has changed).
   */
  const lastSuccesfullySubmittedData = useRef<{ [field: string]: unknown }>({});

  /**
   * Stores the form data's state right after the user clicks the Save, Submit,
   * or Next button. As soon as a post request to update the data succeeds, this
   * pending submission data is reset to an empty object. This pending data,
   * along with the submission data returned from the server is passed into the
   * Form component's `submission` prop.
   */
  const pendingSubmissionData = useRef<{ [field: string]: unknown }>({});

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["application"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio-application-submission/${mongoId}`;

  const query = useQuery({
    queryKey: ["application", { id: mongoId }],
    queryFn: () => {
      return getData<ServerResponse>(url).then((res) => {
        // set up s3 re-route to wrapper app
        const s3Provider = Formio.Providers.providers.storage.s3;
        Formio.Providers.providers.storage.s3 = function (formio: any) {
          const s3Formio = cloneDeep(formio);
          const comboKey = res.submission?.data.bap_hidden_entity_combo_key;
          s3Formio.formUrl = `${serverUrl}/api/s3/application/${mongoId}/${comboKey}`;
          return s3Provider(s3Formio);
        };

        // remove `ncesDataSource` and `ncesDataLookup` fields
        const data = { ...res.submission?.data };
        if (data.hasOwnProperty("ncesDataSource")) delete data.ncesDataSource;
        if (data.hasOwnProperty("ncesDataLookup")) delete data.ncesDataLookup;

        return Promise.resolve({
          ...res,
          submission: { ...res.submission, data },
        });
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
    onSuccess: (res) => {
      return queryClient.setQueryData<ServerResponse>(
        ["application", { id: mongoId }],
        (prevData) => {
          return prevData?.submission
            ? { ...prevData, submission: res }
            : prevData;
        }
      );
    },
  });

  const { userAccess, formSchema, submission } = query.data ?? {};

  if (!csbData || !bapSamData) {
    return <Loading />;
  }

  if (formSubmissionsQueries.some((query) => query.isFetching)) {
    return <Loading />;
  }

  if (formSubmissionsQueries.some((query) => query.isError)) {
    return <Message type="error" text={messages.formSubmissionsError} />;
  }

  if (query.isInitialLoading) {
    return <Loading />;
  }

  if (query.isError || !userAccess || !formSchema || !submission) {
    const text = `The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake.`;
    return <Message type="error" text={text} />;
  }

  const rebate = rebates.find((r) => r.application.formio._id === mongoId);

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

  const applicationFormOpen = csbData.submissionPeriodOpen.application;

  const formIsReadOnly =
    (submission.state === "submitted" || !applicationFormOpen) &&
    !applicationNeedsEdits;

  const entityComboKey = submission.data.bap_hidden_entity_combo_key;
  const entity = bapSamData.entities.find((entity) => {
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
      {content && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submission.state === "draft"
              ? content.draftApplicationIntro
              : submission.state === "submitted"
              ? content.submittedApplicationIntro
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
              ...pendingSubmissionData.current,
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

            pendingSubmissionData.current = data;

            const updatedSubmission = {
              ...onSubmitSubmission,
              data,
            };

            mutation.mutate(updatedSubmission, {
              onSuccess: (res, payload, context) => {
                lastSuccesfullySubmittedData.current = cloneDeep(res.data);
                pendingSubmissionData.current = {};

                notificationsDispatch({
                  type: "DISPLAY_NOTIFICATION",
                  payload: {
                    type: "success",
                    body: (
                      <p className="tw-text-sm tw-font-medium tw-text-gray-900">
                        {onSubmitSubmission.state === "submitted" ? (
                          <>
                            Application <em>{mongoId}</em> submitted
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

            // "dirty check" – don't post an update if no changes have been made
            // to the form (ignoring current user fields)
            const currentData = { ...data };
            const submittedData = { ...lastSuccesfullySubmittedData.current };
            delete currentData.hidden_current_user_email;
            delete currentData.hidden_current_user_title;
            delete currentData.hidden_current_user_name;
            delete submittedData.hidden_current_user_email;
            delete submittedData.hidden_current_user_title;
            delete submittedData.hidden_current_user_name;
            if (isEqual(currentData, submittedData)) return;

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

            pendingSubmissionData.current = data;

            const updatedSubmission = {
              ...onNextPageParam.submission,
              data,
              state: "draft" as const,
            };

            mutation.mutate(updatedSubmission, {
              onSuccess: (res, payload, context) => {
                lastSuccesfullySubmittedData.current = cloneDeep(res.data);
                pendingSubmissionData.current = {};

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
