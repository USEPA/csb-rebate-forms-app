import {
  Dispatch,
  ReactNode,
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Formio, Form } from "@formio/react";
import { cloneDeep, isEqual } from "lodash";
// ---
import { serverUrl, fetchData } from "../config";
import { getUserInfo } from "../utilities";
import Loading from "components/loading";
import Message from "components/message";
import MarkdownContent from "components/markdownContent";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";

// -----------------------------------------------------------------------------

type Props = {
  children: ReactNode;
};

type State = {
  displayed: boolean;
  type: "info" | "success" | "warning" | "error";
  text: string;
};

type Action =
  | {
      type: "DISPLAY_INFO_MESSAGE";
      payload: { text: string };
    }
  | {
      type: "DISPLAY_SUCCESS_MESSAGE";
      payload: { text: string };
    }
  | {
      type: "DISPLAY_WARNING_MESSAGE";
      payload: { text: string };
    }
  | {
      type: "DISPLAY_ERROR_MESSAGE";
      payload: { text: string };
    }
  | { type: "RESET_MESSAGE" };

const StateContext = createContext<State | undefined>(undefined);
const DispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "DISPLAY_INFO_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "info",
        text,
      };
    }

    case "DISPLAY_SUCCESS_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "success",
        text,
      };
    }

    case "DISPLAY_WARNING_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "warning",
        text,
      };
    }

    case "DISPLAY_ERROR_MESSAGE": {
      const { text } = action.payload;
      return {
        ...state,
        displayed: true,
        type: "error",
        text,
      };
    }

    case "RESET_MESSAGE": {
      return {
        ...state,
        displayed: false,
        type: "info",
        text: "",
      };
    }

    default: {
      throw new Error(`Unhandled action type: ${action}`);
    }
  }
}

function ExistingRebateProvider({ children }: Props) {
  const initialState: State = {
    displayed: false,
    type: "info",
    text: "",
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

/**
 * Returns state stored in `ExistingRebateProvider` context component.
 */
function useExistingRebateState() {
  const context = useContext(StateContext);
  if (context === undefined) {
    throw new Error(
      "useExistingRebateState must be called within a ExistingRebateProvider"
    );
  }
  return context;
}

/**
 * Returns `dispatch` method for dispatching actions to update state stored in
 * `ExistingRebateProvider` context component.
 */
function useExistingRebateDispatch() {
  const context = useContext(DispatchContext);
  if (context === undefined) {
    throw new Error(
      "useExistingRebateDispatch must be used within a ExistingRebateProvider"
    );
  }
  return context;
}

// -----------------------------------------------------------------------------

export default function ExistingRebate() {
  return (
    <ExistingRebateProvider>
      <ExistingRebateContent />
    </ExistingRebateProvider>
  );
}

// -----------------------------------------------------------------------------

type FormioSubmissionData = {
  // NOTE: more fields are in a form.io submission,
  // but we're only concerned with the fields below
  bap_hidden_entity_combo_key?: string;
  ncesDataSource?: string;
  // (other fields...)
};

type SubmissionState =
  | {
      status: "idle";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "pending";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    }
  | {
      status: "success";
      data:
        | {
            userAccess: true;
            formSchema: { url: string; json: object };
            submissionData: {
              // NOTE: more fields are in a form.io submission,
              // but we're only concerned with the fields below
              _id: string;
              data: object;
              state: "submitted" | "draft";
              // (other fields...)
            };
          }
        | {
            userAccess: false;
            formSchema: null;
            submissionData: null;
          };
    }
  | {
      status: "failure";
      data: {
        userAccess: false;
        formSchema: null;
        submissionData: null;
      };
    };

function FormMessage() {
  const { displayed, type, text } = useExistingRebateState();
  if (!displayed) return null;
  return <Message type={type} text={text} />;
}

function ExistingRebateContent() {
  const navigate = useNavigate();
  const { id } = useParams<"id">();
  const { content } = useContentState();
  const { epaUserData, samUserData } = useUserState();
  const dispatch = useExistingRebateDispatch();

  const [rebateFormSubmission, setRebateFormSubmission] =
    useState<SubmissionState>({
      status: "idle",
      data: {
        userAccess: false,
        formSchema: null,
        submissionData: null,
      },
    });

  // set when rebate form submission data is initially fetched, and then re-set
  // each time a successful update of the submission data is posted to forms.gov
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
    setRebateFormSubmission({
      status: "pending",
      data: {
        userAccess: false,
        formSchema: null,
        submissionData: null,
      },
    });

    fetchData(`${serverUrl}/api/rebate-form-submission/${id}`)
      .then((res) => {
        // Set up s3 re-route to wrapper app
        const s3Provider = Formio.Providers.providers.storage.s3;
        Formio.Providers.providers.storage.s3 = function (formio: any) {
          const s3Formio = cloneDeep(formio);
          s3Formio.formUrl = `${serverUrl}/api/${res.submissionData.data.bap_hidden_entity_combo_key}`;
          return s3Provider(s3Formio);
        };

        const data = { ...res.submissionData.data };
        if (data.hasOwnProperty("ncesDataSource")) {
          delete data.ncesDataSource;
        }

        setStoredSubmissionData((prevData) => {
          storedSubmissionDataRef.current = data;
          return data;
        });

        setRebateFormSubmission({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setRebateFormSubmission({
          status: "failure",
          data: {
            userAccess: false,
            formSchema: null,
            submissionData: null,
          },
        });
      });
  }, [id]);

  if (rebateFormSubmission.status === "idle") {
    return null;
  }

  if (rebateFormSubmission.status === "pending") {
    return <Loading />;
  }

  const { userAccess, formSchema, submissionData } = rebateFormSubmission.data;

  if (
    rebateFormSubmission.status === "failure" ||
    !userAccess ||
    !formSchema ||
    !submissionData
  ) {
    return (
      <Message
        type="error"
        text="The requested submission does not exist, or you do not have access. Please contact support if you believe this is a mistake."
      />
    );
  }

  if (epaUserData.status !== "success" || samUserData.status !== "success") {
    return <Loading />;
  }

  const entityComboKey = storedSubmissionData.bap_hidden_entity_combo_key;
  const record = samUserData.data.records.find((record) => {
    return (
      record.ENTITY_STATUS__c === "Active" &&
      record.ENTITY_COMBO_KEY__c === entityComboKey
    );
  });

  if (!record) return null;

  const email = epaUserData.data.mail;
  const { title, name } = getUserInfo(email, record);

  return (
    <div className="margin-top-2">
      {content.status === "success" && (
        <MarkdownContent
          className="margin-top-4"
          children={
            submissionData.state === "draft"
              ? content.data?.draftRebateIntro || ""
              : submissionData.state === "submitted"
              ? content.data?.submittedRebateIntro || ""
              : ""
          }
        />
      )}

      <FormMessage />

      <h3>Application ID: {submissionData._id}</h3>

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
            readOnly: submissionData.state === "submitted" ? true : false,
            noAlerts: true,
          }}
          onSubmit={(submission: {
            state: "submitted" | "draft";
            data: FormioSubmissionData;
            metadata: object;
          }) => {
            const data = { ...submission.data };
            if (data.hasOwnProperty("ncesDataSource")) {
              delete data.ncesDataSource;
            }

            if (submission.state === "submitted") {
              dispatch({
                type: "DISPLAY_INFO_MESSAGE",
                payload: { text: "Submitting form..." },
              });
            }

            if (submission.state === "draft") {
              dispatch({
                type: "DISPLAY_INFO_MESSAGE",
                payload: { text: "Saving form..." },
              });
            }

            setPendingSubmissionData(data);

            fetchData(
              `${serverUrl}/api/rebate-form-submission/${submissionData._id}`,
              { ...submission, data }
            )
              .then((res) => {
                setStoredSubmissionData((prevData) => {
                  storedSubmissionDataRef.current = res.data;
                  return res.data;
                });

                setPendingSubmissionData({});

                if (submission.state === "submitted") {
                  dispatch({
                    type: "DISPLAY_SUCCESS_MESSAGE",
                    payload: { text: "Form successfully submitted." },
                  });

                  setTimeout(() => {
                    dispatch({ type: "RESET_MESSAGE" });
                    navigate("/");
                  }, 5000);
                  return;
                }

                if (submission.state === "draft") {
                  dispatch({
                    type: "DISPLAY_SUCCESS_MESSAGE",
                    payload: { text: "Draft successfully saved." },
                  });

                  setTimeout(() => {
                    dispatch({ type: "RESET_MESSAGE" });
                  }, 5000);
                }
              })
              .catch((err) => {
                dispatch({
                  type: "DISPLAY_ERROR_MESSAGE",
                  payload: { text: "Error submitting rebate form." },
                });
              });
          }}
          onNextPage={({
            page,
            submission,
          }: {
            page: number;
            submission: {
              data: FormioSubmissionData;
              metadata: object;
            };
          }) => {
            const data = { ...submission.data };
            if (data.hasOwnProperty("ncesDataSource")) {
              delete data.ncesDataSource;
            }

            // don't post an update if form is not in draft state
            // or if no changes have been made to the form
            if (submissionData.state !== "draft") return;
            if (isEqual(data, storedSubmissionDataRef.current)) return;

            dispatch({
              type: "DISPLAY_INFO_MESSAGE",
              payload: { text: "Saving form..." },
            });

            setPendingSubmissionData(data);

            fetchData(
              `${serverUrl}/api/rebate-form-submission/${submissionData._id}`,
              { ...submission, data, state: "draft" }
            )
              .then((res) => {
                setStoredSubmissionData((prevData) => {
                  storedSubmissionDataRef.current = res.data;
                  return res.data;
                });

                setPendingSubmissionData({});

                dispatch({
                  type: "DISPLAY_SUCCESS_MESSAGE",
                  payload: { text: "Draft successfully saved." },
                });

                setTimeout(() => {
                  dispatch({ type: "RESET_MESSAGE" });
                }, 5000);
              })
              .catch((err) => {
                dispatch({
                  type: "DISPLAY_ERROR_MESSAGE",
                  payload: { text: "Error saving draft rebate form." },
                });
              });
          }}
        />
      </div>

      <FormMessage />
    </div>
  );
}
