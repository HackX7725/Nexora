'use client';

import { Button, Input } from '@platform/ui';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Mark } from './mark';

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md rounded-[var(--nx-radius)] border border-line bg-surface p-8 shadow-[var(--nx-shadow)]">
        <Mark className="h-10 w-10 text-primary" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-sm text-muted">{footer}</p>
      </div>
    </main>
  );
}

export function PasswordField({
  label,
  name,
  value,
  error,
  autoComplete,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  error?: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      label={label}
      name={name}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      error={error}
      onChange={(event) => onChange(event.target.value)}
      trailing={(
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    />
  );
}

export function AuthForm({
  error,
  loading,
  submitLabel,
  onSubmit,
  children,
}: {
  error?: string;
  loading: boolean;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit} noValidate>
      {children}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={loading}>{loading ? 'Please wait…' : submitLabel}</Button>
    </form>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-medium text-primary">{children}</Link>;
}
