'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Spinner,
  Card,
  CardBody,
  CardHeader,
  IconButton,
  Icon,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, COUNTRY_CODES } from '@/lib/constants';
import { DarkModeToggle } from '@/components/DarkModeToggle';

export default function AccountPage() {
  const toast = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userType, setUserType] = useState<'buyer' | 'seller' | null>(null);
  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    countryCode: '+1',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: '',
    },
  });

  useEffect(() => {
    const loadAccountData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/signin');
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (!token) {
          toast({
            title: 'Error',
            description: 'Failed to get session. Please sign in again.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          router.push('/signin');
          return;
        }

        const response = await fetch('/api/account', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load account data');
        }

        const data = await response.json();
        setUserType(data.userType);
        
        const profile = data.profile;
        // Extract country code from phone if it exists (format: +1234567890 or +1 5551234567)
        const phoneValue = profile.telephone || '';
        const countryCodeMatch = phoneValue.match(/^(\+\d{1,4})\s*/);
        const extractedCountryCode = countryCodeMatch ? countryCodeMatch[1] : '+1';
        const phoneWithoutCode = countryCodeMatch 
          ? phoneValue.replace(/^\+\d{1,4}\s*/, '').trim()
          : phoneValue.trim();
        
        setFormData({
          companyName: profile.company_name || '',
          contactEmail: profile.contact_email || profile.email_contact || '',
          countryCode: extractedCountryCode,
          phone: phoneWithoutCode,
          address: profile.address && typeof profile.address === 'object' 
            ? {
                street: profile.address.street || '',
                city: profile.address.city || '',
                state: profile.address.state || '',
                zip: profile.address.zip || '',
                country: profile.address.country || '',
              }
            : {
                street: '',
                city: '',
                state: '',
                zip: '',
                country: '',
              },
        });
      } catch (error: any) {
        console.error('Error loading account data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load account information',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadAccountData();
  }, [router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast({
          title: 'Error',
          description: 'Failed to get session. Please sign in again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const response = await fetch('/api/account', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userType,
          companyName: formData.companyName,
          contactEmail: formData.contactEmail,
          phone: `${formData.countryCode} ${formData.phone}`.trim(),
          address: formData.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account');
      }

      toast({
        title: 'Success',
        description: 'Account information updated successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error updating account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update account information',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="center" justify="center" minH="400px">
          <Spinner size="xl" color="cyan.700" />
          <Text>Loading account information...</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box>
          <HStack justify="space-between" align="flex-start" mb={4}>
            <VStack align="start" spacing={2}>
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
                onClick={() => router.push(userType === 'buyer' ? '/dashboards/buyer' : '/dashboards/seller')}
              >
                Back to Dashboard
              </Button>
              <Heading size="xl" color="cyan.800">
                Account Settings
              </Heading>
            </VStack>
            <DarkModeToggle size="sm" color="teal.600" />
          </HStack>
        </Box>

        {/* Account Form */}
        <Card>
          <CardHeader>
            <Heading size="md">Contact Information</Heading>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit}>
              <VStack spacing={6} align="stretch">
                <FormControl isRequired>
                  <FormLabel>Company Name</FormLabel>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Enter company name"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Contact Email</FormLabel>
                  <Input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="Enter contact email"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <HStack spacing={2}>
                    <Select
                      value={formData.countryCode}
                      onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                      maxW="140px"
                    >
                      {COUNTRY_CODES.map((item, index) => (
                        <option key={`${item.code}-${index}`} value={item.code}>
                          {item.flag} {item.code}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone number"
                      flex={1}
                    />
                  </HStack>
                </FormControl>

                <Box>
                  <Text fontWeight="semibold" mb={4}>Address</Text>
                  <VStack spacing={4} align="stretch">
                    <FormControl>
                      <FormLabel>Street</FormLabel>
                      <Input
                        value={formData.address.street}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, street: e.target.value }
                        })}
                        placeholder="Enter street address"
                      />
                    </FormControl>

                    <HStack spacing={4}>
                      <FormControl>
                        <FormLabel>City</FormLabel>
                        <Input
                          value={formData.address.city}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: { ...formData.address, city: e.target.value }
                          })}
                          placeholder="Enter city"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>State</FormLabel>
                        <Input
                          value={formData.address.state}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: { ...formData.address, state: e.target.value }
                          })}
                          placeholder="Enter state"
                        />
                      </FormControl>

                      <FormControl>
                        <FormLabel>ZIP Code</FormLabel>
                        <Input
                          value={formData.address.zip}
                          onChange={(e) => setFormData({
                            ...formData,
                            address: { ...formData.address, zip: e.target.value }
                          })}
                          placeholder="Enter ZIP code"
                        />
                      </FormControl>
                    </HStack>

                    <FormControl>
                      <FormLabel>Country</FormLabel>
                      <Select
                        value={formData.address.country}
                        onChange={(e) => setFormData({
                          ...formData,
                          address: { ...formData.address, country: e.target.value }
                        })}
                        placeholder="Select country"
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

                <HStack justify="flex-end" spacing={4}>
                  <Button
                    variant="outline"
                    onClick={() => router.push(userType === 'buyer' ? '/dashboards/buyer' : '/dashboards/seller')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    colorScheme="cyan"
                    isLoading={saving}
                    loadingText="Saving..."
                  >
                    Save Changes
                  </Button>
                </HStack>
              </VStack>
            </form>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}

