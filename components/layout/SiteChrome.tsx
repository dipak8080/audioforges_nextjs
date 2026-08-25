"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CreditProvider } from "@/components/credits/CreditProvider";
import type { PaywallFlags } from "@/lib/types/credits";

export function SiteChrome({
  flags,
  children,
}: {
  flags: PaywallFlags;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Admin dashboard pages own their own full-bleed layout (own header,
  // own background) - the public site's Navbar/Footer would be
  // redundant chrome on an internal tool nobody but the site owner
  // ever sees.
  //
  // The provider still wraps them: with the paywall off it's inert and
  // costs nothing, and a future admin credits widget then needs no second
  // mount point. Only the visible chrome is skipped here, not the context.
  if (isAdminRoute) {
    return <CreditProvider flags={flags}>{children}</CreditProvider>;
  }

  return (
    <CreditProvider flags={flags}>
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </CreditProvider>
  );
}