/**
 * One switch for the whole money path. Paused unless NEXT_PUBLIC_PAYMENTS_PAUSED
 * is exactly "false", so a missing env var can never open checkout by accident.
 */
export const PAYMENTS_PAUSED = process.env.NEXT_PUBLIC_PAYMENTS_PAUSED !== "false";

export const PAYMENTS_PAUSED_TITLE = "Payments are paused";

export const PAYMENTS_PAUSED_BODY =
  "Buying credits is off for a short while. Credits you already have still work, and every free tool is untouched.";