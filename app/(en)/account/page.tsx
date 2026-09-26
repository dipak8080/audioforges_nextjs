import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { AccountPage } from "@/components/account/AccountPage";

export const metadata: Metadata = {
  title: "Your account",
  description: "Your songs, Library, Studio Pass, email settings and invite link.",
  alternates: { canonical: `${SITE_URL}/account` },
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="px-4 py-10 sm:px-6">
      <AccountPage />
    </main>
  );
}