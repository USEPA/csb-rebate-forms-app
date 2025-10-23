import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { type FormProps, type Submission, Form } from "@formio/react";
import clsx from "clsx";
import { cloneDeep, isEqual } from "lodash";
import icons from "uswds/img/sprite.svg";
// ---
import {
  type FormioSchemaAndSubmission,
  type FormioPRF2024FormSubmission,
} from "@/types";
import { serverUrl, messages } from "@/config";
import {
  getComboKeyFieldName,
  getData,
  postData,
  useContentData,
  useConfigData,
  useBapSamData,
  useSubmissionPDFQuery,
  useSubmissionsQueries,
  useSubmissions,
  submissionNeedsEdits,
  entityIsActive,
  entityHasExclusionStatus,
  entityHasDebtSubjectToOffset,
  getUserInfo,
} from "@/utilities";
import { Loading, LoadingButtonIcon } from "@/components/loading";
import { Message } from "@/components/message";
import { MarkdownContent } from "@/components/markdownContent";
import { useNotificationsActions } from "@/contexts/notifications";

type Response = FormioSchemaAndSubmission<FormioPRF2024FormSubmission>;

/** Custom hook to fetch and update Formio submission data */
function useFormioSubmissionQueryAndMutation(rebateId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["formio/2024/prf-submission"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio/2024/prf-submission/${rebateId}`;

  const query = useQuery({
    queryKey: ["formio/2024/prf-submission", { id: rebateId }],
    queryFn: () => getData<Response>(url),
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (updatedSubmission: {
      mongoId: string;
      submission: Submission;
    }) => {
      return postData<FormioPRF2024FormSubmission>(url, updatedSubmission);
    },
    onSuccess: (res, _payload, _context) => {
      return queryClient.setQueryData<Response>(
        ["formio/2024/prf-submission", { id: rebateId }],
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

export function PRF2024() {
  const { email } = useOutletContext<{ email: string }>();
  /* ensure user verification (JWT refresh) doesn't cause form to re-render */
  return useMemo(() => {
    return <PaymentRequestForm email={email} />;
  }, [email]);
}

function PaymentRequestForm(props: { email: string }) {
  const { email } = props;

  const rebateYear = "2024";

  const navigate = useNavigate();
  const { id: rebateId } = useParams<"id">(); // CSB Rebate ID (6 digits)

  const content = useContentData();
  const configData = useConfigData();
  const bapSamData = useBapSamData();
  const {
    displaySuccessNotification,
    displayErrorNotification,
    dismissNotification,
  } = useNotificationsActions();

  const submissionsQueries = useSubmissionsQueries(rebateYear);
  const submissions = useSubmissions(rebateYear);

  const { query, mutation } = useFormioSubmissionQueryAndMutation(rebateId);
  const { access, schema, submission } = query.data ?? {};

  const comboKeyFieldName = getComboKeyFieldName(rebateYear);

  const prfComboKey = String(submission?.data?.[comboKeyFieldName] ?? "");
  const mongoId = submission?._id || "";

  const pdfQuery = useSubmissionPDFQuery({
    rebateYear,
    formType: "prf",
    mongoId,
  });

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

  /**
   * Stores the form data's state right after the user clicks the Save, Submit,
   * or Next button. As soon as a post request to update the data succeeds, this
   * pending submission data is reset to an empty object. This pending data,
   * along with the submission data returned from the server is passed into the
   * Form component's `submission` prop.
   */
  const pendingSubmissionData = useRef<{ [field: string]: unknown }>({});

  /**
   * Stores the last succesfully submitted data, so it can be used in the Form
   * component's `onNextPage` event prop's "dirty check" which determines if
   * posting of updated data is needed (so we don't make needless requests if no
   * field data in the form has changed).
   */
  const lastSuccesfullySubmittedData = useRef<{ [field: string]: unknown }>({});

  if (!configData || !bapSamData) {
    return <Loading />;
  }

  if (submissionsQueries.some((query) => query.isFetching)) {
    return <Loading />;
  }

  if (submissionsQueries.some((query) => query.isError)) {
    return <Message type="error" text={messages.formSubmissionsError} />;
  }

  if (query.isLoading) {
    return <Loading />;
  }

  if (query.isError || !access || !schema || !submission) {
    return <Message type="error" text={messages.formSubmissionError} />;
  }

  const rebate = submissions.find((r) => r.rebateId === rebateId);

  const frfNeedsEdits = !rebate
    ? false
    : submissionNeedsEdits({
        formio: rebate.frf.formio,
        bap: rebate.frf.bap,
      });

  const prfNeedsEdits = !rebate
    ? false
    : submissionNeedsEdits({
        formio: rebate.prf.formio,
        bap: rebate.prf.bap,
      });

  const prfSubmissionPeriodOpen =
    configData.submissionPeriodOpen[rebateYear].prf;

  const formIsReadOnly =
    frfNeedsEdits ||
    ((submission.state === "submitted" || !prfSubmissionPeriodOpen) &&
      !prfNeedsEdits);

  /**
   * Matched SAM.gov entity for the PRF submission.
   */
  const entity = bapSamData.entities.find((entity) => {
    return entity.ENTITY_COMBO_KEY__c === prfComboKey;
  });

  if (!entity) {
    return <Message type="error" text={messages.formSubmissionError} />;
  }

  const isActive = entityIsActive(entity);
  const hasExclusionStatus = entityHasExclusionStatus(entity);
  const hasDebtSubjectToOffset = entityHasDebtSubjectToOffset(entity);

  if (!isActive || hasExclusionStatus || hasDebtSubjectToOffset) {
    return <Message type="error" text={messages.bapSamIneligible} />;
  }

  const {
    ELEC_BUS_POC_EMAIL__c,
    ALT_ELEC_BUS_POC_EMAIL__c,
    GOVT_BUS_POC_EMAIL__c,
    ALT_GOVT_BUS_POC_EMAIL__c,
  } = entity;

  const { title, name } = getUserInfo(email, entity);

  return (
    <div className="margin-top-2">
      {content && (
        <div className="margin-top-4">
          <MarkdownContent
            children={
              submission.state === "draft"
                ? content.draftPRFIntro
                : submission.state === "submitted"
                  ? content.submittedPRFIntro
                  : ""
            }
          />
        </div>
      )}

      {frfNeedsEdits && (
        <Message type="warning" text={messages.prfWillBeDeleted} />
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

      {mongoId && (
        <p>
          <button
            className="usa-button font-sans-2xs margin-right-0 padding-x-105 padding-y-1"
            type="button"
            disabled={pdfQuery.isFetching}
            onClick={(_ev) => pdfQuery.downloadPDF()}
          >
            <span className="display-flex flex-align-center">
              <svg
                className="usa-icon"
                aria-hidden="true"
                focusable="false"
                role="img"
              >
                <use href={`${icons}#arrow_downward`} />
              </svg>
              <span className="margin-left-1">Download PDF</span>
              {pdfQuery.isFetching && <LoadingButtonIcon position="end" />}
            </span>
          </button>
        </p>
      )}

      <Dialog open={dataIsPosting.current} onClose={(_value) => {}}>
        <DialogBackdrop
          className={clsx("tw:fixed tw:inset-0 tw:bg-black/30")}
        />
        <div className={clsx("tw:fixed tw:inset-0 tw:z-20")}>
          <div
            className={clsx(
              "tw:flex tw:min-h-full tw:items-center tw:justify-center",
            )}
          >
            <DialogPanel
              className={clsx(
                "tw:rounded-lg tw:bg-white tw:px-4 tw:pb-4 tw:shadow-xl",
              )}
            >
              <Loading />
            </DialogPanel>
          </div>
        </div>
      </Dialog>

      <div className="csb-form">
        <Form
          src={schema}
          url={`${serverUrl}/api/formio/2024/s3/prf/${mongoId}/${prfComboKey}`}
          submission={{
            /**
             * NOTE: The `csb-form-submission-state` metadata field's value is
             * used in the Formio signature component's calculateValue config:
             * on "Next" and "Previous" page events, if the form's current
             * submission state is "draft", the signature component's value will
             * be cleared, ensuring the user always signs their submission each
             * time before submitting.
             */
            metadata: {
              ...submission.metadata,
              "csb-form-submission-state": submission.state,
            },
            data: {
              ...submission.data,
              _user_email: email,
              _user_title: title,
              _user_name: name,
              _bap_elec_bus_poc_email: ELEC_BUS_POC_EMAIL__c,
              _bap_alt_elec_bus_poc_email: ALT_ELEC_BUS_POC_EMAIL__c,
              _bap_govt_bus_poc_email: GOVT_BUS_POC_EMAIL__c,
              _bap_alt_govt_bus_poc_email: ALT_GOVT_BUS_POC_EMAIL__c,
              ...pendingSubmissionData.current,
            },
          }}
          options={{
            readOnly: formIsReadOnly,
            noAlerts: true,
          }}
          onSubmit={(onSubmitParam: Submission) => {
            if (formIsReadOnly) return;

            // account for when form is being submitted to prevent double submits
            if (formIsBeingSubmitted.current) return;
            if (onSubmitParam.state === "submitted") {
              formIsBeingSubmitted.current = true;
            }

            const data = { ...onSubmitParam.data };

            const updatedSubmission = {
              mongoId: submission._id,
              submission: {
                ...onSubmitParam,
                metadata: {
                  ...onSubmitParam.metadata,
                  "csb-form-submission-state": onSubmitParam.state,
                },
                data,
              },
            };

            dismissNotification({ id: 0 });
            dataIsPosting.current = true;
            pendingSubmissionData.current = data;

            mutation.mutate(updatedSubmission, {
              onSuccess: (res, _payload, _context) => {
                pendingSubmissionData.current = {};
                lastSuccesfullySubmittedData.current = cloneDeep(res.data);

                /** success notification id */
                const id = Date.now();

                displaySuccessNotification({
                  id,
                  body: (
                    <p
                      className={clsx(
                        "tw:text-sm tw:font-medium tw:text-gray-900",
                      )}
                    >
                      {onSubmitParam.state === "submitted" && (
                        <>
                          Payment Request <em>{rebateId}</em> submitted
                          successfully.
                        </>
                      )}

                      {onSubmitParam.state === "draft" && (
                        <>Draft saved successfully.</>
                      )}
                    </p>
                  ),
                });

                if (onSubmitParam.state === "submitted") {
                  /**
                   * NOTE: we'll keep the success notification displayed and
                   * redirect the user to their dashboard
                   */
                  navigate("/", { viewTransition: true });
                }

                if (onSubmitParam.state === "draft") {
                  setTimeout(() => dismissNotification({ id }), 5000);
                }
              },
              onError: (_error, _payload, _context) => {
                displayErrorNotification({
                  id: Date.now(),
                  body: (
                    <p
                      className={clsx(
                        "tw:text-sm tw:font-medium tw:text-gray-900",
                      )}
                    >
                      {onSubmitParam.state === "submitted" && (
                        <>Error submitting Payment Request form.</>
                      )}

                      {onSubmitParam.state === "draft" && (
                        <>Error saving draft.</>
                      )}
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
          onNextPage={(param) => {
            /** NOTE: The types for onNextPage params are incorrect */
            type T = Parameters<Exclude<FormProps["onNextPage"], undefined>>;

            const onNextPageParams = param as unknown as {
              page: T[0];
              submission: T[1];
            };

            if (formIsReadOnly) return;

            const data = { ...onNextPageParams.submission.data };

            // "dirty check" – don't post an update if no changes have been made
            // to the form (ignoring current user fields)
            const currentData = { ...data };
            const submittedData = { ...lastSuccesfullySubmittedData.current };

            delete currentData._user_email;
            delete currentData._user_title;
            delete currentData._user_name;
            delete submittedData._user_email;
            delete submittedData._user_title;
            delete submittedData._user_name;
            if (isEqual(currentData, submittedData)) return;

            const updatedSubmission = {
              mongoId: submission._id,
              submission: {
                ...onNextPageParams.submission,
                data,
                state: "draft",
              },
            };

            dismissNotification({ id: 0 });
            dataIsPosting.current = true;
            pendingSubmissionData.current = data;

            mutation.mutate(updatedSubmission, {
              onSuccess: (res, _payload, _context) => {
                pendingSubmissionData.current = {};
                lastSuccesfullySubmittedData.current = cloneDeep(res.data);

                /** success notification id */
                const id = Date.now();

                displaySuccessNotification({
                  id,
                  body: (
                    <p
                      className={clsx(
                        "tw:text-sm tw:font-medium tw:text-gray-900",
                      )}
                    >
                      Draft saved successfully.
                    </p>
                  ),
                });

                setTimeout(() => dismissNotification({ id }), 5000);
              },
              onError: (_error, _payload, _context) => {
                displayErrorNotification({
                  id: Date.now(),
                  body: (
                    <p
                      className={clsx(
                        "tw:text-sm tw:font-medium tw:text-gray-900",
                      )}
                    >
                      Error saving draft.
                    </p>
                  ),
                });
              },
              onSettled: (_data, _error, _payload, _context) => {
                dataIsPosting.current = false;
              },
            });
          }}
        />
      </div>

      {frfNeedsEdits && (
        <Message type="warning" text={messages.prfWillBeDeleted} />
      )}
    </div>
  );
}
