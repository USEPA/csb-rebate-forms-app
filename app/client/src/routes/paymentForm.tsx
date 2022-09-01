import { useParams } from "react-router-dom";

export function PaymentForm() {
  const { id } = useParams<"id">();

  return (
    <>
      <p>Payment Form {id}</p>
    </>
  );
}
