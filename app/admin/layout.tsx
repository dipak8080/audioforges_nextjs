"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioWaveform,
  LayoutDashboard,
  ScrollText,
  Database,
  Cookie,
  LogOut,
  Menu,
  X,
  Loader2,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/cache", label: "Cache", icon: Database },
  { href: "/admin/cookies", label: "Cookies", icon: Cookie },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // This layout wraps every /admin/* route, including /admin/login itself —
  // so it stays mounted across the logout navigation rather than
  // unmounting. That means isLoggingOut MUST be reset explicitly once the
  // navigation is underway, or the button is stuck on "Signing out…"
  // forever (nothing else ever flips it back to false).
  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh(); // clears any cached authenticated state for this layout
      setIsLoggingOut(false);
    }
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  // The login page shouldn't show the authenticated dashboard chrome at
  // all — someone who isn't signed in has no use for nav links to Logs/
  // Cache/Cookies, and showing a "Sign out" button on the sign-IN screen
  // is exactly the confusing overlap this was producing.
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <div className="min-h-dvh bg-graphite-950 text-text-primary">{children}</div>;
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-graphite-950 text-text-primary">
      <header className="shrink-0 border-b border-graphite-800 bg-graphite-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <AudioWaveform className="h-5 w-5 text-amber-500 shrink-0" />
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap">AudioForges</span>
            <span className="text-text-subtle text-sm hidden sm:inline">/</span>
            <span className="text-sm text-text-muted hidden sm:inline">Admin</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 rounded-lg border border-graphite-800 bg-graphite-900 p-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-graphite-800 text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <item.icon className={`h-3.5 w-3.5 ${isActive(item.href) ? "text-amber-500" : ""}`} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="hidden md:flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors disabled:opacity-60"
            >
              {isLoggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden flex items-center justify-center rounded-md border border-graphite-700 h-8 w-8 text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-graphite-800 bg-graphite-900 px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-graphite-800 text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive(item.href) ? "text-amber-500" : ""}`} />
                {item.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-muted hover:text-text-primary transition-colors mt-1 border-t border-graphite-800 pt-3"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}