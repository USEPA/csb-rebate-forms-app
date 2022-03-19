import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
// ---
import { useApiState, fetchData } from "contexts/api";

type State =
  | { status: "idle"; data: { jsonSchema: null; submissionData: null } }
  | { status: "pending"; data: { jsonSchema: null; submissionData: null } }
  | { status: "success"; data: { jsonSchema: object; submissionData: object } }
  | { status: "failure"; data: { jsonSchema: null; submissionData: null } };

export default function Form() {
  const { id } = useParams<"id">();
  const { apiUrl } = useApiState();

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

    fetchData(`${apiUrl}/api/v1/rebate-form-submission/${id}`)
      .then((res) => {
        setRebateFormSubmission({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        console.error("Error fetching form submissions");
        setRebateFormSubmission({
          status: "failure",
          data: {
            jsonSchema: null,
            submissionData: null,
          },
        });
      });
  }, [apiUrl, id]);

  if (rebateFormSubmission.status === "idle") {
    return null;
  }

  if (rebateFormSubmission.status === "pending") {
    return <p>Loading...</p>;
  }

  if (rebateFormSubmission.status === "failure") {
    return <p>Error</p>;
  }

  const { jsonSchema, submissionData } = rebateFormSubmission.data;

  // TODO: add @formio/react and render form
  console.log("JSON Schema:", jsonSchema);
  console.log("Submitted Data:", submissionData);

  return (
    <div className="margin-top-2 bg-base-lightest">
      <div className="padding-9 text-center">
        <p className="margin-0">
          Placeholder for form submission <strong>{id}</strong>
          <br />
          <small>
            (View the console for form JSON schema and submitted data)
          </small>
        </p>
      </div>
    </div>
  );
}
