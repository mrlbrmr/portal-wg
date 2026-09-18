import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import InternalShell from "@/components/internal/InternalShell";
import { createClient } from "@/lib/supabase/server";
import { OPEN_JOB_REQUEST_STATUSES } from "@/types/job-requests";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  // Badge do menu: requisições de vaga que ainda dependem do RH.
  const supabase = await createClient();
  const { count } = await supabase
    .from("job_requests")
    .select("id", { count: "exact", head: true })
    .in("status", OPEN_JOB_REQUEST_STATUSES);

  return (
    <InternalShell user={session.user} pendingRequests={count ?? 0}>
      {children}
    </InternalShell>
  );
}
