import type { Metadata } from "next";

/**
 * page.tsx here is "use client", so it can't export metadata — which meant
 * this route inherited the root robots settings and was indexable. A
 * checkout-confirmation URL is thin content that only makes sense arriving
 * from Ko-fi, and it should never appear in a search result.
 *
 * /auth/verified already sets this on its own page.tsx because that one is a
 * server component. Same intent, different mechanism.
 */
export const metadata: Metadata = {
  title: "Payment confirmed",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}