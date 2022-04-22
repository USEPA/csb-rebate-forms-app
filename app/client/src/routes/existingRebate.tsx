import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Form } from "@formio/react";
import { isEqual } from "lodash";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message, { useMessageState } from "components/message";
import MarkdownContent from "components/markdownContent";
import { useContentState } from "contexts/content";
import { useUserState } from "contexts/user";

type FormioSubmissionData = {
  // NOTE: more fields are in a form.io submission,
  // but we're only concerned with the fields below
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

export default function ExistingRebate() {
  const navigate = useNavigate();
  const { id } = useParams<"id">();
  const { content } = useContentState();
  const { epaUserData } = useUserState();

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

  // initially empty, but will be set once the user attemts to submit the form
  // (both succesfully and unsuccesfully). passed to the to the <Form />
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
        const data = { ...res.submissionData.data };
        if (data.hasOwnProperty("ncesDataSource")) {
          delete data.ncesDataSource;
        }

        setStoredSubmissionData(data);
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

  const {
    message,
    displayInfoMessage,
    displaySuccessMessage,
    displayErrorMessage,
    resetMessage,
  } = useMessageState();

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

  if (epaUserData.status !== "success") {
    return <Loading />;
  }

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

      {message.displayed && <Message type={message.type} text={message.text} />}

      {submissionData.state === "submitted" && (
        <h3>Application ID: {submissionData._id}</h3>
      )}

      <div className="csb-form">
        <Form
          form={formSchema.json}
          url={formSchema.url} // NOTE: used for file uploads
          submission={{
            data: {
              ...storedSubmissionData,
              last_updated_by: epaUserData.data.mail,
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
              displayInfoMessage("Submitting form...");
            }

            if (submission.state === "draft") {
              displayInfoMessage("Saving form...");
            }

            setPendingSubmissionData(data);
            fetchData(
              `${serverUrl}/api/rebate-form-submission/${submissionData._id}`,
              { ...submission, data }
            )
              .then((res) => {
                setStoredSubmissionData(res.data);
                setPendingSubmissionData({});

                if (submission.state === "submitted") {
                  displaySuccessMessage("Form succesfully submitted.");
                  setTimeout(() => navigate("/"), 5000);
                  return;
                }

                if (submission.state === "draft") {
                  displaySuccessMessage("Draft succesfully saved.");
                  setTimeout(() => resetMessage(), 5000);
                }
              })
              .catch((err) => {
                displayErrorMessage("Error submitting rebate form.");
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
            if (isEqual(data, storedSubmissionData)) return;

            displayInfoMessage("Saving form...");
            setPendingSubmissionData(data);
            fetchData(
              `${serverUrl}/api/rebate-form-submission/${submissionData._id}`,
              { ...submission, data, state: "draft" }
            )
              .then((res) => {
                setStoredSubmissionData(res.data);
                setPendingSubmissionData({});
                displaySuccessMessage("Draft succesfully saved.");
                setTimeout(() => resetMessage(), 5000);
              })
              .catch((err) => {
                displayErrorMessage("Error saving draft rebate form.");
              });
          }}
        />
      </div>

      {message.displayed && <Message type={message.type} text={message.text} />}
    </div>
  );
}
