import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 text-center text-ink">
      <div>
        <h1 className="text-2xl font-semibold">That page is not in Nexora</h1>
        <p className="mt-2 text-sm text-muted">The address does not match a screen in this app.</p>
        <Link href="/chats" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white">
          Back to chats
        </Link>
      </div>
    </main>
  );
}
