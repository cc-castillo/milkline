'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Divider,
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
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { GenerateAIMessageButton } from '@/components/GenerateAIMessageButton';
import { capitalizeFirstLetter, getStatusColor } from '@/lib/utils';

interface RFQ {
  id: string;
  milkType: string;
  quantityLiters: number;
  neededByDate: string;
  budgetMax?: number;
  status: 'open' | 'quoted' | 'ordered' | 'fulfilled' | 'cancelled';
  quotesCount: number;
  createdAt: string;
  buyerName?: string;
}

interface Quote {
  id: string;
  rfqId: string;
  milkType: string;
  sellerName: string;
  buyerName?: string; // Buyer's company name from the RFQ
  buyerId?: string; // Buyer's ID from the RFQ
  quantityLiters?: number; // Quantity requested from the RFQ
  pricePerLiter: number;
  totalPrice: number;
  deliveryDate: string;
  notes?: string; // Optional notes from the quote
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

export default function MilkLineDashboard() {
  const toast = useToast();
  const router = useRouter();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sellerName, setSellerName] = useState<string>('');
  const [sellerId, setSellerId] = useState<number | null>(null);

  // Color for StatNumber in dark mode
  const statNumberColor = useColorModeValue('inherit', 'gray.300');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    pricePerLiter: '',
    deliveryDate: '',
    notes: '',
  });
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quotesCacheValid, setQuotesCacheValid] = useState(false); // Track if quotes cache is valid
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [quoteToCancel, setQuoteToCancel] = useState<Quote | null>(null);
  const [selectedQuoteForMessage, setSelectedQuoteForMessage] = useState<Quote | null>(null);
  const [selectedOrderForMessage, setSelectedOrderForMessage] = useState<any | null>(null);
  const [messageContent, setMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const { isOpen: isQuoteModalOpen, onOpen: onQuoteModalOpen, onClose: onQuoteModalClose } = useDisclosure();
  const { isOpen: isQuoteDetailsModalOpen, onOpen: onQuoteDetailsModalOpen, onClose: onQuoteDetailsModalClose } = useDisclosure();
  const { isOpen: isCancelConfirmModalOpen, onOpen: onCancelConfirmModalOpen, onClose: onCancelConfirmModalClose } = useDisclosure();
  const { isOpen: isMessageModalOpen, onOpen: onMessageModalOpen, onClose: onMessageModalClose } = useDisclosure();

  // Color mode values - must be called at top level, before any conditional returns
  const inputBg = useColorModeValue('white', 'gray.700');
  const inputColor = useColorModeValue('gray.800', 'gray.100');
  const inputBorderColor = useColorModeValue('gray.300', 'gray.600');
  const inputPlaceholderColor = useColorModeValue('gray.400', 'gray.500');
  const textareaBg = useColorModeValue('white', 'gray.700');
  const textareaColor = useColorModeValue('gray.800', 'gray.100');
  const textareaBorderColor = useColorModeValue('gray.300', 'gray.600');
  const textareaPlaceholderColor = useColorModeValue('gray.400', 'gray.500');

  // Load user data and RFQs
  useEffect(() => {
    const loadData = async () => {
      try {
        // Get current user with error handling for refresh token issues
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        // Handle refresh token errors
        if (userError) {
          if (userError.message?.includes('Refresh Token') || userError.message?.includes('JWT')) {
            // Session expired or invalid - redirect to signin
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
          throw userError;
        }
        
        if (!user) {
          router.push('/signin');
          return;
        }

        // Get session token for API call
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

        // Use API route with admin client to bypass RLS
        const response = await fetch('/api/seller-profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        let currentSellerId: number | null = null;
        let currentSellerName = '';

        if (response.ok) {
          const profileData = await response.json();
          
          if (profileData.userType === 'seller' && profileData.profile) {
            currentSellerName = profileData.profile.company_name || '';
            currentSellerId = profileData.profile.id;
            setSellerName(currentSellerName);
            setSellerId(currentSellerId);
          } else if (profileData.userType === 'buyer') {
            // User is a buyer, redirect
            router.push('/dashboards/buyer');
            return;
          } else {
            toast({
              title: 'Profile Not Found',
              description: 'Your seller profile could not be found. Please complete your signup.',
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

        // Load open RFQs (for sellers to see) using API route with admin client
        const rfqResponse = await fetch('/api/rfq/open', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!rfqResponse.ok) {
          const errorData = await rfqResponse.json();
          throw new Error(errorData.error || 'Failed to load RFQs');
        }

        const rfqData = await rfqResponse.json();
        const openRFQs = rfqData.rfqs || [];
        
        const transformedRFQs: RFQ[] = openRFQs.map((rfq: any) => ({
          id: rfq.rfq_id,
          milkType: rfq.milk_type,
          quantityLiters: Number(rfq.quantity_liters),
          neededByDate: rfq.needed_by_date,
          budgetMax: rfq.budget_max ? Number(rfq.budget_max) : undefined,
          status: rfq.status,
          quotesCount: 0, // Will be updated below
          createdAt: rfq.created_at,
          buyerName: rfq.buyer?.company_name || 'Unknown Buyer',
        }));

        // Load quotes submitted by this seller from the Quotes table
        // Use cached function that filters by seller_id
        if (currentSellerId) {
          await fetchMyQuotes(token, false); // Use cache if available
          await fetchOrders(token); // Fetch orders
        }

        // Load all quotes for open RFQs to get accurate counts
        const rfqIds = transformedRFQs.map(r => r.id);
        if (rfqIds.length > 0) {
          const { data: allQuotes } = await supabase
            .from('Quotes')
            .select('rfq_id')
            .in('rfq_id', rfqIds);

          if (allQuotes) {
            const quoteCounts = new Map<string, number>();
            allQuotes.forEach((q: any) => {
              const count = quoteCounts.get(q.rfq_id) || 0;
              quoteCounts.set(q.rfq_id, count + 1);
            });

            transformedRFQs.forEach(rfq => {
              rfq.quotesCount = quoteCounts.get(rfq.id) || 0;
            });
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, toast]);


  const handleViewQuoteDetails = (quote: Quote) => {
    setSelectedQuote(quote);
    onQuoteDetailsModalOpen();
  };

  const handleAcceptQuote = (quote: Quote) => {
    toast({
      title: 'Quote Accepted',
      description: `Order created with ${quote.sellerName}`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
  };

  const handleCancelQuote = (quote: Quote) => {
    setQuoteToCancel(quote);
    onCancelConfirmModalOpen();
  };

  const handleMessageBuyer = (quote: Quote) => {
    setSelectedQuoteForMessage(quote);
    setSelectedOrderForMessage(null);
    setMessageContent('');
    onMessageModalOpen();
  };

  const handleMessageBuyerFromOrder = (order: any) => {
    setSelectedOrderForMessage(order);
    setSelectedQuoteForMessage(null);
    setMessageContent('');
    onMessageModalOpen();
  };

  const handleGenerateAIMessage = async () => {
    const currentContext = selectedQuoteForMessage || selectedOrderForMessage;
    if (!currentContext || !currentContext.buyerId || !currentContext.buyerName) {
      toast({
        title: 'Error',
        description: 'Unable to generate AI response. Please ensure all required information is available.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setGeneratingAI(true);
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

      const response = await fetch('/api/messages/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationHistory: [], // Empty for new message
          buyerName: currentContext.buyerName,
          rfqContext: {
            milkType: currentContext.milkType,
            quantityLiters: currentContext.quantityLiters || 0,
          },
          isSellerContext: true, // Indicate this is from a seller
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate AI response';
        try {
          const errorText = await response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            if (typeof errorData.error === 'string') {
              errorMessage = errorData.error;
            } else if (errorData.error.message) {
              errorMessage = errorData.error.message;
            } else {
              errorMessage = JSON.stringify(errorData.error);
            }
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else {
            errorMessage = errorText || errorMessage;
          }
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = `Invalid response from server: ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setMessageContent(data.message || '');
      
      toast({
        title: 'AI Response Generated',
        description: 'The AI response has been added to your message field. You can edit it before sending.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate AI response',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSendMessage = async () => {
    const currentContext = selectedQuoteForMessage || selectedOrderForMessage;
    if (!currentContext || !messageContent.trim() || !currentContext.buyerId) {
      toast({
        title: 'Error',
        description: 'Please enter a message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setSendingMessage(true);

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

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          buyerId: currentContext.buyerId,
          sellerId: sellerId,
          content: messageContent.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      toast({
        title: 'Message Sent',
        description: 'Your message has been sent to the buyer.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setMessageContent('');
      onMessageModalClose();
      setSelectedQuoteForMessage(null);
      setSelectedOrderForMessage(null);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const confirmCancelQuote = async () => {
    if (!quoteToCancel) return;

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
        onCancelConfirmModalClose();
        return;
      }

      const response = await fetch('/api/quote/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          quoteId: quoteToCancel.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel quote');
      }

      toast({
        title: 'Quote Cancelled',
        description: 'Your quote has been cancelled successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Invalidate cache and reload quotes
      setQuotesCacheValid(false);
      if (sellerId && token) {
        await fetchMyQuotes(token, true);
      }

      onCancelConfirmModalClose();
      setQuoteToCancel(null);
    } catch (error: any) {
      console.error('Error cancelling quote:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel quote',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleQuoteRFQ = (rfq: RFQ) => {
    setSelectedRFQ(rfq);
    setQuoteForm({
      pricePerLiter: '',
      deliveryDate: '',
      notes: '',
    });
    onQuoteModalOpen();
  };

  // Function to fetch quotes with caching
  const fetchMyQuotes = async (token: string, forceRefresh: boolean = false): Promise<Quote[]> => {
    // Return cached data if available and cache is valid
    if (!forceRefresh && quotesCacheValid && quotes.length > 0) {
      console.log('Using cached quotes');
      return quotes;
    }

    // Fetch from API
    const quotesResponse = await fetch('/api/rfq/my-quotes', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!quotesResponse.ok) {
      console.error('Error fetching my quotes');
      return quotes; // Return existing quotes on error
    }

    const quotesData = await quotesResponse.json();
    const myQuotes = quotesData.quotes || [];

    console.log('Fetched quotes from database:', { count: myQuotes.length, sellerId });

    // Transform quotes
    const transformedQuotes: Quote[] = myQuotes.map((q: any) => ({
      id: q.id,
      rfqId: q.rfq_id,
      milkType: q.rfq?.milk_type || '',
      sellerName: sellerName,
      buyerName: q.rfq?.buyer?.company_name || 'Unknown Buyer',
      buyerId: q.rfq?.buyer_id || q.rfq?.buyer?.id || undefined,
      quantityLiters: q.rfq?.quantity_liters ? Number(q.rfq.quantity_liters) : undefined,
      pricePerLiter: Number(q.price_per_liter) || 0,
      totalPrice: Number(q.total_price) || 0,
      deliveryDate: q.delivery_date || '',
      notes: q.notes || undefined,
      status: q.status,
    }));

    // Update state and mark cache as valid
    setQuotes(transformedQuotes);
    setQuotesCacheValid(true);

    return transformedQuotes;
  };

  const fetchOrders = async (token: string) => {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/orders/seller', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch orders:', response.status, errorText);
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      console.log('Orders fetched:', data.orders?.length || 0, 'orders');
      setOrders(data.orders || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load orders',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleLogout = async () => {
    // Clear cache on logout
    setQuotesCacheValid(false);
    setQuotes([]);
    setOrders([]);
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

  const handleSubmitQuote = async () => {
    if (!selectedRFQ || !sellerId) {
      toast({
        title: 'Error',
        description: 'Missing required information',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!quoteForm.pricePerLiter || !quoteForm.deliveryDate) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setSubmittingQuote(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Failed to get session');
      }

      const response = await fetch('/api/quote/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rfqId: selectedRFQ.id,
          pricePerLiter: parseFloat(quoteForm.pricePerLiter),
          deliveryDate: quoteForm.deliveryDate,
          notes: quoteForm.notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create quote');
      }

      toast({
        title: 'Quote Submitted',
        description: 'Your quote has been submitted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      onQuoteModalClose();
      
      // Invalidate cache and reload quotes immediately after new quote submission
      setQuotesCacheValid(false);
      
      if (sellerId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const reloadToken = sessionData?.session?.access_token;

        if (reloadToken) {
          // Force refresh to get the newly added quote
          await fetchMyQuotes(reloadToken, true);
        }
      }

      // Reload full data in background
      const loadData = async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const reloadToken = sessionData?.session?.access_token;

        if (!reloadToken) {
          return;
        }

        const rfqResponse = await fetch('/api/rfq/open', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${reloadToken}`,
          },
        });

        if (!rfqResponse.ok) {
          return;
        }

        const rfqData = await rfqResponse.json();
        const openRFQs = rfqData.rfqs || [];
        
        const transformedRFQs: RFQ[] = openRFQs.map((rfq: any) => ({
          id: rfq.rfq_id,
          milkType: rfq.milk_type,
          quantityLiters: Number(rfq.quantity_liters),
          neededByDate: rfq.needed_by_date,
          budgetMax: rfq.budget_max ? Number(rfq.budget_max) : undefined,
          status: rfq.status,
          quotesCount: 0,
          createdAt: rfq.created_at,
          buyerName: rfq.buyer?.company_name || 'Unknown Buyer',
        }));

        if (sellerId) {
          // Use cached function - will use cache if valid, otherwise fetch
          await fetchMyQuotes(reloadToken, false);

          // Load all quotes for accurate counts
          const rfqIds = transformedRFQs.map(r => r.id);
          if (rfqIds.length > 0) {
            const { data: allQuotes } = await supabase
            .from('Quotes')
            .select('rfq_id')
            .in('rfq_id', rfqIds);

          if (allQuotes) {
            const quoteCounts = new Map<string, number>();
            allQuotes.forEach((q: any) => {
              const count = quoteCounts.get(q.rfq_id) || 0;
              quoteCounts.set(q.rfq_id, count + 1);
            });

            transformedRFQs.forEach(rfq => {
              rfq.quotesCount = quoteCounts.get(rfq.id) || 0;
            });
          }
          }
        }

        setRfqs(transformedRFQs);
      };

      loadData();
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit quote',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmittingQuote(false);
    }
  };

  // Calculate stats
  const stats = {
    totalRFQs: rfqs.length,
    activeRFQs: rfqs.filter(r => r.status === 'open' || r.status === 'quoted').length,
    pendingQuotes: quotes.filter(q => q.status === 'pending').length,
    ordersInProgress: orders.filter(o => o.status === 'created' || o.status === 'confirmed' || o.status === 'in_transit').length,
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
                  {sellerName ? `${sellerName}'s Dashboard` : 'Seller Dashboard'}
                </Heading>
                <Text color="gray.600" fontSize="sm">
                  Account type: Seller
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
                    onClick={() => router.push('/dashboards/seller/inbox')}
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
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} m="24px">
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
                <StatHelpText>Waiting for quotes</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>Pending Quotes</StatLabel>
                <StatNumber color={statNumberColor}>{stats.pendingQuotes}</StatNumber>
                <StatHelpText>Awaiting review from buyer</StatHelpText>
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
            <Tab>Incoming RFQs</Tab>
            <Tab>
              My Quotes
              {stats.pendingQuotes > 0 && (
                <Badge ml={2} colorScheme="red" borderRadius="full">
                  {stats.pendingQuotes}
                </Badge>
              )}
            </Tab>
            <Tab>
              Orders
              {stats.ordersInProgress > 0 && (
                <Badge ml={2} colorScheme="green" borderRadius="full">
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
                    <Heading size="md">Request for Quotes</Heading>
                  </HStack>
                </CardHeader>
                <CardBody>
                  <Box overflowX="auto">
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Buyer</Th>
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
                            <Td colSpan={8} textAlign="center" py={8}>
                              <VStack spacing={4}>
                                <Text color="gray.500" fontSize="lg">
                                  No open RFQs available
                                </Text>
                                <Text color="gray.400" fontSize="sm">
                                  Check back later for new requests for quotes
                                </Text>
                              </VStack>
                            </Td>
                          </Tr>
                        ) : (
                          rfqs.map((rfq) => (
                          <Tr key={rfq.id}>
                            <Td fontWeight="medium">{rfq.buyerName}</Td>
                            <Td fontWeight="medium">{capitalizeFirstLetter(rfq.milkType)}</Td>
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
                              <HStack spacing={2}>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  borderColor="cyan.700"
                                  color="cyan.700"
                                  _hover={{ bg: 'cyan.50' }}
                                  onClick={() => handleQuoteRFQ(rfq)}
                                  isDisabled={rfq.status !== 'open'}
                                >
                                  Quote
                                </Button>
                              </HStack>
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
                  <Heading size="md">My Quotes</Heading>
                </CardHeader>
                <CardBody>
                  {quotes.length === 0 ? (
                    <VStack spacing={4} py={8}>
                      <Text color="gray.500" fontSize="lg">
                        No quotes submitted yet
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Submit quotes on open RFQs to see them here
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
                                  {quote.buyerName || 'Unknown Buyer'}
                                </Text>
                              </Box>
                              <Badge colorScheme={getStatusColor(quote.status)} fontSize="md">
                                {quote.status.toUpperCase()}
                              </Badge>
                            </HStack>

                            <SimpleGrid columns={{ base: 1, md: 5 }} spacing={4}>
                              <Box>
                                <Text fontSize="sm" color="gray.600">
                                  Milk Type
                                </Text>
                                <Text fontWeight="bold" fontSize="lg">
                                  {capitalizeFirstLetter(quote.milkType)}
                                </Text>
                              </Box>
                              <Box>
                                <Text fontSize="sm" color="gray.600">
                                  Quantity
                                </Text>
                                <Text fontWeight="bold" fontSize="lg">
                                  {quote.quantityLiters ? `${quote.quantityLiters.toLocaleString()} L` : 'N/A'}
                                </Text>
                              </Box>
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

                            <HStack spacing={3} pt={2}>
                              <Button
                                bg="cyan.700"
                                color="white"
                                _hover={{ bg: 'cyan.300' }}
                                size="sm"
                                onClick={() => handleViewQuoteDetails(quote)}
                              >
                                View Details
                              </Button>
                              {quote.status === 'pending' && (
                                <>
                                  <Button
                                    bg="pink.100"
                                    color="red.700"
                                    _hover={{ bg: 'pink.300'}}
                                    size="sm"
                                    onClick={() => handleCancelQuote(quote)}
                                  >
                                    Cancel Quote
                                  </Button>
                                  <Button 
                                    size="sm"
                                    bg="cyan.50"
                                    color="cyan.700" 
                                    _hover={{ bg: 'cyan.300' }}
                                    onClick={() => handleMessageBuyer(quote)}
                                  >
                                    Message Buyer
                                  </Button>
                                </>
                              )}
                            </HStack>
                          </VStack>
                        </CardBody>
                      </Card>
                      ))}
                    </VStack>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            {/* Orders Tab */}
            <TabPanel px={0}>
              <Card>
                <CardHeader>
                  <Heading size="md">Orders</Heading>
                </CardHeader>
                <CardBody>
                  {loadingOrders ? (
                    <VStack spacing={4} py={8} align="center">
                      <Spinner size="xl" color="cyan.700" />
                      <Text>Loading orders...</Text>
                    </VStack>
                  ) : orders.length === 0 ? (
                    <VStack spacing={4} py={8}>
                      <Text color="gray.500" fontSize="lg">
                        No orders yet
                      </Text>
                      <Text color="gray.400" fontSize="sm">
                        Orders will appear here once buyers accept your quotes
                      </Text>
                    </VStack>
                  ) : (
                    <VStack spacing={4} align="stretch">
                      {orders.map((order) => (
                        <Card key={order.orderId} variant="outline">
                          <CardBody>
                            <VStack spacing={3} align="stretch">
                              <HStack justify="space-between">
                                <Box>
                                  <Text fontWeight="bold" fontSize="lg">
                                    {order.buyerName || 'Unknown Buyer'}
                                  </Text>
                                  <Text color="gray.600" fontSize="sm">
                                    Order ID: {String(order.orderId).slice(0, 8)}
                                  </Text>
                                </Box>
                                <Badge colorScheme={getStatusColor(order.status)} fontSize="md">
                                  {order.status?.toUpperCase() || 'UNKNOWN'}
                                </Badge>
                              </HStack>

                              <SimpleGrid columns={{ base: 1, md: 4 }} spacing={4}>
                                <Box>
                                  <Text fontSize="sm" color="gray.600">
                                    Milk Type
                                  </Text>
                                  <Text fontWeight="bold" fontSize="lg">
                                    {capitalizeFirstLetter(order.milkType)}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text fontSize="sm" color="gray.600">
                                    Quantity
                                  </Text>
                                  <Text fontWeight="bold" fontSize="lg">
                                    {order.quantityLiters ? `${order.quantityLiters.toLocaleString()} L` : 'N/A'}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text fontSize="sm" color="gray.600">
                                    Total Price
                                  </Text>
                                  <Text fontWeight="bold" fontSize="lg" color="cyan.700">
                                    ${order.totalPrice ? order.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                                  </Text>
                                </Box>
                                <Box>
                                  <Text fontSize="sm" color="gray.600">
                                    Delivery Date
                                  </Text>
                                  <Text fontWeight="bold" fontSize="lg">
                                    {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}
                                  </Text>
                                </Box>
                              </SimpleGrid>

                              {order.neededByDate && (
                                <Box>
                                  <Text fontSize="sm" color="gray.600">
                                    Needed By
                                  </Text>
                                  <Text fontWeight="medium">
                                    {new Date(order.neededByDate).toLocaleDateString()}
                                  </Text>
                                </Box>
                              )}

                              {order.trackingId && (
                                <Box>
                                  <Text fontSize="sm" color="gray.600">
                                    Tracking ID
                                  </Text>
                                  <Text fontWeight="medium" color="cyan.700">
                                    {order.trackingId}
                                  </Text>
                                </Box>
                              )}

                              <Text fontSize="xs" color="gray.500" pt={2}>
                                Created: {new Date(order.createdAt).toLocaleString()}
                              </Text>

                              <HStack spacing={3} pt={2}>
                                <Button 
                                  size="sm"
                                  bg="cyan.50"
                                  color="cyan.700" 
                                  _hover={{ bg: 'cyan.300' }}
                                  onClick={() => handleMessageBuyerFromOrder(order)}
                                >
                                  Message Buyer
                                </Button>
                              </HStack>
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

      {/* Quote RFQ Modal */}
      <Modal isOpen={isQuoteModalOpen} onClose={onQuoteModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Submit Quote</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedRFQ && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="semibold">
                    Details
                  </Text>
                  <Text>Milk Type: {capitalizeFirstLetter(selectedRFQ.milkType)}</Text>
                  <Text>
                    Quantity: {selectedRFQ.quantityLiters.toLocaleString()} L
                  </Text>
                  <Text>
                    Budget: ${selectedRFQ.budgetMax}
                  </Text>
                  <Text>
                    Needed by: {new Date(selectedRFQ.neededByDate).toLocaleDateString()}
                  </Text>
                </Box>

                <FormControl isRequired>
                  <FormLabel>Price per Liter</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quoteForm.pricePerLiter}
                    onChange={(e) => setQuoteForm({ ...quoteForm, pricePerLiter: e.target.value })}
                    placeholder="$0.00"
                    bg={inputBg}
                    color={inputColor}
                    borderColor={inputBorderColor}
                    _placeholder={{ color: inputPlaceholderColor }}
                  />
                  <Text fontSize="sm" color="white" mt={1}>
                    Total: {
                      quoteForm.pricePerLiter && selectedRFQ
                        ? `$${(parseFloat(quoteForm.pricePerLiter) * selectedRFQ.quantityLiters).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '$0.00'
                    }
                  </Text>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Delivery Date</FormLabel>
                  <Input
                    type="date"
                    value={quoteForm.deliveryDate}
                    onChange={(e) => setQuoteForm({ ...quoteForm, deliveryDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    bg={inputBg}
                    color={inputColor}
                    borderColor={inputBorderColor}
                    _placeholder={{ color: inputPlaceholderColor }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <Textarea
                    value={quoteForm.notes}
                    onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
                    placeholder="Add any additional information about your quote..."
                    rows={4}
                    bg={inputBg}
                    color={inputColor}
                    borderColor={inputBorderColor}
                    _placeholder={{ color: inputPlaceholderColor }}
                  />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onQuoteModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="cyan"
              onClick={handleSubmitQuote}
              isLoading={submittingQuote}
              isDisabled={!quoteForm.pricePerLiter || !quoteForm.deliveryDate}
            >
              Submit Quote
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Quote Details Modal */}
      <Modal isOpen={isQuoteDetailsModalOpen} onClose={onQuoteDetailsModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Quote Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedQuote && (
              <VStack align="stretch">
                {/* Buyer Information */}
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Buyer:
                  </Text>
                  <Text fontWeight="bold" fontSize="lg">
                    {selectedQuote.buyerName || 'Unknown Buyer'}
                  </Text>
                </Box>

                {/* RFQ Information */}
                <Box>
                  <Text fontSize="sm" color="gray.600">
                  Milk type:
                  </Text>
                  <Text fontWeight="bold" mb={1} fontSize="lg"> {capitalizeFirstLetter(selectedQuote.milkType)}</Text>
                  <Text fontSize="sm" color="gray.600">
                    RFQ ID  
                  </Text>
                  <Text fontWeight="bold"> {selectedQuote.rfqId ? String(selectedQuote.rfqId) : 'N/A'}</Text>
                </Box>

                <Divider />

                {/* Quote Details */}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      Price per Liter
                    </Text>
                    <Text fontWeight="bold" fontSize="xl" color="cyan.700">
                      ${selectedQuote.pricePerLiter.toFixed(2)}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      Total Price
                    </Text>
                    <Text fontWeight="bold" fontSize="xl" color="cyan.700">
                      ${selectedQuote.totalPrice.toLocaleString()}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      Delivery Date
                    </Text>
                    <Text fontWeight="bold" fontSize="lg">
                      {new Date(selectedQuote.deliveryDate).toLocaleDateString()}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      Status
                    </Text>
                    <Badge colorScheme={getStatusColor(selectedQuote.status)} fontSize="md">
                      {selectedQuote.status.toUpperCase()}
                    </Badge>
                  </Box>
                </SimpleGrid>

                {/* Notes Section */}
                {selectedQuote.notes && (
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={2}>
                      Additional Notes
                    </Text>
                    <Box
                      p={3}
                      bg="gray.50"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="gray.200"
                    >
                      <Text fontSize="sm" color="gray.700">
                        {selectedQuote.notes}
                      </Text>
                    </Box>
                  </Box>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onQuoteDetailsModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel Quote Confirmation Modal */}
      <Modal isOpen={isCancelConfirmModalOpen} onClose={onCancelConfirmModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Cancel Quote</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure you want to cancel quote id: {quoteToCancel?.id ? String(quoteToCancel.id).slice(0, 8) : 'N/A'}?
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCancelConfirmModalClose}>
              No
            </Button>
            <Button
              colorScheme="red"
              onClick={confirmCancelQuote}
            >
              Yes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Message Buyer Modal */}
      <Modal isOpen={isMessageModalOpen} onClose={onMessageModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Message Buyer</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {(selectedQuoteForMessage || selectedOrderForMessage) && (() => {
              const currentContext = selectedQuoteForMessage || selectedOrderForMessage;
              return (
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      To:
                    </Text>
                    <Text fontWeight="bold" fontSize="lg">
                      {currentContext.buyerName || 'Unknown Buyer'}
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="gray.600" mb={1}>
                      {selectedOrderForMessage ? 'Regarding Order:' : 'Regarding RFQ:'}
                    </Text>
                    <Text fontWeight="bold">
                      {selectedOrderForMessage 
                        ? `Order ${currentContext.orderId ? String(currentContext.orderId).slice(0, 8) : 'N/A'} - ${capitalizeFirstLetter(currentContext.milkType)}`
                        : `${currentContext.rfqId ? String(currentContext.rfqId).slice(0, 8) : 'N/A'} - ${capitalizeFirstLetter(currentContext.milkType)}`
                      }
                    </Text>
                  </Box>
                  <FormControl>
                    <HStack justify="space-between" align="center" mb={2}>
                      <FormLabel mb={0}>Message</FormLabel>
                      <GenerateAIMessageButton
                        onClick={handleGenerateAIMessage}
                        isLoading={generatingAI}
                        isDisabled={generatingAI || (!selectedQuoteForMessage && !selectedOrderForMessage)}
                      />
                    </HStack>
                    <Textarea
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder="Type your message to the buyer..."
                      rows={6}
                      bg={textareaBg}
                      color={textareaColor}
                      borderColor={textareaBorderColor}
                      _placeholder={{ color: textareaPlaceholderColor }}
                    />
                  </FormControl>
                </VStack>
              );
            })()}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onMessageModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="cyan"
              onClick={handleSendMessage}
              isLoading={sendingMessage}
              isDisabled={!messageContent.trim() || generatingAI}
            >
              Send Message
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}