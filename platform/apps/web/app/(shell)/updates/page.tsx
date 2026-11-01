'use client';

import { Sparkles } from 'lucide-react';
import { SectionScreen } from '../../../src/components/section-screen';

export default function UpdatesPage() {
  return (
    <SectionScreen
      icon={<Sparkles className="h-6 w-6" />}
      title="Updates"
      description="Status posts from people you know will appear in this feed."
    />
  );
}
