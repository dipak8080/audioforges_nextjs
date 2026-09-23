import type { Metadata } from "next";
import { NotFoundContent } from "@/components/layout/NotFoundContent";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page does not exist. Browse the free audio tools and guides instead.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundContent />;
}