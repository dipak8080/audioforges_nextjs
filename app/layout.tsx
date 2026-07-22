import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/layout/CookieConsent";
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
          src="https://www.googletagmanager.com/gtag/js?id=G-0TZJRY4JYW"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-0TZJRY4JYW');
  `}
        </Script>

        {/* Ahrefs Analytics */}
        <Script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="QkVPNT1O6u+JbZ5njmaMTw"
          strategy="afterInteractive"
        />

        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}