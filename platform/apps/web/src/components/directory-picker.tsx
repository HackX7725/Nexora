'use client';

import { Button, Input } from '@platform/ui';
import { useEffect, useState } from 'react';
import { ApiError, searchPeople, type DirectoryPerson } from '../lib/api';

export function DirectoryPicker({
  action,
  onPick,
}: {
  action: string;
  onPick: (person: DirectoryPerson) => Promise<void> | void;
}) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setPeople([]);
      setError('');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      searchPeople(trimmed)
        .then((users) => {
          setPeople(users);
          setError('');
        })
        .catch((reason: unknown) => {
          setPeople([]);
          setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.');
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="grid gap-3">
      <Input label="Name or username" name="person" value={query} placeholder="Start typing a name" onChange={(event) => setQuery(event.target.value)} />
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      {query.trim().length >= 2 && !people.length && !error ? (
        <p className="rounded-xl bg-canvas px-3 py-4 text-sm text-muted">No accounts match that search.</p>
      ) : null}
      <ul className="grid gap-2">
        {people.map((person) => (
          <li key={person.id} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2">
            <span>
              <span className="block text-sm font-medium">{person.displayName}</span>
              <span className="block text-sm text-muted">@{person.username}</span>
            </span>
            <Button
              type="button"
              disabled={busyId === person.id}
              onClick={() => {
                setBusyId(person.id);
                Promise.resolve(onPick(person))
                  .catch((reason: unknown) => {
                    setError(reason instanceof ApiError ? reason.message : 'The server did not respond. Try again.');
                  })
                  .finally(() => setBusyId(''));
              }}
            >
              {busyId === person.id ? 'Please wait…' : action}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
