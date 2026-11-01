'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from './cn';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={8}
        className={cn(
          'z-50 min-w-48 rounded-2xl border border-line bg-surface p-1.5 text-sm text-ink shadow-[var(--nx-shadow)]',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="cursor-pointer rounded-xl px-3 py-2 text-danger outline-none data-[highlighted]:bg-canvas"
    >
      {children}
    </DropdownMenu.Item>
  );
}

export function MenuRadioItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <DropdownMenu.RadioItem
      value={value}
      className="cursor-pointer rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-canvas data-[state=checked]:text-primary"
    >
      {children}
    </DropdownMenu.RadioItem>
  );
}
