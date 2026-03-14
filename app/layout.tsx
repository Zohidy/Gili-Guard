import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Gili Guard - Emergency App',
  description: 'Emergency assistance for Gili Trawangan',
  manifest: '/manifest.json',
  themeColor: '#ff3c3c',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gili Guard',
  },
  icons: {
    icon: '/api/icon?size=192',
    apple: '/api/icon?size=192',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable}`}>
      <body className="font-sans antialiased bg-stone-50 text-stone-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
