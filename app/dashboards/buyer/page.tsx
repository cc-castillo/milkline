'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Button,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Card,
  CardBody,
  CardHeader,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  useColorMode,
  IconButton,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getStatusColor } from '@/lib/utils';
import { listMyRFQs } from '@/lib/rfqs';
import { DarkModeToggle } from '@/components/DarkModeToggle';

interface RFQ {
  id: string;
  milkType: string;
  quantityLiters: number;
  neededByDate: string;
  budgetMax?: number;
  status: 'open' | 'quoted' | 'ordered' | 'fulfilled' | 'cancelled';
  quotesCount: number;
  createdAt: string;
}

interface Quote {
  id: string;
  rfqId: string;
  milkType: string;
  sellerName: string;
  pricePerLiter: number;
  totalPrice: number;
  deliveryDate: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export default function MilkLineDashboard() {
  const toast = useToast();
  const router = useRouter();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>('');

  // Color for StatNumber in dark mode
  const statNumberColor = useColorModeValue('inherit', 'gray.300');

  // Load user data and RFQs
  useEffect(() => {
    const loadData = async () => {
      try {
        // Optimize: Get session first (faster check)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        // Handle session errors
        if (sessionError) {
          if (sessionError.message?.includes('Refresh Token') || sessionError.message?.includes('JWT')) {
            toast({
              title: 'Session Expired',
              description: 'Please sign in again.',
              status: 'warning',
              duration: 3000,
              isClosable: true,
            });
            await supabase.auth.signOut();
            router.push('/signin');
            return;
          }
          throw sessionError;
        }
        
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
        
        // Handle refresh token errors
        if (authError) {
          if (authError.message?.includes('Refresh Token') || authError.message?.includes('JWT')) {
            toast({
              title: 'Session Expired',
              description: 'Please sign in again.',
              status: 'warning',
              duration: 3000,
              isClosable: true,
            });
            await supabase.auth.signOut();
            router.push('/signin');
            return;
          }
          throw authError;
        }
        
        if (!user) {
          router.push('/signin');
          return;
        }

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          
          if (profileData.userType === 'buyer' && profileData.profile) {
            setCompanyName(profileData.profile.company_name);
          } else if (profileData.userType === 'seller') {
            // User is a seller, redirect
            router.push('/dashboards/seller');
            return;
          } else {
            toast({
              title: 'Profile Not Found',
              description: 'Your buyer profile could not be found. Please complete your signup.',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
            setLoading(false);
            return;
          }
        } else {
          const errorData = await profileResponse.json();
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

        // Load RFQs
        const myRFQs = await listMyRFQs();
        const transformedRFQs: RFQ[] = myRFQs.map(rfq => {
          // Parse quote_ids from text column to count quotes
          let quotesCount = 0;
          if (rfq.quote_ids) {
            try {
              // Try parsing as JSON array first
              const quoteIdsArray = JSON.parse(rfq.quote_ids);
              if (Array.isArray(quoteIdsArray)) {
                quotesCount = quoteIdsArray.length;
              }
            } catch {
              // If not JSON, try comma-separated string
              if (typeof rfq.quote_ids === 'string' && rfq.quote_ids.trim()) {
                const quoteIdsArray = rfq.quote_ids.split(',').filter(id => id.trim());
                quotesCount = quoteIdsArray.length;
              }
            }
          }

          return {
            id: rfq.rfq_id,
            milkType: rfq.milk_type,
            quantityLiters: Number(rfq.quantity_liters),
            neededByDate: rfq.needed_by_date,
            budgetMax: rfq.budget_max ? Number(rfq.budget_max) : undefined,
            status: rfq.status,
            quotesCount: quotesCount,
            createdAt: rfq.created_at,
          };
        });

        // Load quotes for all RFQs
        // Use the rfq_id values directly from the database response
        const rfqIds = myRFQs.map(r => r.rfq_id).filter(Boolean);
        if (rfqIds.length > 0) {
          // Fetch full quote data for display
          const { data: fullQuotesData } = await supabase
            .from('Quotes')
            .select('*')
            .in('rfq_id', rfqIds);

          if (fullQuotesData && fullQuotesData.length > 0) {
            // Get unique seller IDs
            const sellerIds = Array.from(new Set(fullQuotesData.map((q: any) => q.seller_id).filter(Boolean)));
            
            // Fetch seller information via API route
            let sellerMap = new Map();
            if (sellerIds.length > 0) {
              const sellersResponse = await fetch('/api/quote/sellers', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ sellerIds }),
              });

              if (sellersResponse.ok) {
                const sellersData = await sellersResponse.json();
                if (sellersData.sellers) {
                  sellerMap = new Map(sellersData.sellers.map((s: any) => [s.id.toString(), s.company_name]));
                }
              }
            }

            const transformedQuotes: Quote[] = fullQuotesData.map((q: any) => ({
              id: q.id,
              rfqId: q.rfq_id,
              milkType: transformedRFQs.find(r => r.id === q.rfq_id)?.milkType || '',
              sellerName: sellerMap.get(q.seller_id?.toString()) || 'Unknown Seller',
              pricePerLiter: Number(q.price_per_liter),
              totalPrice: Number(q.total_price),
              deliveryDate: q.delivery_date,
              status: q.status,
            }));

            setQuotes(transformedQuotes);
          } else {
            setQuotes([]);
          }
        } else {
          // No RFQs - ensure all counts are 0
          transformedRFQs.forEach(rfq => {
            rfq.quotesCount = 0;
          });
          setQuotes([]);
        }

        setRfqs(transformedRFQs);
      } catch (error: any) {
        console.error('Error loading dashboard data:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load dashboard data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router, toast]);


  const handleAcceptQuote = (quote: Quote) => {
    toast({
      title: 'Quote Accepted',
      description: `Order created with ${quote.sellerName}`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
  };

  const handleRejectQuote = (quote: Quote) => {
    toast({
      title: 'Quote Rejected',
      description: `Quote from ${quote.sellerName} has been rejected`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to sign out. Please try again.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Signed Out',
          description: 'You have been successfully signed out.',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
        router.push('/signin');
      }
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while signing out.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleViewDetails = (rfqId: string) => {
    router.push(`/dashboards/buyer/rfq/${rfqId}`);
  };

  // Calculate stats
  const stats = {
    totalRFQs: rfqs.length,
    activeRFQs: rfqs.filter(r => r.status === 'open' || r.status === 'quoted').length,
    ordersInProgress: rfqs.filter(r => r.status === 'ordered').length,
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="center" justify="center" minH="400px">
          <Spinner size="xl" color="cyan.700" />
          <Text>Loading dashboard...</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box position="relative">
          <HStack justify="space-between" align="flex-start" mb={4}>
            <VStack align="start" spacing={2}>
              <Button
                variant="ghost"
                color="cyan.900"
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
              <VStack align="start" spacing={0} ml="24px">
                <Heading size="xl" color="cyan.800">
                  {companyName ? `${companyName}'s Dashboard` : 'Buyer Dashboard'}
                </Heading>
                <Text color="gray.600" fontSize="sm">
                  Account type: Buyer
                </Text>
              </VStack>
            </VStack>
            <HStack align="center" spacing={2}>
              <DarkModeToggle size="sm" color="teal.600" />
              <Menu>
                <MenuButton
                  as={IconButton}
                  variant="ghost"
                  color="gray.600"
                  icon={
                    <Icon viewBox="0 0 24 24" boxSize={5}>
                      <path
                        fill="currentColor"
                        d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                      />
                    </Icon>
                  }
                  aria-label="Account menu"
                >
                </MenuButton>
                <MenuList>
                  <MenuItem
                    icon={
                      <Icon viewBox="0 0 24 24" boxSize={4}>
                        <path
                          fill="currentColor"
                          d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
                        />
                      </Icon>
                    }
                    onClick={() => router.push('/dashboards/buyer/inbox')}
                  >
                    Inbox
                  </MenuItem>
                  <MenuItem
                    icon={
                      <Icon viewBox="0 0 24 24" boxSize={4}>
                        <path
                          fill="currentColor"
                          d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                        />
                      </Icon>
                    }
                    onClick={() => router.push('/account')}
                  >
                    Account Settings
                  </MenuItem>
                  <MenuItem
                    icon={
                      <Icon viewBox="0 0 24 24" boxSize={4}>
                        <path
                          fill="currentColor"
                          d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
                        />
                      </Icon>
                    }
                    onClick={handleLogout}
                  >
                    Logout
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </HStack>
        </Box>

        {/* Stats Overview */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} margin='24px'>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Total RFQs</StatLabel>
                <StatNumber color={statNumberColor}>{stats.totalRFQs}</StatNumber>
                <StatHelpText>All time</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Active RFQs</StatLabel>
                <StatNumber color={statNumberColor}>{stats.activeRFQs}</StatNumber>
                <StatHelpText>Open for quotes</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Orders in Progress</StatLabel>
                <StatNumber color={statNumberColor}>{stats.ordersInProgress}</StatNumber>
                <StatHelpText>Active orders</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Main Content Tabs */}
        <Tabs colorScheme="cyan" margin="24px">
          <TabList>
            <Tab>My RFQs</Tab>
            <Tab>
              Orders
              {stats.ordersInProgress > 0 && (
                <Badge ml={2} borderRadius="full">
                  {stats.ordersInProgress}
                </Badge>
              )}
            </Tab>
          </TabList>

          <TabPanels>
            {/* RFQs Tab */}
            <TabPanel px={0}>
              <Card>
                <CardHeader>
                  <HStack justify="space-between">
                    <Heading size="md">Request for Quote</Heading>
                    <Button 
                      bg="cyan.700"
                      color="white"
                      _hover={{ bg: 'cyan.600' }}
                      size="sm"   
                      onClick={() => router.push('/rfq/')}
                    >
                      Create New RFQ
                    </Button>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Milk Type</Th>
                          <Th isNumeric>Quantity (L)</Th>
                          <Th>Needed By</Th>
                          <Th isNumeric>Budget</Th>
                          <Th>Status</Th>
                          <Th isNumeric>Quotes</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {rfqs.length === 0 ? (
                          <Tr>
                            <Td colSpan={7} textAlign="center" py={8}>
                              <VStack spacing={4}>
                                <Text color="gray.500" fontSize="lg">
                                  No RFQs yet
                                </Text>
                                <Text color="gray.400" fontSize="sm">
                                  Create your first request for quote to get started
                                </Text>
                                <Button
                                  bg="cyan.700"
                                  color="white"
                                  _hover={{ bg: 'cyan.600' }}
                                  onClick={() => router.push('/rfq')}
                                >
                                  Create RFQ
                                </Button>
                              </VStack>
                            </Td>
                          </Tr>
                        ) : (
                          rfqs.map((rfq) => (
                          <Tr key={rfq.id}>
                            <Td fontWeight="medium">{rfq.milkType}</Td>
                            <Td isNumeric>{rfq.quantityLiters.toLocaleString()}</Td>
                            <Td>{new Date(rfq.neededByDate).toLocaleDateString()}</Td>
                            <Td isNumeric>
                              {rfq.budgetMax ? `$${rfq.budgetMax.toLocaleString()}` : 'N/A'}
                            </Td>
                            <Td>
                              <Badge colorScheme={getStatusColor(rfq.status)}>
                                {rfq.status.toUpperCase()}
                              </Badge>
                            </Td>
                            <Td isNumeric>
                              <Badge colorScheme="purple">{rfq.quotesCount}</Badge>
                            </Td>
                            <Td>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                borderColor="cyan.700"
                                color="cyan.700"
                                _hover={{ bg: 'cyan.50' }}
                                onClick={() => handleViewDetails(rfq.id)}
                              >
                                View Details
                              </Button>
                            </Td>
                          </Tr>
                          ))
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                </CardBody>
              </Card>
            </TabPanel>

            {/* Quotes Tab */}
            <TabPanel px={0}>
              <Card>
                <CardHeader>
                  <Heading size="md">Orders</Heading>
                </CardHeader>
                <CardBody>
                  {quotes.length === 0 ? (
                    <VStack spacing={4} py={8}>
                      <Text color="gray.500" fontSize="lg">
                        No orders received yet
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Orders will appear here once your RFQs are accepted
                      </Text>
                    </VStack>
                  ) : (
                    <VStack spacing={4} align="stretch">
                      {quotes.map((quote) => (
                      <Card key={quote.id} variant="outline">
                        <CardBody>
                          <VStack spacing={3} align="stretch">
                            <HStack justify="space-between">
                              <Box>
                                <Text fontWeight="bold" fontSize="lg">
                                  {quote.sellerName}
                                </Text>
                                <Text color="gray.600" fontSize="sm">
                                  {quote.milkType}
                                </Text>
                              </Box>
                              <Badge colorScheme={getStatusColor(quote.status)} fontSize="md">
                                {quote.status.toUpperCase()}
                              </Badge>
                            </HStack>

                            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                              <Box>
                                <Text fontSize="sm" color="gray.600">
                                  Price per Liter
                                </Text>
                                <Text fontWeight="bold" fontSize="lg">
                                  ${quote.pricePerLiter.toFixed(2)}
                                </Text>
                              </Box>
                              <Box>
                                <Text fontSize="sm" color="gray.600">
                                  Total Price
                                </Text>
                                <Text fontWeight="bold" fontSize="lg" color="cyan.700">
                                  ${quote.totalPrice.toLocaleString()}
                                </Text>
                              </Box>
                              <Box>
                                <Text fontSize="sm" color="gray.600">
                                  Delivery Date
                                </Text>
                                <Text fontWeight="bold" fontSize="lg">
                                  {new Date(quote.deliveryDate).toLocaleDateString()}
                                </Text>
                              </Box>
                            </SimpleGrid>
                          </VStack>
                        </CardBody>
                      </Card>
                      ))}
                    </VStack>
                  )}
                </CardBody>
              </Card>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
}