import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-sm justify-items-center gap-3 px-6 text-center">
      {icon ? <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</div> : null}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function StatusBlock({
  status,
  title,
  description,
  icon,
  onRetry,
}: {
  status: 'loading' | 'empty' | 'error';
  title: string;
  description?: string;
  icon?: ReactNode;
  onRetry?: () => void;
}) {
  if (status === 'loading') {
    return (
      <div className="grid w-full max-w-md gap-3" role="status" aria-label="Loading">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-line/70" />
        ))}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <EmptyState
        icon={icon}
        title="This view could not be loaded"
        description={description || 'The request did not finish. Nothing was changed.'}
        action={onRetry ? (
          <button type="button" onClick={onRetry} className="h-10 rounded-xl bg-primary px-4 text-sm font-medium text-white">
            Try again
          </button>
        ) : null}
      />
    );
  }
  return <EmptyState icon={icon} title={title} description={description} />;
}
