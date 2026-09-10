import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "Privacy Policy";
const PAGE_DESCRIPTION =
  "Read the AudioForges Privacy Policy to learn how we collect, use, store, and protect your data, including cookies, analytics, and your privacy rights.";

/** Update whenever the policy text changes, it's a claim about the text
 *  below it, so a stale date is worse than no date. */
const LAST_UPDATED = "2026-09-10";

const OG_IMAGE = ogImage(
  "Privacy Policy",
  "What we collect, what we don't, and how uploaded files are handled.",
  "Legal"
);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/privacy`,
    siteName: "AudioForges",
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumb items={[{ name: "Privacy Policy" }]} className="mb-8" />

      <header>
        <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-text-subtle">
          Last updated{" "}
          <time dateTime={LAST_UPDATED}>
            {new Date(LAST_UPDATED).toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>
      </header>

      <Prose className="mt-10">
        <h2 id="overview">1. Overview</h2>
        <p>
          AudioForges (&quot;we&quot;, &quot;us&quot;) provides free audio tools
          including YouTube-to-audio conversion and audio analysis. This policy
          explains what data we collect when you use our site and tools, and how
          it&apos;s used.
        </p>

        <h2 id="what-we-collect">2. Information we collect</h2>
        <dl>
          <dt>URLs and files you submit</dt>
          <dd>
            When you use our converter or analyzer, the YouTube URL or audio file
            you submit is sent to our backend server solely to process your
            request. Tools that use AI source separation (vocal removal and stem
            splitting, including the YouTube-linked versions) route that
            processing to a third-party GPU compute provider, described in
            Section 4. Uploaded files and submitted URLs are processed only for
            the time needed to complete that request. Temporary processing files
            are automatically deleted after processing finishes, or after a short
            retention period if required for system reliability. We do not
            permanently store or distribute the audio files or URLs you submit.
          </dd>

          <dt>Microphone input</dt>
          <dd>
            Some browser-based tools, including the instrument tuner and the
            online voice recorder, request access to your device&apos;s
            microphone. For these tools, audio is captured and processed directly
            in your browser using your device&apos;s own microphone and audio
            APIs, it is not uploaded to AudioForges servers, recorded by us, or
            stored by us in any form. For the tuner, this means the microphone
            signal is analyzed locally to detect pitch in real time. For the
            voice recorder, your recording is created, played back, and
            downloaded entirely within your browser. You can stop microphone
            access at any time using the control provided by the relevant tool or
            your browser&apos;s own site permissions.
          </dd>

          <dt>Usage analytics</dt>
          <dd>
            We use Google Analytics to understand aggregate traffic patterns
            (pages visited, approximate location, device type). Analytics data is
            processed according to Google&apos;s own privacy practices; we use it
            in aggregate and do not use it to individually identify visitors.
          </dd>

          <dt>Server logs</dt>
          <dd>
            Like most websites, our hosting and backend infrastructure
            automatically records basic technical information for security and
            reliability purposes, such as IP address, browser type, request
            timestamps, and error logs. These logs are used for troubleshooting
            and abuse prevention, not for tracking individual users across
            sessions.
          </dd>
        </dl>

        <h2 id="credits">3. Credits and payments</h2>
        <p>
          Some GPU-backed jobs take credits, described on the{" "}
          <Link href="/pricing">pricing page</Link>. Credits are attached to
          your browser, not to an account; there is no username or password.
          When you buy a pack you give us an email address. We use it for one
          thing: to match the payment notification from our payment processor
          back to the browser that started the purchase, and, if you ask, to
          send a one-time sign-in link that attaches the same credits to
          another device. That link expires after 30 minutes. We store the
          email, the credit balance and a record of each credited and refunded
          job. We do not store card or bank details; those are handled entirely
          by the processor.
        </p>
        <p>
          Payments are processed by Ko-fi. Paying on Ko-fi is subject to
          Ko-fi&apos;s own privacy policy and terms. Ko-fi tells us that a
          payment for a given item was made and the email used; it does not
          give us your payment details.
        </p>

        <h2 id="advertising">4. Advertising</h2>
        <p>
          We do not currently display third-party advertisements. If advertising
          is introduced in the future, this Privacy Policy will be updated to
          describe it before those services are enabled.
        </p>

        <h2 id="third-parties">5. Third-party services</h2>
        <p>
          We currently use Google Analytics to understand aggregate site usage,
          and the following providers to run the site and tools: Vercel for the
          website, VPS Dime for general backend processing, RunPod for the
          GPU-accelerated compute used by separation, transcription and
          high-accuracy MIDI, and Ko-fi to process credit purchases. When you use one of those separation tools, the
          audio file or fetched YouTube audio is processed on RunPod&apos;s
          infrastructure for the time needed to complete that job, under the same
          no-permanent-storage handling described in Section 2. Each of these
          providers has its own privacy policy governing how they handle data.
        </p>

        <h2 id="cookies">6. Cookies</h2>
        <p>
          We use a small number of cookies for basic site functionality
          (&quot;essential cookies&quot;) and, via Google Analytics, cookies that
          help us understand aggregate traffic patterns (&quot;analytics
          cookies&quot;). We do not currently use advertising cookies. You can
          disable cookies in your browser settings, though this may affect site
          functionality.
        </p>

        <h2 id="how-we-use-it">7. How we use your information</h2>
        <p>
          Any file or URL you submit is used solely to provide the tool
          functionality you requested, converting, analyzing, or otherwise
          processing that specific submission. We do not use submitted content
          for any other purpose. Microphone-based tools do not send audio to us
          at all, as described above.
        </p>

        <h2 id="security">8. Security</h2>
        <p>
          We use HTTPS encryption for data in transit, restrict server access to
          what&apos;s necessary to operate the service, and take reasonable
          measures to protect the infrastructure our tools run on. No method of
          transmission or storage is 100% secure, but we work to keep processing
          infrastructure secure and minimize what data is retained in the first
          place.
        </p>

        <h2 id="childrens-privacy">9. Children&apos;s privacy</h2>
        <p>
          AudioForges is not directed toward children under 13, and we do not
          knowingly collect personal information from children.
        </p>

        <h2 id="your-rights">10. Your rights</h2>
        <p>
          You may request information about data we hold or request deletion by
          contacting us at the email listed on our{" "}
          <Link href="/contact">Contact page</Link>.
        </p>

        <h2 id="changes">11. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Changes will be posted on
          this page with an updated revision date.
        </p>
      </Prose>
    </main>
  );
}