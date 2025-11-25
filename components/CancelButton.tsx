import { Button, ButtonProps, useColorModeValue } from '@chakra-ui/react';
import React from 'react';

interface CancelButtonProps extends Omit<ButtonProps, 'bg' | 'color' | '_hover'> {
  children?: React.ReactNode;
}

export const CancelButton: React.FC<CancelButtonProps> = ({ 
  children = 'Cancel', 
  ...props 
}) => {
  const bgColor = useColorModeValue('pink.50', '#991B1B');
  const textColor = useColorModeValue('pink.500', 'pink.100');
  const hoverBg = useColorModeValue('pink.100', '#7F1717');

  return (
    <Button
      size="sm"
      bg={bgColor}
      color={textColor}
      _hover={{ 
        bg: hoverBg,
        transform: 'translateY(-2px)',
      }}
      {...props}
    >
      {children}
    </Button>
  );
};

