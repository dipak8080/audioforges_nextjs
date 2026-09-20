"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmailCaptureStep } from "./EmailCaptureStep";
import { PayPalCheckout } from "./PayPalCheckout";
import { getPayPalConfig } from "@/lib/api/paypal";
import type { CreditPack } from "@/lib/types/credits";

type Provider = "unknown" | "paypal" | "kofi";

interface Props {
  pack: CreditPack;
  onBack: () => void;
  onPurchased?: () => void;
}

/**
 * Decides which checkout the buyer gets. PayPal keeps them on the page;
 * Ko-fi is the fallback when PayPal is not configured or its SDK cannot
 * load, so a broken card path degrades to the flow that already worked
 * rather than to nothing.
 */
export function CheckoutStep({ pack, onBack, onPurchased }: Props) {
  const [provider, setProvider] = useState<Provider>("unknown");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getPayPalConfig();
      if (cancelled) return;
      setProvider(config?.enabled && config.client_id ? "paypal" : "kofi");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (provider === "unknown") {
    return <div className="h-40" aria-hidden />;
  }

  if (provider === "kofi") {
    return (
      <>
        <h2 id="credit-gate-title" className="mb-1 text-lg font-semibold text-text-primary">
          One detail before Ko-fi
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-text-muted">
          Ko-fi doesn&apos;t tell us who paid, so we use your email to match the payment to this
          browser. No account, no password.
        </p>
        <EmailCaptureStep pack={pack} onBack={onBack} onPurchased={onPurchased} />
      </>
    );
  }

  return (
    <>
      <h2 id="credit-gate-title" className="mb-1 text-lg font-semibold text-text-primary">
        {pack.credits} credits for ${pack.price_usd.toFixed(2)}
      </h2>
      <p className="mb-5 text-sm leading-relaxed text-text-muted">
        Pay here and your credits appear straight away. No account, no password.
      </p>

      <PayPalCheckout pack={pack} onComplete={() => onPurchased?.()} />

      <Button variant="ghost" size="sm" onClick={onBack} className="mt-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
        Back to packs
      </Button>
    </>
  );
}