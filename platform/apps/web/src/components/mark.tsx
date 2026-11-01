export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path d="M9 18.5c.4-4 3.2-7 7.2-7 2.2 0 3.9.9 5.1 2.3" fill="none" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M23 13.5c-.4 4-3.2 7-7.2 7-2.2 0-3.9-.9-5.1-2.3" fill="none" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}
