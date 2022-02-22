import { useParams } from "react-router-dom";
// ---
import NotFound from "routes/notFound";
import { getRebate } from "../data";

function Rebate() {
  const { id } = useParams<"id">();
  const rebate = getRebate(parseInt(id!, 10));
  if (!rebate) return <NotFound />;

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
