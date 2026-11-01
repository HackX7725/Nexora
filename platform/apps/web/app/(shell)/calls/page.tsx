'use client';

import { Phone } from 'lucide-react';
import { SectionScreen } from '../../../src/components/section-screen';

export default function CallsPage() {
  return (
    <SectionScreen
      icon={<Phone className="h-6 w-6" />}
      title="Calls"
      description="Call history will list here. A call screen only opens when a real media connection starts."
    />
  );
}
