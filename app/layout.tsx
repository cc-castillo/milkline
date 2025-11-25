import type { Metadata } from 'next';
import './globals.css';
import React, { ReactNode } from 'react';
import Providers from './providers';
import { ColorModeScript } from '@chakra-ui/react';

export const metadata: Metadata = {
  title: 'MilkLine - B2B Milk Supply Chain Platform',
  description: 'Connect milk buyers and sellers. Streamline your supply chain with RFQs, quotes, and real-time order tracking.',
  keywords: ['milk supply chain', 'B2B marketplace', 'dairy procurement', 'milk wholesale'],
  authors: [{ name: 'MilkLine' }],
  openGraph: {
    title: 'MilkLine - B2B Milk Supply Chain Platform',
    description: 'The premier platform for milk buyers and sellers',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ColorModeScript initialColorMode="light" />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}