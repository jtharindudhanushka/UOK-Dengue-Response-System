import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/dashboard/triage");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "var(--color-canvas)",
      }}
    >
      <Header />
      <main style={{ flex: 1, paddingTop: "56px" }}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
