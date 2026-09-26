"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CreditProvider } from "@/components/credits/CreditProvider";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { StudioPreviewBadge } from "@/components/studio/StudioPreviewBadge";
import { ReferralCapture } from "@/components/studio/ReferralCapture";
import type { PaywallFlags } from "@/lib/types/credits";
import type { Locale } from "@/lib/i18n/locales";
import type { StudioStrings } from "@/lib/i18n/studio/en";

export function SiteChrome({
  flags,
  locale,
  strings,
  children,
}: {
  flags: PaywallFlags;
  locale: Locale;
  strings: StudioStrings;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Admin dashboard pages own their own full-bleed layout (own header,
  // own background) - the public site's Navbar/Footer would be
  // redundant chrome on an internal tool nobody but the site owner
  // ever sees.
  if (isAdminRoute) {
    return (
      <I18nProvider locale={locale} strings={strings}>
        <CreditProvider flags={flags}>{children}</CreditProvider>
      </I18nProvider>
    );
  }

  return (
    <I18nProvider locale={locale} strings={strings}>
      <CreditProvider flags={flags}>
        <Navbar paywallEnabled={flags.paywallEnabled} />
        <div className="flex-1">{children}</div>
        <Footer paywallEnabled={flags.paywallEnabled} />
        <StudioPreviewBadge />
        <ReferralCapture />
      </CreditProvider>
    </I18nProvider>
  );
}