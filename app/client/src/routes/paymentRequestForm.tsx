import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Formio, Form } from "@formio/react";
import { cloneDeep, isEqual } from "lodash";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, getData, postData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { MarkdownContent } from "components/markdownContent";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import { useBapState } from "contexts/bap";
import {
  FormioSubmissionData,
  FormioFetchedResponse,
  usePageState,
  usePageDispatch,
} from "contexts/page";

export function PaymentRequestForm() {
  const navigate = useNavigate();
  const { rebateId } = useParams<"rebateId">(); // CSB Rebate ID (6 digits)

  const { content } = useContentState();
  const { epaUserData } = useUserState();
  const { csbData } = useCsbState();
  const { samEntities } = useBapState();
  const { message, formio } = usePageState();
  const dispatch = usePageDispatch();

  // reset page context state
  useEffect(() => {
    dispatch({ type: "RESET_STATE" });
  }, [dispatch]);

  // set when form submission data is initially fetched, and then re-set each
  // time a successful update of the submission data is posted to forms.gov
  const [storedSubmissionData, setStoredSubmissionData] =
    useState<FormioSubmissionData>({});

  // create ref to storedSubmissionData, so the latest value can be referenced
  // in the Form component's `onNextPage` event prop
  const storedSubmissionDataRef = useRef(storedSubmissionData);

  // initially empty, but will be set once the user attemts to submit the form
  // (both successfully and unsuccessfully). passed to the to the <Form />
  // component's submission prop, so the fields the user filled out will not be
  // lost if a submission update fails, so the user can attempt submitting again
  const [pendingSubmissionData, setPendingSubmissionData] =
    useState<FormioSubmissionData>({});

  useEffect(() => {
    dispatch({ type: "FETCH_FORMIO_DATA_REQUEST" });

    getData(`${serverUrl}/api/formio-payment-request-submission/${rebateId}`)
      .then((res: FormioFetchedResponse) => {
        if (!res.submission) return;

        // set up s3 re-route to wrapper app
        const s3Provider = Formio.Providers.providers.storage.s3;
        Formio.Providers.providers.storage.s3 = function (formio: any) {
          const s3Formio = cloneDeep(formio);
          const mongoId = res.submission._id;
          const comboKey = res.submission.data.bap_hidden_entity_combo_key;
          s3Formio.formUrl = `${serverUrl}/api/${mongoId}/${comboKey}`;
          return s3Provider(s3Formio);
        };

        const data = { ...res.submission.data };

        setStoredSubmissionData((prevData) => {
          storedSubmissionDataRef.current = data;
          return data;
        });

        dispatch({
          type: "FETCH_FORMIO_DATA_SUCCESS",
          payload: { data: res },
        });
      })
      .catch((err) => {
        dispatch({ type: "FETCH_FORMIO_DATA_FAILURE" });
      });
  }, [rebateId, dispatch]);

  if (formio.status === "idle") {
    return null;
  }

  if (formio.status === "pending") {
    return <Loading />;
  }

  const { userAccess, formSchema, submission } = formio.data;

  if (
    formio.status === "failure" ||
    !userAccess ||
    !formSchema ||
    !submission
  ) {
    return (
      <Message
        type="error"
        text="The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake."
      />
    );
  }

  if (
    csbData.status !== "success" ||
    epaUserData.status !== "success" ||
    samEntities.status !== "success"
  ) {
    return <Loading />;
  }

  const entityComboKey = storedSubmissionData.bap_hidden_entity_combo_key;
  const entity = samEntities.data.entities.find((entity) => {
    return (
      entity.ENTITY_STATUS__c === "Active" &&
      entity.ENTITY_COMBO_KEY__c === entityComboKey
    );
  });

  if (!entity) return null;

  const email = epaUserData.data.mail;
  const { title, name } = getUserInfo(email, entity);

  return (
    <div className="margin-top-2">
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submission.state === "draft"
              ? content.data?.draftPaymentRequestIntro || ""
              : submission.state === "submitted"
              ? content.data?.submittedPaymentRequestIntro || ""
              : ""
          }
        />
      )}

      {message.displayed && <Message type={message.type} text={message.text} />}

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
              ...storedSubmissionData,
              last_updated_by: email,
              hidden_current_user_email: email,
              hidden_current_user_title: title,
              hidden_current_user_name: name,
              ...pendingSubmissionData,
            },
          }}
          options={{
            readOnly: submission.state === "submitted",
            noAlerts: true,
          }}
          onSubmit={(onSubmitSubmission: {
            state: "submitted" | "draft";
            data: FormioSubmissionData;
            metadata: unknown;
          }) => {
            const data = { ...onSubmitSubmission.data };

            if (onSubmitSubmission.state === "submitted") {
              dispatch({
                type: "DISPLAY_MESSAGE",
                payload: { type: "info", text: "Submitting form..." },
              });
            }

            if (onSubmitSubmission.state === "draft") {
              dispatch({
                type: "DISPLAY_MESSAGE",
                payload: { type: "info", text: "Saving form..." },
              });
            }

            setPendingSubmissionData(data);

            postData(
              `${serverUrl}/api/formio-payment-request-submission/${rebateId}`,
              {
                mongoId: formio.data.submission?._id,
                submission: { ...onSubmitSubmission, data },
              }
            )
              .then((res) => {
                setStoredSubmissionData((prevData) => {
                  storedSubmissionDataRef.current = res.data;
                  return res.data;
                });

                setPendingSubmissionData({});

                if (onSubmitSubmission.state === "submitted") {
                  dispatch({
                    type: "DISPLAY_MESSAGE",
                    payload: {
                      type: "success",
                      text: "Form successfully submitted.",
                    },
                  });

                  setTimeout(() => {
                    dispatch({ type: "RESET_MESSAGE" });
                    navigate("/");
                  }, 5000);
                  return;
                }

                if (onSubmitSubmission.state === "draft") {
                  dispatch({
                    type: "DISPLAY_MESSAGE",
                    payload: {
                      type: "success",
                      text: "Draft successfully saved.",
                    },
                  });

                  setTimeout(() => {
                    dispatch({ type: "RESET_MESSAGE" });
                  }, 5000);
                }
              })
              .catch((err) => {
                dispatch({
                  type: "DISPLAY_MESSAGE",
                  payload: {
                    type: "error",
                    text: "Error submitting Payment Request form.",
                  },
                });
              });
          }}
          onNextPage={(onNextPageParam: {
            page: number;
            submission: {
              data: FormioSubmissionData;
              metadata: unknown;
            };
          }) => {
            const data = { ...onNextPageParam.submission.data };

            // don't post an update if form is not in draft state
            // (form has been already submitted, and fields are read-only)
            if (submission.state !== "draft") return;

            // don't post an update if no changes have been made to the form
            // (ignoring current user fields)
            const dataToCheck = { ...data };
            delete dataToCheck.hidden_current_user_email;
            delete dataToCheck.hidden_current_user_title;
            delete dataToCheck.hidden_current_user_name;
            const storedDataToCheck = { ...storedSubmissionDataRef.current };
            delete storedDataToCheck.hidden_current_user_email;
            delete storedDataToCheck.hidden_current_user_title;
            delete storedDataToCheck.hidden_current_user_name;
            if (isEqual(dataToCheck, storedDataToCheck)) return;

            dispatch({
              type: "DISPLAY_MESSAGE",
              payload: { type: "info", text: "Saving form..." },
            });

            setPendingSubmissionData(data);

            postData(
              `${serverUrl}/api/formio-payment-request-submission/${rebateId}`,
              {
                mongoId: formio.data.submission?._id,
                submission: {
                  ...onNextPageParam.submission,
                  data,
                  state: "draft",
                },
              }
            )
              .then((res) => {
                setStoredSubmissionData((prevData) => {
                  storedSubmissionDataRef.current = res.data;
                  return res.data;
                });

                setPendingSubmissionData({});

                dispatch({
                  type: "DISPLAY_MESSAGE",
                  payload: {
                    type: "success",
                    text: "Draft successfully saved.",
                  },
                });

                setTimeout(() => {
                  dispatch({ type: "RESET_MESSAGE" });
                }, 5000);
              })
              .catch((err) => {
                dispatch({
                  type: "DISPLAY_MESSAGE",
                  payload: {
                    type: "error",
                    text: "Error saving draft Payment Request form.",
                  },
                });
              });
          }}
        />
      </div>

      {message.displayed && <Message type={message.type} text={message.text} />}
    </div>
  );
}
