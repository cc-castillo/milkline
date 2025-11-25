import { Box, Heading, Text, VStack, HStack, Button, Icon } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backUrl?: string;
  backLabel?: string;
  rightContent?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backUrl,
  backLabel = 'Back',
  rightContent,
}) => {
  const router = useRouter();

  return (
    <Box>
      <HStack justify="space-between" align="flex-start" mb={4}>
        <VStack align="start" spacing={2}>
          {backUrl && (
            <Button
              variant="ghost"
              color="cyan.900"
              leftIcon={
                <Icon viewBox="0 0 24 24" boxSize={5}>
                  <path
                    fill="currentColor"
                    d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
                  />
                </Icon>
              }
              onClick={() => router.push(backUrl)}
            >
              {backLabel}
            </Button>
          )}
          <VStack align="start" spacing={0} ml={backUrl ? "24px" : 0}>
            <Heading size="xl" color="cyan.800">
              {title}
            </Heading>
            {subtitle && (
              <Text color="gray.600" fontSize="sm">
                {subtitle}
              </Text>
            )}
          </VStack>
        </VStack>
        {rightContent && (
          <VStack align="end" spacing={2}>
            {rightContent}
          </VStack>
        )}
      </HStack>
    </Box>
  );
};

