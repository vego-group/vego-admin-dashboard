import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
        <p className="mt-2 text-base text-slate-600">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-brand-950 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-900"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
