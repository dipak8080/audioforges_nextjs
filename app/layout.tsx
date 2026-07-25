import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { SITE_URL } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AudioForges — Free Audio Tools for Producers",
    template: "%s | AudioForges",
  },
  description:
    "Free audio tools for music producers and DJs — YouTube to WAV/MP3 conversion, key & BPM detection, and more.",
  openGraph: {
    title: "AudioForges — Free Audio Tools for Producers",
    description:
      "Free audio tools for music producers and DJs — YouTube to WAV/MP3 conversion, key & BPM detection, and more.",
    url: SITE_URL,
    siteName: "AudioForges",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AudioForges — Free Audio Tools for Producers",
    description:
      "Free audio tools for music producers and DJs — YouTube to WAV/MP3 conversion, key & BPM detection, and more.",
    images: ["/images/og-default.png"],
  },
  other: {
    "ahrefs-site-verification":
      "c1354acdd4f3553f046ae70968ed850f6cd1ce5052618ccdd4a8b660096cd308",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AudioForges",
  url: SITE_URL,
  logo: `${SITE_URL}/images/og-default.png`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-4MW6XTR9XM"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-4MW6XTR9XM');
  `}
        </Script>

        {/* Ahrefs Analytics */}
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="QkVPNT1O6u+JbZ5njmaMTw"
          strategy="afterInteractive"
        />

        {/* Site-wide Organization schema - only needs to appear once, not
            per-page, since it describes the publisher/brand rather than
            any individual page's content. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />

        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}