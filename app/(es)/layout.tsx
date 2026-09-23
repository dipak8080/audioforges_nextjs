import { RootDocument, rootMetadata, rootViewport } from "@/components/layout/RootDocument";
import "@/app/globals.css";

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument lang="es">{children}</RootDocument>;
}