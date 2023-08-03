import { useMemo } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

export function FRF2023() {
  const { email } = useOutletContext<{ email: string }>();
  /* ensure user verification (JWT refresh) doesn't cause form to re-render */
  return useMemo(() => {
    return <FundingRequestForm email={email} />;
  }, [email]);
}

function FundingRequestForm(props: { email: string }) {
  const { email } = props;

  const navigate = useNavigate();
  const { id: mongoId } = useParams<"id">(); // MongoDB ObjectId string

  return (
    <>
      <p>(Placeholder for 2023 Funding Request form)</p>
    </>
  );
}
