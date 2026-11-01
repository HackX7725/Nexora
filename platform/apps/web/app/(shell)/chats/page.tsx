'use client';

import { ChatSidebar } from '../../../src/components/chat-sidebar';
import { ConversationStage } from '../../../src/components/conversation-stage';
import { InfoPanel } from '../../../src/components/info-panel';

export default function ChatsPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
      <ChatSidebar />
      <ConversationStage />
      <InfoPanel />
    </div>
  );
}
