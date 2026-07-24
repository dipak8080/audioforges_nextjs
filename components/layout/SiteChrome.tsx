"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CookieConsent } from "./CookieConsent";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Admin dashboard pages own their own full-bleed layout (own header,
  // own background) - the public site's Navbar/Footer/cookie banner
  // would be redundant chrome on an internal tool nobody but the site
  // owner ever sees.
  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
      <CookieConsent />
    </>
  );
}