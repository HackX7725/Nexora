import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@platform/ui';
import { SessionProvider } from '../src/components/session-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nexora',
  description: 'Private conversations for Nexora.',
};

const themeScript = `try{var raw=localStorage.getItem('nexora-shell');var theme='system';if(raw){theme=(JSON.parse(raw).theme)||'system';}var dark=theme==='dark'||(theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
