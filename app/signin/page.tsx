'use client';

import { Box, Container, Heading, Text, Button, VStack, Input, FormControl, FormLabel, Link, Alert, AlertIcon, useColorModeValue } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DarkModeToggle } from '@/components/DarkModeToggle';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Color mode aware colors
  const bgColor = useColorModeValue('gray.50', 'black');
  const cardBg = useColorModeValue('white', 'gray.800');
  const headingColor = useColorModeValue('cyan.900', 'gray.100');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const linkColor = useColorModeValue('cyan.700', 'cyan.400');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        // Get session token for API call
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          setError('Failed to get session. Please try again.');
          return;
        }

        // Use API route with admin client to bypass RLS
        const response = await fetch('/api/user-profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const profileData = await response.json();
          
          if (profileData.userType === 'buyer') {
            router.push('/dashboards/buyer');
            return;
          } else if (profileData.userType === 'seller') {
            router.push('/dashboards/seller');
            return;
          }
        } else {
          // If API returns an error, show it
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          setError(errorData.error || 'Profile not found. Please complete your signup or contact support.');
          console.error('User profile not found:', errorData);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg={bgColor} py={20}>
      {/* Dark Mode Toggle */}
      <Box position="fixed" top={4} right={4} zIndex={1000}>
        <DarkModeToggle size="sm" color="gray.600" />
      </Box>
      <Container maxW="md">
        <VStack spacing={8}>
          <Box textAlign="center">
            <Heading size="xl" color={headingColor} mb={2}>
              Sign In to MilkLine
            </Heading>
            <Text color={textColor}>
              Welcome back! Sign in to continue.
            </Text>
          </Box>

          <Box w="full" bg={cardBg} p={8} borderRadius="lg" boxShadow="md">
            <form onSubmit={handleSignIn}>
              <VStack spacing={6}>
                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    size="lg"
                  />
                </FormControl>

                <Button
                  type="submit"
                  w="full"
                  size="lg"
                  bg="cyan.700"
                  color="white"
                  _hover={{ bg: 'cyan.600' }}
                  isLoading={loading}
                  loadingText="Signing in..."
                >
                  Sign In
                </Button>
              </VStack>
            </form>

            <VStack spacing={2} mt={6}>
              <Text fontSize="sm" color={textColor}>
                Don&apos;t have an account?{' '}
                <Link color={linkColor} href="/signup" fontWeight="semibold">
                  Sign up
                </Link>
              </Text>
              <Link color={linkColor} href="/" fontSize="sm">
                ← Back to home
              </Link>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}

