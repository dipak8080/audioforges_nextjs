import type { Metadata } from "next";
import { LocalizedVocalRemoverPage } from "@/components/tools/LocalizedVocalRemoverPage";
import { idDict, vocalRemoverLanguageAlternates } from "@/lib/i18n/vocal-remover";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { ogForTool } from "@/lib/og";

const OG_IMAGE = ogForTool("vocal-remover", idDict.ogTitle);

export const metadata: Metadata = {
  title: { absolute: idDict.pageTitle },
  description: idDict.pageDescription,
  alternates: {
    canonical: `${SITE_URL}${idDict.path}`,
    languages: vocalRemoverLanguageAlternates,
  },
  openGraph: {
    title: idDict.pageTitle,
    description: idDict.pageDescription,
    url: `${SITE_URL}${idDict.path}`,
    siteName: SITE_NAME,
    type: "website",
    locale: "id_ID",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: idDict.pageTitle,
    description: idDict.pageDescription,
    images: [OG_IMAGE.url],
  },
};

export default function PenghilangVokalPage() {
  return <LocalizedVocalRemoverPage dict={idDict} />;
}