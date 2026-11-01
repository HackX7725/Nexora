'use client';

import { Archive } from 'lucide-react';
import { SectionScreen } from '../../../src/components/section-screen';

export default function ArchivedPage() {
  return (
    <SectionScreen
      icon={<Archive className="h-6 w-6" />}
      title="Archived"
      description="Conversations you archive will leave the main list and stay here."
    />
  );
}
