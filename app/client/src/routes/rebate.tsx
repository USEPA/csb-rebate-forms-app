import { useParams } from "react-router-dom";
// ---
import { getRebate } from "../data";

function Rebate() {
  const { rebateId } = useParams<"rebateId">();
  const rebate = getRebate(parseInt(rebateId!, 10));
  if (!rebate) return null;

  return (
    <div>
      <p>
        <strong>{rebate.name}</strong> <small>({rebate.id})</small>
      </p>
      <p>{rebate.text}</p>
    </div>
  );
}

export default Rebate;
