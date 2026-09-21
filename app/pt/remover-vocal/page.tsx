import type { Metadata } from "next";
import { LocalizedVocalRemoverPage } from "@/components/tools/LocalizedVocalRemoverPage";
import { ptDict, vocalRemoverLanguageAlternates } from "@/lib/i18n/vocal-remover";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { ogForTool } from "@/lib/og";

const OG_IMAGE = ogForTool("vocal-remover", ptDict.ogTitle);

export const metadata: Metadata = {
  title: { absolute: ptDict.pageTitle },
  description: ptDict.pageDescription,
  alternates: {
    canonical: `${SITE_URL}${ptDict.path}`,
    languages: vocalRemoverLanguageAlternates,
  },
  openGraph: {
    title: ptDict.pageTitle,
    description: ptDict.pageDescription,
    url: `${SITE_URL}${ptDict.path}`,
    siteName: SITE_NAME,
    type: "website",
    locale: "pt_BR",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: ptDict.pageTitle,
    description: ptDict.pageDescription,
    images: [OG_IMAGE.url],
  },
};

export default function RemoverVocalPage() {
  return <LocalizedVocalRemoverPage dict={ptDict} />;
}