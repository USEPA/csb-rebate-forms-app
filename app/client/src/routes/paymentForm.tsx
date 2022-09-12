import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Form } from "@formio/react";
import icons from "uswds/img/sprite.svg";
// ---
import { serverUrl, getData } from "../config";
import { Loading } from "components/loading";
import { Message } from "components/message";

type FormSchema =
  | { status: "idle"; data: null }
  | { status: "pending"; data: null }
  | { status: "success"; data: object }
  | { status: "failure"; data: null };

export function PaymentForm() {
  const { id } = useParams<"id">();

  const [paymentFormSchema, setPaymentFormSchema] = useState<FormSchema>({
    status: "idle",
    data: null,
  });

  useEffect(() => {
    getData(`${serverUrl}/api/formio-payment-request-schema`)
      .then((res) => setPaymentFormSchema({ status: "success", data: res }))
      .catch((err) => setPaymentFormSchema({ status: "failure", data: null }));
  }, []);

  if (
    paymentFormSchema.status === "idle" ||
    paymentFormSchema.status === "pending"
  ) {
    return <Loading />;
  }

  if (paymentFormSchema.status === "failure") {
    return (
      <Message type="error" text="Error loading Payment Request form schema." />
    );
  }

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
            <strong>Rebate ID:</strong> {id}
          </div>
        </li>
      </ul>

      <Form form={paymentFormSchema.data} />
    </div>
  );
}
