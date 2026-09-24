"use client";

import { ArrowLeft, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DodoCheckout } from "./DodoCheckout";
import {
  PAYMENTS_PAUSED,
  PAYMENTS_PAUSED_BODY,
  PAYMENTS_PAUSED_TITLE,
} from "@/lib/credits/payments-status";
import type { CreditPack } from "@/lib/types/credits";

interface Props {
  pack: CreditPack;
  onBack: () => void;
  onPurchased?: () => void;
}

export function CheckoutStep({ pack, onBack, onPurchased }: Props) {
  if (PAYMENTS_PAUSED) {
    return (
      <>
        <h2 id="credit-gate-title" className="mb-1 text-lg font-semibold text-text-primary">
          {PAYMENTS_PAUSED_TITLE}
        </h2>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-graphite-800 bg-graphite-900/60 px-4 py-3.5">
          <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <p className="text-sm leading-relaxed text-text-muted">{PAYMENTS_PAUSED_BODY}</p>
        </div>

        <Button variant="ghost" size="sm" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to packs
        </Button>
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

      <DodoCheckout pack={pack} onComplete={() => onPurchased?.()} />

      <Button variant="ghost" size="sm" onClick={onBack} className="mt-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
        Back to packs
      </Button>
    </>
  );
}