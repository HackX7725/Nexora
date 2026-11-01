'use client';

import { Button, EmptyState, Modal, ModalClose } from '@platform/ui';
import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DirectoryPicker } from '../../../src/components/directory-picker';
import { ApiError, addContact, listContacts, removeContact, type SavedContact } from '../../../src/lib/api';
import { useCall } from '../../../src/stores/call-store';
import { useChat } from '../../../src/stores/chat-store';

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<SavedContact[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const openDirect = useChat((state) => state.openDirect);
  const startCall = useCall((state) => state.start);

  async function refresh() {
    const data = await listContacts();
    setContacts(data.contacts);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.');
    });
  }, []);

  async function message(contact: SavedContact) {
    await openDirect(contact.userId);
    router.push('/chats');
  }

  async function call(contact: SavedContact) {
    const conversation = await openDirect(contact.userId);
    await startCall(conversation.id, contact.displayName, false);
    router.push('/chats');
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-canvas">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <Button type="button" onClick={() => setOpen(true)}>Add contact</Button>
      </header>
      {error ? <p role="alert" className="px-6 pt-4 text-sm text-danger">{error}</p> : null}
      {contacts.length ? (
        <ul className="grid gap-3 px-6 py-6">
          {contacts.map((contact) => (
            <li key={contact.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <span>
                <span className="block font-medium">{contact.displayName}</span>
                <span className="block text-sm text-muted">@{contact.username}</span>
              </span>
              <span className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => void message(contact).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.'))}>Message</Button>
                <Button type="button" variant="secondary" onClick={() => void call(contact).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.'))}>Call</Button>
                <Button type="button" variant="ghost" onClick={() => void removeContact(contact.userId).then(refresh).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.'))}>Remove</Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No contacts yet"
            description="Search for a username and save the person. Message and Call use that saved contact."
          />
        </div>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Add a contact" description="Search the directory and save someone you can message or call.">
        <DirectoryPicker
          action="Add"
          onPick={async (person) => {
            await addContact(person.username);
            await refresh();
            setOpen(false);
          }}
        />
        <ModalClose asChild>
          <Button type="button" variant="secondary" className="mt-4">Close</Button>
        </ModalClose>
      </Modal>
    </section>
  );
}
