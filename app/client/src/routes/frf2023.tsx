import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import { type FormProps, type Submission, Form } from "@formio/react";
import clsx from "clsx";
import { cloneDeep, isEqual } from "lodash";
import icons from "@uswds/uswds/img/sprite.svg";
// ---
import {
  type FormioSchemaAndSubmission,
  type FormioFRF2023FormSubmission,
} from "@/types";
import { serverUrl, messages } from "@/config";
import {
  getComboKeyFieldName,
  getRebateIdFieldName,
  getData,
  postData,
  usePublicConfigData,
  usePrivateConfigData,
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
import { useDialogActions } from "@/contexts/dialog";
import { useNotificationsActions } from "@/contexts/notifications";

type Response = FormioSchemaAndSubmission<FormioFRF2023FormSubmission>;

/** Custom hook to fetch and update Formio submission data */
function useFormioSubmissionQueryAndMutation(mongoId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.resetQueries({ queryKey: ["formio/2023/frf-submission"] });
  }, [queryClient]);

  const url = `${serverUrl}/api/formio/2023/frf-submission/${mongoId}`;

  const query = useQuery({
    queryKey: ["formio/2023/frf-submission", { id: mongoId }],
    queryFn: () => getData<Response>(url),
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (updatedSubmission: Submission) => {
      return postData<FormioFRF2023FormSubmission>(url, updatedSubmission);
    },
    onSuccess: (res, _payload, _context) => {
      return queryClient.setQueryData<Response>(
        ["formio/2023/frf-submission", { id: mongoId }],
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

export function FRF2023() {
  const { email } = useOutletContext<{ email: string }>();
  /* ensure user verification (JWT refresh) doesn't cause form to re-render */
  return useMemo(() => {
    return <FundingRequestForm email={email} />;
  }, [email]);
}

function FundingRequestForm(props: { email: string }) {
  const { email } = props;

  const rebateYear = "2023";

  const navigate = useNavigate();
  const { id: mongoId } = useParams<"id">(); // MongoDB ObjectId string

  const publicConfigData = usePublicConfigData();
  const { staticContent } = publicConfigData || {};

  const privateConfigData = usePrivateConfigData();
  const bapSamData = useBapSamData();
  const { displayDialog } = useDialogActions();
  const {
    displayInfoNotification,
    displaySuccessNotification,
    displayErrorNotification,
    dismissNotification,
  } = useNotificationsActions();

  const submissionsQueries = useSubmissionsQueries(rebateYear);
  const submissions = useSubmissions(rebateYear);

  const { query, mutation } = useFormioSubmissionQueryAndMutation(mongoId);
  const { access, schema, submission } = query.data ?? {};

  const comboKeyFieldName = getComboKeyFieldName(rebateYear);
  const rebateIdFieldName = getRebateIdFieldName(rebateYear);

  const frfComboKey = String(submission?.data?.[comboKeyFieldName] ?? "");

  const pdfQuery = useSubmissionPDFQuery({
    rebateYear,
    formType: "frf",
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

  if (!staticContent || !privateConfigData || !bapSamData) {
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

  const rebate = submissions.find((r) => r.frf.formio._id === mongoId);

  const frfNeedsEdits = !rebate
    ? false
    : submissionNeedsEdits({
        formio: rebate.frf.formio,
        bap: rebate.frf.bap,
      });

  const frfSubmissionPeriodOpen =
    privateConfigData.submissionPeriodOpen[rebateYear].frf;

  const formIsReadOnly =
    (submission.state === "submitted" || !frfSubmissionPeriodOpen) &&
    !frfNeedsEdits;

  /**
   * Matched SAM.gov entity for the FRF submission.
   */
  const entity = bapSamData.entities.find((entity) => {
    return entity.ENTITY_COMBO_KEY__c === frfComboKey;
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

  const { title, name } = getUserInfo(email, entity);

  /**
   * NOTE: If the FRF submission needs edits and there's a corresponding PRF
   * submission, display a confirmation dialog prompting the user to delete the
   * PRF submission, as it's data will no longer valid when the FRF submission's
   * data is changed.
   */
  const frfNeedsEditsAndPRFExists = frfNeedsEdits && !!rebate?.prf.formio;

  if (frfNeedsEditsAndPRFExists) {
    displayDialog({
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
            <a href="mailto:cleanschoolbus@epa.gov">cleanschoolbus@epa.gov</a>.
          </p>

          <p>
            If you’d like to view the Payment Request form submission before
            deletion, please close this dialog box, and you will be re-directed
            to the associated Payment Request form.
          </p>

          <p>
            To proceed with deleting the associated Payment Request form
            submission, please select the{" "}
            <strong>Delete Payment Request Form Submission</strong> button
            below, and the Payment Request form submission will be deleted. The
            Application form will then be open for editing.
          </p>

          <div className="usa-alert usa-alert--error" role="alert">
            <div className="usa-alert__body">
              <p className="usa-alert__text">
                <strong>Please note:</strong> Once deleted, the Payment Request
                form submission will be removed from your dashboard and cannot
                be recovered.
              </p>
            </div>
          </div>
        </>
      ),
      confirmText: "Delete Payment Request Form Submission",
      confirmedAction: () => {
        const prf = rebate.prf.formio;

        const prfComboKey = String(prf?.data?.[comboKeyFieldName] ?? "");
        const prfRebateId = String(prf?.data?.[rebateIdFieldName] ?? "");

        if (!prf) {
          displayErrorNotification({
            id: Date.now(),
            body: (
              <>
                <p
                  className={clsx("tw:text-sm tw:font-medium tw:text-gray-900")}
                >
                  Error deleting Payment Request <em>{rebate.rebateId}</em>.
                </p>
                <p className={clsx("tw:mt-1 tw:text-sm tw:text-gray-500")}>
                  Please notify the helpdesk that a problem exists preventing
                  the deletion of Payment Request form submission{" "}
                  <em>{rebate.rebateId}</em>.
                </p>
              </>
            ),
          });

          // NOTE: logging rebate for helpdesk debugging purposes
          console.log(rebate);
          return;
        }

        displayInfoNotification({
          id: Date.now(),
          body: (
            <p className={clsx("tw:text-sm tw:font-medium tw:text-gray-900")}>
              Deleting Payment Request <em>{rebate.rebateId}</em>...
            </p>
          ),
        });

        const url = `${serverUrl}/api/formio/2023/delete-prf-submission`;

        postData(url, {
          mongoId: prf._id,
          rebateId: prfRebateId,
          comboKey: prfComboKey,
        })
          .then((_res) => {
            window.location.reload();
          })
          .catch((_err) => {
            displayErrorNotification({
              id: Date.now(),
              body: (
                <>
                  <p
                    className={clsx(
                      "tw:text-sm tw:font-medium tw:text-gray-900",
                    )}
                  >
                    Error deleting Payment Request <em>{rebate.rebateId}</em>.
                  </p>
                  <p className={clsx("tw:mt-1 tw:text-sm tw:text-gray-500")}>
                    Please reload the page to attempt the deletion again, or
                    contact the helpdesk if the problem persists.
                  </p>
                </>
              ),
            });
          });
      },
      dismissedAction: () => {
        return navigate(`/prf/2023/${rebate.rebateId}`, {
          viewTransition: true,
        });
      },
    });

    return null;
  }

  return (
    <div className="margin-top-2">
      <div className="margin-top-4">
        <MarkdownContent
          children={
            submission.state === "draft"
              ? staticContent.draftFRFIntro
              : submission.state === "submitted"
                ? staticContent.submittedFRFIntro
                : ""
          }
        />
      </div>

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

        {rebate?.frf.bap?.rebateId && (
          <li className="usa-icon-list__item">
            <div className="usa-icon-list__icon text-primary">
              <svg className="usa-icon" aria-hidden="true" role="img">
                <use href={`${icons}#local_offer`} />
              </svg>
            </div>
            <div className="usa-icon-list__content">
              <strong>Rebate ID:</strong> {rebate.frf.bap.rebateId}
            </div>
          </li>
        )}
      </ul>

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
          url={`${serverUrl}/api/formio/2023/s3/frf/${mongoId}/${frfComboKey}`}
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
              ...onSubmitParam,
              metadata: {
                ...onSubmitParam.metadata,
                "csb-form-submission-state": onSubmitParam.state,
              },
              data,
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
                          Application <em>{mongoId}</em> submitted successfully.
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
                        <>Error submitting Application form.</>
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
              ...onNextPageParams.submission,
              data,
              state: "draft",
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
    </div>
  );
}
