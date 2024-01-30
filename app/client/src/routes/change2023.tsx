import { useMemo } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

export function Change2023() {
  const { email } = useOutletContext<{ email: string }>();
  /* ensure user verification (JWT refresh) doesn't cause form to re-render */
  return useMemo(() => {
    return <ChangeForm email={email} />;
  }, [email]);
}

function ChangeForm(props: { email: string }) {
  const { email } = props;

  const navigate = useNavigate();
  const { formType } = useParams<"formType">(); // frf | prf | crf
  const { rebateId } = useParams<"rebateId">(); // CSB Rebate ID (6 digits)

  console.log({ formType, rebateId, email }); // TEMP

  if (!["frf", "prf", "crf"].includes(formType as string)) {
    navigate("/");
  }

  return (
    <>
      <p>Change Request Form!</p>
    </>
  );
}
