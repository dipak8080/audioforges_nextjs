"use client";

import { useEffect, useState } from "react";

type Props = {
  user: string;
  domain: string;
  className?: string;
  children?: React.ReactNode;
};

export default function EmailLink({ user, domain, className, children }: Props) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(`${user}@${domain}`);
  }, [user, domain]);

  if (!email) {
    // Server render + pre-hydration fallback. No parseable address in the HTML.
    return (
      <span className={className}>
        {children}
        <span>
          {user} [at] {domain.replace(/\./g, " [dot] ")}
        </span>
      </span>
    );
  }

  return (
    <a href={`mailto:${email}`} className={className}>
      {children}
      <span>{email}</span>
    </a>
  );
}