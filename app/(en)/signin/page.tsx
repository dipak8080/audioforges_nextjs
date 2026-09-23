import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { SignInForm } from "./SignInForm";

const PAGE_TITLE = "Sign in";
const PAGE_DESCRIPTION =
  "Move credits you already bought onto this device. Enter the email you paid with and we send a sign-in link.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/signin` },
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return <SignInForm />;
}