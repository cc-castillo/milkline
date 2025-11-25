import { IconButton, useColorMode } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import React from 'react';

interface DarkModeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  marginRight?: string;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  size = 'sm',
  color = 'teal.600',
  marginRight,
}) => {
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <IconButton
      variant="ghost"
      color={color}
      size={size}
      marginRight={marginRight}
      onClick={toggleColorMode}
      aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      icon={colorMode === 'dark' ? <SunIcon /> : <MoonIcon />}
      _focus={{
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
      }}
    />
  );
};

