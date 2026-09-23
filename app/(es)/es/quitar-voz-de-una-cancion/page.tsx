import type { Metadata } from "next";
import { LocalizedVocalRemoverPage } from "@/components/tools/LocalizedVocalRemoverPage";
import { esDict, vocalRemoverLanguageAlternates } from "@/lib/i18n/vocal-remover";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { ogForTool } from "@/lib/og";

const OG_IMAGE = ogForTool("vocal-remover", esDict.ogTitle);

export const metadata: Metadata = {
  title: { absolute: esDict.pageTitle },
  description: esDict.pageDescription,
  alternates: {
    canonical: `${SITE_URL}${esDict.path}`,
    languages: vocalRemoverLanguageAlternates,
  },
  openGraph: {
    title: esDict.pageTitle,
    description: esDict.pageDescription,
    url: `${SITE_URL}${esDict.path}`,
    siteName: SITE_NAME,
    type: "website",
    locale: "es_ES",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: esDict.pageTitle,
    description: esDict.pageDescription,
    images: [OG_IMAGE.url],
  },
};

export default function QuitarVozPage() {
  return <LocalizedVocalRemoverPage dict={esDict} />;
}