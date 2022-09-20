import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Formio, Form } from "@formio/react";
import { cloneDeep } from "lodash";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, getData } from "../config";
import { getUserInfo } from "../utilities";
import { Loading } from "components/loading";
import { Message } from "components/message";
import { useUserState } from "contexts/user";
import { useCsbState } from "contexts/csb";
import { useBapState } from "contexts/bap";

type FormioSubmissionData = {
  [field: string]: unknown;
  hidden_current_user_email?: string;
  hidden_current_user_title?: string;
  hidden_current_user_name?: string;
  bap_hidden_entity_combo_key?: string;
};

type FormioSubmission = {
  [field: string]: unknown;
  _id: string; // MongoDB ObjectId string
  data: FormioSubmissionData;
  state: "submitted" | "draft";
};

type NoFormioData = { userAccess: false; formSchema: null; submission: null };

type SubmissionState =
  | {
      status: "idle";
      data: NoFormioData;
    }
  | {
      status: "pending";
      data: NoFormioData;
    }
  | {
      status: "success";
      data:
        | NoFormioData
        | {
            userAccess: true;
            formSchema: { url: string; json: object };
            submission: FormioSubmission;
          };
    }
  | {
      status: "failure";
      data: NoFormioData;
    };

export function PaymentRequestForm() {
  const { rebateId } = useParams<"rebateId">(); // CSB Rebate ID (6 digits)
  const { epaUserData } = useUserState();
  const { csbData } = useCsbState();
  const { samEntities } = useBapState();

  const [formioSubmission, setFormioSubmission] = useState<SubmissionState>({
    status: "idle",
    data: { userAccess: false, formSchema: null, submission: null },
  });

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
    setFormioSubmission({
      status: "pending",
      data: { userAccess: false, formSchema: null, submission: null },
    });

    getData(`${serverUrl}/api/formio-payment-request-submission/${rebateId}`)
      .then((res) => {
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

        setFormioSubmission({
          status: "success",
          data: res,
        });
      })
      .catch((err) => {
        setFormioSubmission({
          status: "failure",
          data: { userAccess: false, formSchema: null, submission: null },
        });
      });
  }, [rebateId]);

  if (formioSubmission.status === "idle") {
    return null;
  }

  if (formioSubmission.status === "pending") {
    return <Loading />;
  }

  const { userAccess, formSchema, submission } = formioSubmission.data;

  if (
    formioSubmission.status === "failure" ||
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
          onSubmit={(onSubmitSubmission: {
            state: "submitted" | "draft";
            data: FormioSubmissionData;
            metadata: unknown;
          }) => {
            const data = { ...onSubmitSubmission.data };
            console.log(data);
          }}
          onNextPage={(onNextParam: {
            page: number;
            submission: {
              data: FormioSubmissionData;
              metadata: unknown;
            };
          }) => {
            const data = { ...onNextParam.submission.data };
            console.log(data);
          }}
        />
      </div>
    </div>
  );
}
