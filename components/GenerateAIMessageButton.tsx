import { Button, Text } from '@chakra-ui/react';

interface GenerateAIMessageButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function GenerateAIMessageButton({
  onClick,
  isLoading = false,
  isDisabled = false,
  size = 'xs',
}: GenerateAIMessageButtonProps) {
  return (
    <Button
      size={size}
      variant="outline"
      colorScheme="purple"
      onClick={onClick}
      isLoading={isLoading}
      isDisabled={isDisabled}
      leftIcon={<Text>✨</Text>}
    >
      Generate message with AI
    </Button>
  );
}

