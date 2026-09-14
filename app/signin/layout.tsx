import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Move credits you already bought onto this device. Enter the email you paid with and we send a sign-in link.",
  alternates: { canonical: `${SITE_URL}/signin` },
  robots: { index: false, follow: true },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}