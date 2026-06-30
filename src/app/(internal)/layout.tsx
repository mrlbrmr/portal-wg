import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import InternalHeader from "@/components/internal/InternalHeader";
import InternalSidebar from "@/components/internal/InternalSidebar";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-wg-dark">
      <InternalHeader user={session.user} />
      <div className="flex">
        <InternalSidebar role={session.user.role} />
        <main className="flex-1 p-6 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
