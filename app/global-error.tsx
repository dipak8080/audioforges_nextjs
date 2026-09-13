"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // The root layout failed, so no fonts, no globals.css and no site chrome are
  // available here. Everything is inline on purpose.
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f0f11",
          color: "#f2f1ee",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "12px", color: "#9a968d", lineHeight: 1.6 }}>
            AudioForges failed to load. Nothing you uploaded was kept. Reloading usually fixes
            it.
          </p>
          {error.digest && (
            <p style={{ marginTop: "12px", fontSize: "0.75rem", color: "#8f8a80" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              cursor: "pointer",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#e8a23d",
              color: "#0f0f11",
              padding: "10px 20px",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}