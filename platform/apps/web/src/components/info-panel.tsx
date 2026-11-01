'use client';

import { Modal } from '@platform/ui';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { decodeBody } from '../lib/message-body';
import { conversationTitle, otherMember, useChat } from '../stores/chat-store';
import { useSession } from '../stores/session-store';
import { useShell } from '../stores/shell-store';

export function InfoPanel() {
  const open = useShell((state) => state.infoOpen);
  const dialog = useShell((state) => state.infoDialog);
  const closeInfoDialog = useShell((state) => state.closeInfoDialog);
  const reduce = useReducedMotion();

  return (
    <>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.aside
            key="details"
            initial={reduce ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: 16 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            aria-label="Conversation details"
            className="hidden w-[300px] shrink-0 flex-col border-l border-line bg-sidebar lg:flex"
          >
            <Details />
          </motion.aside>
        ) : null}
      </AnimatePresence>
      <Modal open={dialog} onOpenChange={(next) => { if (!next) closeInfoDialog(); }} title="Conversation details">
        <Details />
      </Modal>
    </>
  );
}

function Details() {
  const myId = useSession((state) => state.session?.user.id || '');
  const activeId = useChat((state) => state.activeId);
  const conversation = useChat((state) => state.conversations.find((item) => item.id === activeId));
  const messages = useChat((state) => state.messages);
  const title = conversationTitle(conversation, myId);
  const other = otherMember(conversation, myId);
  const photos = conversation
    ? messages.flatMap((message) => {
      const body = decodeBody(message.ciphertext);
      return body.kind === 'image' ? [body.dataUrl] : [];
    })
    : [];
  return (
    <div className="grid gap-6 p-5">
      <div>
        <h2 className="text-base font-semibold">Details</h2>
        {conversation ? (
          <p className="mt-1 text-sm text-muted">
            {title}
            {other ? ` · @${other.username}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Shared files and members appear after a conversation is open.</p>
        )}
      </div>
      <section>
        <h3 className="text-sm font-medium">Shared media</h3>
        {photos.length ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photos.map((src) => <img key={src} src={src} alt="Shared photo" className="aspect-square w-full rounded-lg object-cover" />)}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No photos or videos yet.</p>
        )}
      </section>
      <section>
        <h3 className="text-sm font-medium">Documents</h3>
        <p className="mt-2 text-sm text-muted">No documents yet.</p>
      </section>
    </div>
  );
}
