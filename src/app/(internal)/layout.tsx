import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import InternalShell from "@/components/internal/InternalShell";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <InternalShell user={session.user}>
      {children}
    </InternalShell>
  );
}
