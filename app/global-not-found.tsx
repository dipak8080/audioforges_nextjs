import type { Metadata } from "next";
import { RootDocument, rootMetadata, rootViewport } from "@/components/layout/RootDocument";
import { NotFoundContent } from "@/components/layout/NotFoundContent";
import "@/app/globals.css";

export const viewport = rootViewport;

export const metadata: Metadata = {
  ...rootMetadata,
  title: "Page not found | AudioForges",
  description: "That page does not exist. Browse the free audio tools and guides instead.",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <RootDocument lang="en">
      <NotFoundContent />
    </RootDocument>
  );
}