'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  useToast,
  Alert,
  AlertIcon,
  useColorModeValue,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { createRFQ } from '@/lib/rfqs';
import { supabase } from '@/lib/supabase';

interface RFQFormData {
  closingDate: string;
  milkType: string;
  milkQuantity: number;
  budget: number;
  neededByDate: string;
  notes: string;
}

export default function RFQRequestForm() {
  const toast = useToast();
  const todayISO = new Date().toISOString().split('T')[0];
  const router = useRouter();
  const cardBg = useColorModeValue('gray.50', 'gray.800');

  const [formData, setFormData] = useState<RFQFormData>({
    closingDate: todayISO,
    milkType: '',
    milkQuantity: 0,
    budget: 0,
    neededByDate: todayISO,
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Get current user and profile on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (currentUser) {
          setUser(currentUser);
          // Get session token for API call
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;

          if (!token) {
            toast({
              title: 'Error',
              description: 'Failed to get session. Please sign in again.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
            router.push('/signin');
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
            
            if (profileData.userType === 'buyer' && profileData.profile) {
              setCompanyName(profileData.profile.company_name);
              setLoading(false);
            } else if (profileData.userType === 'seller') {
              // User is a seller, redirect to seller dashboard
              router.push('/dashboards/seller');
              return;
            } else {
              toast({
                title: 'Buyer Profile Not Found',
                description: 'You must be a buyer to create RFQs. Please complete your buyer signup.',
                status: 'error',
                duration: 5000,
                isClosable: true,
              });
              setLoading(false);
              return;
            }
          } else {
            const errorData = await response.json();
            toast({
              title: 'Error',
              description: errorData.error || 'Failed to load profile',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
            setLoading(false);
            return;
          }
        } else {
          // Not logged in, redirect to sign in
          router.push('/signin');
        }
      } catch (error: any) {
        console.error('Error loading user:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load user information',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        setLoading(false);
      } finally {
        // Only set loading to false if we haven't already (to avoid double-setting)
        // The loading state will be set to false in the success/error paths above
      }
    };

    loadUser();
  }, [router, toast]);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Validation
    if (
      !formData.closingDate ||
      !formData.milkType.trim() ||
      formData.milkQuantity <= 0 ||
      formData.budget <= 0 ||
      !formData.neededByDate
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setIsSubmitting(false);
      return;
    }

    if (new Date(formData.closingDate) > new Date(formData.neededByDate)) {
      toast({
        title: 'Invalid Dates',
        description: 'Closing date for bidding must be on or before the needed-by date.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Create RFQ in Supabase
      const rfq = await createRFQ({
        closingDate: formData.closingDate,
        milkType: formData.milkType,
        milkQuantity: formData.milkQuantity,
        budget: formData.budget,
        neededByDate: formData.neededByDate,
        notes: formData.notes || undefined,
      });

      toast({
        title: 'RFQ Submitted Successfully',
        description: `Your request for quote (${String(rfq.rfq_id).slice(0, 8)}...) has been created and sent to suppliers.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Reset form
      setFormData({
        closingDate: todayISO,
        milkType: '',
        milkQuantity: 0,
        budget: 0,
        neededByDate: todayISO,
        notes: '',
      });

      // Optionally redirect to dashboard or RFQ list
      setTimeout(() => {
        router.push('/dashboards/buyer');
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting RFQ:', error);
      toast({
        title: 'Submission Failed',
        description: error.message || 'Please try again later',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" py={8} bg="gray.50">
        <Container maxW="container.lg">
          <Text>Loading...</Text>
        </Container>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box minH="100vh" py={8} bg="gray.50">
        <Container maxW="container.lg">
          <Alert status="warning">
            <AlertIcon />
            You must be logged in to create an RFQ. Redirecting to sign in...
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      minH="100vh"
      py={8}
      bgImage="url('/Milky.jpg')"
      bgSize="cover"
      bgPosition="center"
      bgRepeat="no-repeat"
      bgColor="gray.50"
    >
      <Container maxW="container.lg">
        <VStack gap={6} align="stretch">
          <Button
          variant="ghost"
          color="cyan.900"
          alignSelf="flex-start"
          leftIcon={
            <Icon viewBox="0 0 24 24" boxSize={5}>
              <path
                fill="currentColor"
                d="M12 3.172 3 10.5V21h6v-5h6v5h6V10.5l-9-7.328Zm0-2.344 10 8.148V23h-8v-5H10v5H2V8.976l10-8.148Z"
              />
            </Icon>
          }
          onClick={() => router.push('/')}
        >
            Home
          </Button>

          <Box>
            <Heading size="lg" textAlign="center" color="cyan.900" mb={2}>
              Request for Quote
            </Heading>
            <Text color="cyan.700" textAlign="center">
              Provide the details of the milk you need and we&apos;ll notify suppliers.
            </Text>
          </Box>

          {/* Auto-filled Info */}
          <Card bg={cardBg} opacity={0.9}>
            <CardBody>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Company
                  </Text>
                  <Text fontWeight="bold" fontSize="lg">
                    {companyName || 'Loading...'}
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Current Date
                  </Text>
                  <Text fontWeight="bold" fontSize="lg">
                    {new Date(todayISO).toLocaleDateString()}
                  </Text>
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>

          {/* RFQ Form */}
          <Card opacity={0.9}>
            <CardBody>
              <VStack gap={5} alignItems="stretch" >
                <Heading size="md">RFQ Details</Heading>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} >
                  <FormControl isRequired>
                    <FormLabel>Closing Date for Bidding</FormLabel>
                    <Input
                      type="date"
                      min={todayISO}
                      value={formData.closingDate}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, closingDate: e.target.value }))
                      }
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Milk Type</FormLabel>
                    <Select
                      placeholder="Select milk type"
                      value={formData.milkType}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, milkType: e.target.value }))
                      }
                    >
                      <option value="Almond">Almond</option>
                      <option value="Coconut">Coconut</option>
                      <option value="Cow">Cow</option>
                      <option value="Oat">Oat</option>
                      <option value="Soy">Soy</option>
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Milk Quantity (Liters)</FormLabel>
                    <NumberInput
                      min={0}
                      precision={0}
                      value={formData.milkQuantity}
                      onChange={(_, valueNumber) =>
                        setFormData(prev => ({
                          ...prev,
                          milkQuantity: Number.isNaN(valueNumber) ? 0 : valueNumber,
                        }))
                      }
                    >
                      <NumberInputField placeholder="Enter total liters needed" />
                    </NumberInput>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Budget ($)</FormLabel>
                    <NumberInput
                      min={0}
                      precision={2}
                      step={100}
                      value={formData.budget}
                      onChange={(_, valueNumber) =>
                        setFormData(prev => ({
                          ...prev,
                          budget: Number.isNaN(valueNumber) ? 0 : valueNumber,
                        }))
                      }
                      format={(value) =>
                        new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        }).format(value === '' ? 0 : Number(value))
                      }
                      parse={(value) => value.replace(/,/g, '')}
                    >
                      <NumberInputField placeholder="Maximum budget for this RFQ" />
                    </NumberInput>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Needed By Date</FormLabel>
                    <Input
                      type="date"
                      min={todayISO}
                      value={formData.neededByDate}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, neededByDate: e.target.value }))
                      }
                    />
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel>Additional Notes (Optional)</FormLabel>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Include delivery windows, quality requirements, certifications, etc."
                    rows={4}
                  />
                </FormControl>
                <Divider />
                <Box bg="orange.50" p={4} borderRadius="md">
                  <Text fontSize="sm" color="yellow.900">
                    <strong>Important:</strong> Suppliers will use this information to craft their
                    quotes. Ensure your dates and budget accurately reflect your procurement needs.
                  </Text>
                </Box>
                <Button
                  onClick={handleSubmit}
                  bg="cyan.700"
                  isLoading={isSubmitting}
                  loadingText="Submitting RFQ"
                >
                  Submit RFQ
                </Button>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </Container>
    </Box>
  );
}