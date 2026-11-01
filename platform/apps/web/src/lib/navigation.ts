export const navigation = [
  { href: '/chats', label: 'Chats', icon: 'chats' },
  { href: '/calls', label: 'Calls', icon: 'calls' },
  { href: '/updates', label: 'Updates', icon: 'updates' },
  { href: '/contacts', label: 'Contacts', icon: 'contacts' },
  { href: '/archived', label: 'Archived', icon: 'archived' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

export type NavIcon = (typeof navigation)[number]['icon'];
