'use client';

import { Box, Container, Heading, Text, Button, VStack, HStack, Input, FormControl, FormLabel, Link, Alert, AlertIcon, Select, useColorModeValue } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, COUNTRY_CODES } from '@/lib/constants';
import { DarkModeToggle } from '@/components/DarkModeToggle';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [userType, setUserType] = useState<'buyer' | 'seller'>('buyer');
  const [contactEmail, setContactEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Color mode aware colors
  const bgColor = useColorModeValue('gray.50', 'black');
  const cardBg = useColorModeValue('white', 'gray.800');
  const headingColor = useColorModeValue('cyan.900', 'gray.100');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const linkColor = useColorModeValue('cyan.700', 'cyan.400');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate required fields
    if (!phone.trim()) {
      setError('Phone number is required');
      setLoading(false);
      return;
    }

    if (!address.street.trim() || !address.city.trim() || !address.state.trim() || !address.zip.trim() || !address.country) {
      setError('All address fields are required');
      setLoading(false);
      return;
    }

    try {
      // Call the signup API route which uses admin client to bypass RLS
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          companyName,
          userType,
          contactEmail,
          phone: `${countryCode} ${phone}`.trim(),
          address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      if (data.success) {
        // Sign in the user after successful signup
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Even if sign-in fails, the account was created
          // User can sign in manually
          console.warn('Auto sign-in failed:', signInError);
        }

        setSuccess(true);
        
        // Redirect to appropriate dashboard based on user type
        const dashboardPath = userType === 'buyer' ? '/dashboards/buyer' : '/dashboards/seller';
        setTimeout(() => {
          router.push(dashboardPath);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
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
              Sign Up for MilkLine
            </Heading>
            <Text color={textColor}>
              Create your account to get started
            </Text>
          </Box>

          <Box w="full" bg={cardBg} p={8} borderRadius="lg" boxShadow="md">
            <form onSubmit={handleSignUp}>
              <VStack spacing={6}>
                {error && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert status="success" borderRadius="md">
                    <AlertIcon />
                    Account created successfully! Redirecting...
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
                    placeholder="Create a password"
                    size="lg"
                    minLength={6}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Company Name</FormLabel>
                  <Input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Your company name"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>I am a...</FormLabel>
                  <Select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value as 'buyer' | 'seller')}
                    size="lg"
                  >
                    <option value="buyer">Buyer</option>
                    <option value="seller">Seller</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Contact Email (optional)</FormLabel>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@company.com"
                    size="lg"
                  />
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    If different from your account email
                  </Text>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Phone</FormLabel>
                  <HStack>
                    <Select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      maxW="120px"
                      size="lg"
                      isRequired
                    >
                      {COUNTRY_CODES.map((item, index) => (
                        <option key={`${item.code}-${index}`} value={item.code}>
                          {item.flag} {item.code}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter phone number"
                      flex={1}
                      size="lg"
                      isRequired
                    />
                  </HStack>
                </FormControl>

                <Box w="full">
                  <Text fontWeight="semibold" mb={4}>Address</Text>
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Street</FormLabel>
                      <Input
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        placeholder="Enter street address"
                        size="lg"
                        isRequired
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel>City</FormLabel>
                      <Input
                        value={address.city}
                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                        placeholder="Enter city"
                        size="lg"
                        isRequired
                      />
                    </FormControl>

                    <HStack spacing={4}>
                      <FormControl isRequired>
                        <FormLabel>State</FormLabel>
                        <Input
                          value={address.state}
                          onChange={(e) => setAddress({ ...address, state: e.target.value })}
                          placeholder="Enter state"
                          size="lg"
                          isRequired
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel>ZIP Code</FormLabel>
                        <Input
                          value={address.zip}
                          onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                          placeholder="Enter ZIP code"
                          size="lg"
                          isRequired
                        />
                      </FormControl>
                    </HStack>

                    <FormControl isRequired>
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={address.country}
                        onChange={(e) => setAddress({ ...address, country: e.target.value })}
                        placeholder="Select country"
                        size="lg"
                        isRequired
                      >
                        {COUNTRIES.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </VStack>
                </Box>

                <Button
                  type="submit"
                  w="full"
                  size="lg"
                  bg="pink.500"
                  color="white"
                  _hover={{ bg: 'pink.400' }}
                  isLoading={loading}
                  loadingText="Creating account..."
                >
                  Sign Up
                </Button>
              </VStack>
            </form>

            <VStack spacing={2} mt={6}>
              <Text fontSize="sm" color={textColor}>
                Already have an account?{' '}
                <Link color={linkColor} href="/signin" fontWeight="semibold">
                  Sign in
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

