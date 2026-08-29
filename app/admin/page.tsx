"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, Cookie, ScrollText, ArrowRight, Loader2, Coins } from "lucide-react";

interface CreditsOverview {
  accounts?: number;
  credits_outstanding?: number;
  webhooks_unprocessed?: number;
}

interface CacheStats {
  enabled: boolean;
  backend: string;
  entry_count: number;
  total_gb: number;
  max_gb: number;
  percent_full: number;
}

interface CookieSlot {
  exists: boolean;
  path: string;
  size_bytes?: number;
  last_modified?: number;
}

export default function AdminDashboardPage() {
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [cookies, setCookies] = useState<Record<string, CookieSlot> | null>(null);
  const [credits, setCredits] = useState<CreditsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/cache", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/cookies", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/credits?view=overview", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([c, k, cr]) => {
        setCache(c);
        setCookies(k);
        setCredits(cr);
      })
      .finally(() => setLoading(false));
  }, []);

  const cookiesPresent = cookies
    ? Object.values(cookies).filter((s) => s.exists).length
    : 0;

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <h1 className="text-lg sm:text-xl font-semibold tracking-tight mb-1">Dashboard</h1>
      <p className="text-xs sm:text-sm text-text-muted mb-5">Quick overview of backend health.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-text-subtle text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <DashboardCard
            href="/admin/logs"
            icon={ScrollText}
            title="Logs"
            body="View live HTTP and system logs."
          />
          <DashboardCard
            href="/admin/cache"
            icon={Database}
            title="Cache"
            body={
              cache
                ? `${cache.entry_count.toLocaleString()} entries · ${cache.total_gb} / ${cache.max_gb} GB (${cache.percent_full}%)`
                : "Unable to load cache stats."
            }
          />
          <DashboardCard
            href="/admin/cookies"
            icon={Cookie}
            title="Cookies"
            body={`${cookiesPresent} of 3 slots configured.`}
          />
          {/* Outstanding credits are a LIABILITY — money already taken for
              work not yet done. Unprocessed webhooks are payments that never
              reached an account, i.e. someone waiting on a support reply. Both
              belong on the first screen rather than three clicks in. */}
          <DashboardCard
            href="/admin/credits"
            icon={Coins}
            title="Credits"
            body={
              credits
                ? `${credits.credits_outstanding ?? 0} outstanding · ${
                    credits.accounts ?? 0
                  } accounts${
                    credits.webhooks_unprocessed
                      ? ` · ${credits.webhooks_unprocessed} webhook${
                          credits.webhooks_unprocessed === 1 ? "" : "s"
                        } unmatched`
                      : ""
                  }`
                : "Unable to load credit stats."
            }
          />
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  href, icon: Icon, title, body,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-text-subtle group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{body}</p>
    </Link>
  );
}