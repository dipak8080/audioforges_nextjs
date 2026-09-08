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

  // Embed routes are served inside someone else's page in an iframe. The
  // navbar and footer would be a second site's chrome inside their article,
  // and the widget carries its own attribution link instead.
  const isEmbedRoute = pathname?.startsWith("/embed/");

  // Admin dashboard pages own their own full-bleed layout (own header,
  // own background) - the public site's Navbar/Footer would be
  // redundant chrome on an internal tool nobody but the site owner
  // ever sees.
  if (isAdminRoute || isEmbedRoute) {
    return <CreditProvider flags={flags}>{children}</CreditProvider>;
  }

  return (
    <CreditProvider flags={flags}>
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer paywallEnabled={flags.paywallEnabled} />
    </CreditProvider>
  );
}