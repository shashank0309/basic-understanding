import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { SubmitClient } from "./SubmitClient";

export default async function SubmitPage() {
  const user = await currentUser();
  const fns = await db.function.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <div>
        <h1>Submit a business problem</h1>
        <p className="muted">Tell us about the problem, not the solution. It takes about 10 minutes. We check for similar requests and find the best route for you.</p>
      </div>
      <SubmitClient functions={fns.map((f) => ({ id: f.id, name: f.name }))} defaultFunctionId={user.functionId ?? fns[0]?.id ?? ""} />
    </div>
  );
}
