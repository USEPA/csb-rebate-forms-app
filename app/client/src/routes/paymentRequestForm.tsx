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
import { useContentData } from "components/app";
import { useCsbData, useBapSamData } from "components/userDashboard";
import { useUserState } from "contexts/user";
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

export function PaymentRequestForm() {
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
    return <PaymentRequestFormContent email={email} />;
  }, [email]);
}

function PaymentRequestFormContent({ email }: { email: string }) {
  const navigate = useNavigate();
  const { id: rebateId } = useParams<"id">(); // CSB Rebate ID (6 digits)
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const content = useContentData();
  const csbData = useCsbData();
  const bapSamData = useBapSamData();
  const notificationsDispatch = useNotificationsDispatch();

  const {
    bapFormSubmissionsQuery,
    formioApplicationSubmissionsQuery,
    formioPaymentRequestSubmissionsQuery,
  } = useFetchedFormSubmissions();

  const combinedRebates = useCombinedSubmissions();
  const sortedRebates = useSortedRebates(combinedRebates);

  // log combined 'sortedRebates' array if 'debug' search parameter exists
  useEffect(() => {
    if (searchParams.has("debug") && sortedRebates.length > 0) {
      console.log(sortedRebates);
    }
  }, [searchParams, sortedRebates]);

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
    queryClient.resetQueries({ queryKey: ["payment-request"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio-payment-request-submission/${rebateId}`;

  const query = useQuery({
    queryKey: ["payment-request", { id: rebateId }],
    queryFn: () => {
      return getData<ServerResponse>(url).then((res) => {
        // set up s3 re-route to wrapper app
        const s3Provider = Formio.Providers.providers.storage.s3;
        Formio.Providers.providers.storage.s3 = function (formio: any) {
          const s3Formio = cloneDeep(formio);
          const mongoId = res.submission?._id;
          const comboKey = res.submission?.data.bap_hidden_entity_combo_key;
          s3Formio.formUrl = `${serverUrl}/api/s3/payment-request/${mongoId}/${comboKey}`;
          return s3Provider(s3Formio);
        };

        return Promise.resolve(res);
      });
    },
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (updatedSubmission: {
      mongoId: string;
      submission: {
        data: { [field: string]: unknown };
        metadata: { [field: string]: unknown };
        state: "submitted" | "draft";
      };
    }) => {
      return postData<FormioSubmission>(url, updatedSubmission);
    },
    onSuccess: (res) => {
      return queryClient.setQueryData<ServerResponse>(
        ["application", { id: rebateId }],
        (prevData) => {
          return prevData?.submission
            ? { ...prevData, submission: res }
            : prevData;
        }
      );
    },
  });

  const { userAccess, formSchema, submission } = query.data ?? {};

  if (email === "" || !csbData || !bapSamData) {
    return <Loading />;
  }

  if (
    bapFormSubmissionsQuery.isFetching ||
    formioApplicationSubmissionsQuery.isFetching ||
    formioPaymentRequestSubmissionsQuery.isFetching
  ) {
    return <Loading />;
  }

  if (
    bapFormSubmissionsQuery.isError ||
    formioApplicationSubmissionsQuery.isError ||
    formioPaymentRequestSubmissionsQuery.isError
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

  const rebate = sortedRebates.find((item) => item.rebateId === rebateId);

  const applicationNeedsEdits = !rebate
    ? false
    : submissionNeedsEdits({
        formio: rebate.application.formio,
        bap: rebate.application.bap,
      });

  const paymentRequestNeedsEdits = !rebate
    ? false
    : submissionNeedsEdits({
        formio: rebate.paymentRequest.formio,
        bap: rebate.paymentRequest.bap,
      });

  const paymentRequestFormOpen = csbData.submissionPeriodOpen.paymentRequest;

  const formIsReadOnly =
    applicationNeedsEdits ||
    ((submission.state === "submitted" || !paymentRequestFormOpen) &&
      !paymentRequestNeedsEdits);

  const entityComboKey = submission.data.bap_hidden_entity_combo_key;
  const entity = bapSamData.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c === entityComboKey
    );
  });

  // TODO: do we need to account for when ENTITY_STATUS__c does not equal "Active" (e.g. its expired)?
  if (!entity) return null;

  const {
    UNIQUE_ENTITY_ID__c,
    ENTITY_EFT_INDICATOR__c,
    ELEC_BUS_POC_EMAIL__c,
    ALT_ELEC_BUS_POC_EMAIL__c,
    GOVT_BUS_POC_EMAIL__c,
    ALT_GOVT_BUS_POC_EMAIL__c,
  } = entity;

  const { title, name } = getUserInfo(email, entity);

  return (
    <div className="margin-top-2">
      {content && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submission.state === "draft"
              ? content.draftPaymentRequestIntro
              : submission.state === "submitted"
              ? content.submittedPaymentRequestIntro
              : ""
          }
        />
      )}

      {applicationNeedsEdits && (
        <Message
          type="warning"
          text={messages.paymentRequestFormWillBeDeleted}
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
            <strong>Rebate ID:</strong> {rebateId}
          </div>
        </li>
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
              hidden_sam_uei: UNIQUE_ENTITY_ID__c,
              hidden_sam_efti: ENTITY_EFT_INDICATOR__c || "0000",
              hidden_sam_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
              hidden_sam_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
              hidden_sam_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
              hidden_sam_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
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
              mongoId: submission._id,
              submission: {
                ...onSubmitSubmission,
                data,
              },
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
                            Payment Request <em>{rebateId}</em> submitted
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
                          <>Error submitting Payment Request form.</>
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
              mongoId: submission._id,
              submission: {
                ...onNextPageParam.submission,
                data,
                state: "draft" as const,
              },
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

      {applicationNeedsEdits && (
        <Message
          type="warning"
          text={messages.paymentRequestFormWillBeDeleted}
        />
      )}
    </div>
  );
}
