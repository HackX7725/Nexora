import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  trailing?: ReactNode;
};

export function Input({ label, hint, error, id, className, trailing, ...props }: InputProps) {
  const inputId = id || props.name;
  return (
    <div className="grid gap-1.5">
      {label ? <label htmlFor={inputId} className="text-sm font-medium text-ink">{label}</label> : null}
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-primary',
            trailing && 'pr-12',
            error && 'border-danger',
            className,
          )}
          {...props}
        />
        {trailing ? <div className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</div> : null}
      </div>
      {error ? <p id={`${inputId}-error`} className="text-sm text-danger">{error}</p> : null}
      {!error && hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function FieldNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
