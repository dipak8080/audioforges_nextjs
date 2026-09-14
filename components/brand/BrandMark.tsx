export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <rect x="1" y="4" width="16" height="4.5" rx="1" fill="currentColor" />
      <rect x="11" y="11.5" width="20" height="4.5" rx="1" fill="currentColor" />
      <rect x="4" y="19" width="11" height="4.5" rx="1" fill="currentColor" />
      <rect x="18" y="26.5" width="13" height="4.5" rx="1" fill="currentColor" />
    </svg>
  );
}