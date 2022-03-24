import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Form } from "@formio/react";
// ---
import { serverUrl, fetchData } from "../config";
import Loading from "components/loading";
import Message from "components/message";

type State =
  | { status: "idle"; data: { jsonSchema: null; submissionData: null } }
  | { status: "pending"; data: { jsonSchema: null; submissionData: null } }
  | { status: "success"; data: { jsonSchema: object; submissionData: object } }
  | { status: "failure"; data: { jsonSchema: null; submissionData: null } };

export default function ExistingRebateForm() {
  const { id } = useParams<"id">();

  const [rebateFormSubmission, setRebateFormSubmission] = useState<State>({
    status: "idle",
    data: {
      jsonSchema: null,
      submissionData: null,
    },
  });

  useEffect(() => {
    setRebateFormSubmission({
      status: "pending",
      data: {
        jsonSchema: null,
        submissionData: null,
      },
    });

    fetchData(`${serverUrl}/api/v1/rebate-form-submission/${id}`)
      .then((res) => {
        setRebateFormSubmission({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setRebateFormSubmission({
          status: "failure",
          data: {
            jsonSchema: null,
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

  if (rebateFormSubmission.status === "failure") {
    return <Message type="error" text={`Error loading rebate form ${id}.`} />;
  }

  const { jsonSchema, submissionData } = rebateFormSubmission.data;

  return (
    <div className="margin-top-2">
      <Form form={jsonSchema} submission={submissionData} />
    </div>
  );
}
