import type { Metadata } from "next";
import { AdminShell } from "./_components/AdminShell";

// Server wrapper so the admin area can set its own tab title. The UI
// itself is a client component in AdminShell.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}