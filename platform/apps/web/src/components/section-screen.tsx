import { EmptyState } from '@platform/ui';
import type { ReactNode } from 'react';

export function SectionScreen({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="border-b border-line bg-surface px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </header>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="grid justify-items-center gap-6">
          <EmptyState icon={icon} title={title} description={description} />
          {children}
        </div>
      </div>
    </section>
  );
}
