'use client';

import { ChakraProvider } from '@chakra-ui/react';
import React from 'react';
import theme from '../lib/theme';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ChakraProvider theme={theme}>{children}</ChakraProvider>;
}

