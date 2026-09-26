import type { Locale } from "../locales";
import type { StudioStrings } from "./en";

export async function loadStudioStrings(locale: Locale): Promise<StudioStrings> {
  switch (locale) {
    case "es":
      return (await import("./es")).default;
    case "pt":
      return (await import("./pt")).default;
    case "id":
      return (await import("./id")).default;
    default:
      return (await import("./en")).default;
  }
}