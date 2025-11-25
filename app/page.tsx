'use client';

import { Box, Container, Heading, Text, Button, VStack, HStack, SimpleGrid, Card, CardBody, Icon, Spinner } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DarkModeToggle } from '@/components/DarkModeToggle';

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<'buyer' | 'seller' | null>(null);
  const [loading, setLoading] = useState(false); // Start as false, check auth in background

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Optimize: Check session first (faster than getUser)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session?.access_token) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        const token = sessionData.session.access_token;

        // Parallel: Get user and profile simultaneously
        const [userResult, profileResponse] = await Promise.all([
          supabase.auth.getUser(),
          fetch('/api/user-profile', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }),
        ]);

        const { data: { user }, error: authError } = userResult;
        
        if (authError || !user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setIsAuthenticated(true);
          setUserType(profileData.userType);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleGoToDashboard = () => {
    if (userType === 'buyer') {
      router.push('/dashboards/buyer');
    } else if (userType === 'seller') {
      router.push('/dashboards/seller');
    }
  };

  return (
    <Box>
      {/* Dark Mode Toggle */}
      <Box position="fixed" top={4} right={4} zIndex={1000}>
        <DarkModeToggle size="sm" color="pink.100" />
      </Box>
      {/* Hero Section */}
      <Box 
        position="relative"
        bg="cyan.900" 
        color="pink" 
        py={20}
        bgImage="url('/hero-background.jpg')"
        bgSize="cover"
        bgPosition="center"
        bgRepeat="no-repeat"
        _before={{
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          bg: 'cyan.900',
          opacity: 0.7,
          zIndex: 0,
        }}
      >
        <Container maxW="container.xl" position="relative" zIndex={1}>
          <VStack spacing={6} align="center" textAlign="center">
            <Heading size="4xl" fontFamily="fangsong" color="cyan.100">
              MilkLine
            </Heading>
            <Text fontSize="xl" maxW="2xl">
            From Source to Glass: The Premier B2B Platform for Milk Distribution.
            </Text>
            <HStack spacing={4} pt={4}>
              {isAuthenticated === null ? (
                <Spinner size="md" color="cyan.100" />
              ) : isAuthenticated ? (
                <Button 
                  size="md" 
                  bg="pink.500"
                  textColor="white"
                  _hover={{ bg: 'pink.400' }} 
                  onClick={handleGoToDashboard}
                  rightIcon={
                    <Icon viewBox="0 0 24 24" boxSize={4}>
                      <path
                        fill="currentColor"
                        d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
                      />
                    </Icon>
                  }
                >
                  Go to dashboard
                </Button>
              ) : (
                <>
                  <Button 
                    size="md" 
                    variant="outline"
                    borderColor="cyan.300"
                    textColor="cyan.100"
                    _hover={{ bg: 'cyan.800', borderColor: 'cyan.200' }} 
                    onClick={() => router.push('/signin')}
                  >
                    Sign In
                  </Button>
                  <Button 
                    size="md" 
                    bg="pink.500"
                    textColor="white"
                    _hover={{ bg: 'pink.400' }} 
                    onClick={() => router.push('/signup')}
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxW="container.xl" py={16}>
        <VStack spacing={12}>
          <Box textAlign="center">
            <Heading size="xl" mb={4} color="cyan.900">
              How MilkLine Works
            </Heading>
            <Text color="gray.600" fontSize="lg">
              Simple, efficient, and transparent milk procurement
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} w="full">
            <Card>
              <CardBody>
                <VStack spacing={3}>
                  <Box fontSize="4xl">📋</Box>
                  <Heading size="md" marginTop="18px" color="cyan.900">1. Sign up</Heading>
                  <Text textAlign="center" color="gray.600">
                    Sign up as a buyer or seller and we'll connect you!
                  </Text>
                </VStack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <VStack spacing={3}>
                  <Box fontSize="5xl">🐄</Box>
                  <Heading size="md" textAlign="center" color="cyan.900">2. Request or Receive Quotes</Heading>
                  <Text textAlign="center" color="gray.600">
                    Buyers submit a request for quotes, sellers are then notified and the bidding begins.
                  </Text>
                </VStack>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <VStack spacing={3}>
                  <Box fontSize="4xl">📦</Box>
                  <Heading size="md" marginTop="18px" color="cyan.900">3. Track Orders</Heading>
                  <Text textAlign="center" color="gray.600">
                    Real-time order tracking from confirmation to delivery
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          </SimpleGrid>

          {/* User Type Selection */}
          <Box w="full" pt={8}>
            <VStack spacing={6}>
              <Heading size="lg" color="cyan.900">Get Started</Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} w="full" maxW="4xl">
                <Card 
                  cursor="pointer" 
                  _hover={{ shadow: 'lg', transform: 'translateY(-4px)', transition: 'all 0.3s' }}
                  onClick={() => router.push('/rfq')}
                >
                  <CardBody>
                    <VStack spacing={4} py={6}>
                      <Box fontSize="5xl">🥛</Box>
                      <Heading size="md" color="teal.300">I&apos;m a Buyer</Heading>
                      <Text textAlign="center" color="teal.600">
                        Looking to purchase milk for your business? Create an RFQ and get competitive quotes.
                      </Text>
                      <Button bg="cyan.700" mt={2}>
                        Create RFQ
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>

                <Card 
                  cursor="pointer" 
                  _hover={{ shadow: 'lg', transform: 'translateY(-4px)', transition: 'all 0.3s'}}
                  onClick={() => router.push('/dashboards/seller')}
                >
                  <CardBody>
                    <VStack spacing={4} py={6}>
                      <Box fontSize="5xl">🐮</Box>
                      <Heading size="md" color="pink.300">I&apos;m a Seller</Heading>
                      <Text textAlign="center" color="pink.800">
                        Milk supplier ready to fulfill orders? Browse RFQs and submit your quotes for bidding.
                      </Text>
                      <Button bg="cyan.700" mt={2}>
                        View RFQs
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              </SimpleGrid>
            </VStack>
          </Box>
        </VStack>
      </Container>

      {/* Footer */}
      <Box bg="gray.100" py={8} mt={16}>
        <Container maxW="container.xl">
          <VStack spacing={2}>
            <Text fontWeight="bold" color="cyan.600">MilkLine</Text>
            <Text fontSize="sm" color="gray.600">
              © 2025 MilkLine. All rights reserved.
            </Text>
          </VStack>
        </Container>
      </Box>
    </Box>
  );
}