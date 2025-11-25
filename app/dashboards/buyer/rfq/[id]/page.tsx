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
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  useToast,
  Spinner,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  Divider,
  useColorModeValue,
  Textarea,
} from '@chakra-ui/react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getStatusColor } from '@/lib/utils';
import { getRFQ } from '@/lib/rfqs';
import { CancelButton } from '@/components/CancelButton';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { GenerateAIMessageButton } from '@/components/GenerateAIMessageButton';

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
  sellerName: string;
  sellerId?: number;
  pricePerLiter: number;
  totalPrice: number;
  deliveryDate: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  isFromBuyer: boolean;
}

type SortOption = 'price-asc' | 'price-desc' | 'delivery-asc' | 'delivery-desc';

export default function RFQDetailsPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useParams();
  const rfqId = params?.id as string;

  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('price-asc');
  const [companyName, setCompanyName] = useState<string>('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [currentBuyerId, setCurrentBuyerId] = useState<number | null>(null);
  const { isOpen: isQuoteModalOpen, onOpen: onQuoteModalOpen, onClose: onQuoteModalClose } = useDisclosure();
  
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const headingColor = useColorModeValue('cyan.900', 'gray.100');
  const messageBgBuyer = useColorModeValue('cyan.500', 'cyan.600');
  const messageBgSeller = useColorModeValue('gray.200', 'gray.600');
  const messageColorBuyer = useColorModeValue('white', 'white');
  const messageColorSeller = useColorModeValue('gray.800', 'gray.100');
  const notesBg = useColorModeValue('gray.50', 'gray.700');
  const notesBorderColor = useColorModeValue('gray.200', 'gray.600');
  const emptyMessagesBg = useColorModeValue('gray.50', 'gray.700');
  const emptyMessagesBorderColor = useColorModeValue('gray.200', 'gray.600');
  const textareaBg = useColorModeValue('white', 'gray.700');
  const textareaColor = useColorModeValue('gray.800', 'gray.100');
  const textareaBorderColor = useColorModeValue('gray.300', 'gray.600');
  const textareaPlaceholderColor = useColorModeValue('gray.400', 'gray.500');

  useEffect(() => {
    const loadData = async () => {
      if (!rfqId) return;

      try {
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/signin');
          return;
        }

        // Get session token
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

        // Get buyer profile
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
            setCurrentBuyerId(profileData.profile.id);
          } else {
            router.push('/dashboards/seller');
            return;
          }
        }

        // Load RFQ details
        const rfqData = await getRFQ(rfqId);
        
        if (!rfqData) {
          toast({
            title: 'RFQ Not Found',
            description: 'The requested RFQ could not be found.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          router.push('/dashboards/buyer');
          return;
        }

        // Transform RFQ data
        const rfqDetails: RFQ = {
          id: rfqData.rfq_id,
          milkType: rfqData.milk_type,
          quantityLiters: Number(rfqData.quantity_liters),
          neededByDate: rfqData.needed_by_date,
          budgetMax: rfqData.budget_max ? Number(rfqData.budget_max) : undefined,
          status: rfqData.status,
          quotesCount: 0, // Will be updated after fetching quotes
          createdAt: rfqData.created_at,
        };

        setRfq(rfqDetails);

        // Load quotes for this RFQ via API route to bypass RLS
        const quotesResponse = await fetch(`/api/rfq/${rfqId}/quotes`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (quotesResponse.ok) {
          const quotesData = await quotesResponse.json();
          const transformedQuotes: Quote[] = (quotesData.quotes || []).map((q: any) => ({
            id: q.id,
            sellerName: q.sellerName,
            sellerId: q.sellerId,
            pricePerLiter: q.pricePerLiter,
            totalPrice: q.totalPrice,
            deliveryDate: q.deliveryDate,
            notes: q.notes || undefined,
            status: q.status,
          }));

          setQuotes(transformedQuotes);
          setRfq(prev => prev ? { ...prev, quotesCount: transformedQuotes.length } : null);
        } else {
          const errorData = await quotesResponse.json();
          console.error('Error fetching quotes:', errorData);
          toast({
            title: 'Error',
            description: errorData.error || 'Failed to load quotes.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          setQuotes([]);
        }
      } catch (error: any) {
        console.error('Error loading RFQ details:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load RFQ details',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [rfqId, router, toast]);


  const handleAcceptQuote = async (quoteId: string) => {
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

      const response = await fetch('/api/quotes/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          quoteId: quoteId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept quote');
      }

      // Update quotes state: mark accepted quote as accepted, others as rejected
      setQuotes(prevQuotes => 
        prevQuotes.map(q => 
          q.id === quoteId 
            ? { ...q, status: 'accepted' as const }
            : q.status === 'pending' 
              ? { ...q, status: 'rejected' as const }
              : q
        )
      );

      // Update RFQ status to ordered
      if (rfq) {
        setRfq(prev => prev ? { ...prev, status: 'ordered' } : null);
      }

      toast({
        title: 'Quote Accepted',
        description: 'The quote has been accepted successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Error accepting quote:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept quote',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCancelRFQ = async () => {
    if (!rfq) return;

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

      const response = await fetch('/api/rfq/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rfqId: rfq.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel RFQ');
      }

      toast({
        title: 'RFQ Cancelled',
        description: 'The RFQ has been cancelled successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      router.push('/dashboards/buyer');
    } catch (error: any) {
      console.error('Error cancelling RFQ:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel RFQ',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const sortedQuotes = [...quotes].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return a.totalPrice - b.totalPrice;
      case 'price-desc':
        return b.totalPrice - a.totalPrice;
      case 'delivery-asc':
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      case 'delivery-desc':
        return new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime();
      default:
        return 0;
    }
  });

  const handleViewQuoteDetails = async (quote: Quote) => {
    setSelectedQuote(quote);
    setMessages([]);
    setNewMessage('');
    setConversationId(null);
    onQuoteModalOpen();
    
    // Fetch messages for this buyer-seller conversation
    if (quote.sellerId && currentBuyerId) {
      await loadMessages(currentBuyerId, quote.sellerId);
    }
  };

  const loadMessages = async (buyerId: number, sellerId: number) => {
    setLoadingMessages(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        return;
      }

      const response = await fetch(`/api/messages/conversation?buyerId=${buyerId}&sellerId=${sellerId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setConversationId(data.conversationId || null);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };


  const handleGenerateAIResponse = async () => {
    if (!selectedQuote || !selectedQuote.sellerId || !currentBuyerId || !rfq) {
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
          conversationHistory: messages.map(msg => ({
            content: msg.content,
            isFromBuyer: msg.isFromBuyer,
            createdAt: msg.createdAt,
          })),
          sellerName: selectedQuote.sellerName,
          rfqContext: {
            milkType: rfq.milkType,
            quantityLiters: rfq.quantityLiters,
          },
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate AI response';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setNewMessage(data.message || '');
      
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
    if (!newMessage.trim() || !selectedQuote || !selectedQuote.sellerId || !currentBuyerId) {
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
          buyerId: currentBuyerId,
          sellerId: selectedQuote.sellerId,
          content: newMessage.trim(),
          conversationId: conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      const { message: sentMessage } = await response.json();
      
      // Add new message to the list
      setMessages(prev => [...prev, {
        id: String(sentMessage.id),
        content: sentMessage.content,
        createdAt: sentMessage.createdAt,
        isFromBuyer: true,
      }]);
      
      setNewMessage('');
      
      // Update conversation ID if this was a new conversation
      if (sentMessage.conversationId && !conversationId) {
        setConversationId(sentMessage.conversationId);
      }

      toast({
        title: 'Message Sent',
        description: 'Your message has been sent.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
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

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="center" justify="center" minH="400px">
          <Spinner size="xl" color="cyan.700" />
          <Text>Loading RFQ details...</Text>
        </VStack>
      </Container>
    );
  }

  if (!rfq) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="center">
          <Text>RFQ not found</Text>
          <Button onClick={() => router.push('/dashboards/buyer')}>
            Back to Dashboard
          </Button>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8} >
      <VStack spacing={8} align="stretch" margin="24px">
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
                onClick={() => router.push('/dashboards/buyer')}
              >
                Back to Dashboard
              </Button>
              <VStack align="start" spacing={0} ml="24px">
                <Heading size="xl" color="cyan.800">
                  Request Details
                </Heading>
              </VStack>
            </VStack>
            <VStack align="end" spacing={2}>
              <DarkModeToggle size="sm" color="gray.600" />
            </VStack>
          </HStack>
        </Box>

        {/* RFQ Details Card */}
        <Card>
          <CardBody pt={4}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Request ID
                </Text>
                <Text fontWeight="bold" fontSize="md" fontFamily="mono">
                  {rfq.id}
                </Text>
              </Box>
              
              <Box>
                <HStack justify="space-between" align="flex-start" mb={1} spacing={4}>
                  <Text fontSize="sm" color="gray.600">
                    Status
                  </Text>
                  {rfq.status !== 'cancelled' && 
                   rfq.status !== 'fulfilled' && 
                   rfq.status !== 'ordered' && (
                    <CancelButton onClick={handleCancelRFQ}>
                      Cancel RFQ
                    </CancelButton>
                  )}
                </HStack>
                <Badge colorScheme={getStatusColor(rfq.status)}>
                  {rfq.status.toUpperCase()}
                </Badge>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Milk Type
                </Text>
                <Text fontWeight="bold">{rfq.milkType}</Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Quantity (Liters)
                </Text>
                <Text fontWeight="bold">{rfq.quantityLiters.toLocaleString()} L</Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Budget Max
                </Text>
                <Text fontWeight="bold">
                  {rfq.budgetMax ? `$${rfq.budgetMax.toLocaleString()}` : 'N/A'}
                </Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Needed By Date
                </Text>
                <Text fontWeight="bold">
                  {new Date(rfq.neededByDate).toLocaleDateString()}
                </Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Quotes Received
                </Text>
                <Text fontWeight="bold">{rfq.quotesCount}</Text>
              </Box>
              
              <Box>
                <Text fontSize="sm" color="gray.600" mb={1}>
                  Created At
                </Text>
                <Text fontWeight="bold">
                  {new Date(rfq.createdAt).toLocaleString()}
                </Text>
              </Box>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Quotes Section */}
        <Card>
          <CardHeader>
            <HStack justify="space-between" align="center">
              <Heading size="md">Quotes Received</Heading>
              {quotes.length > 0 && (
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  width="auto"
                  size="sm"
                >
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="delivery-asc">Delivery: Earliest First</option>
                  <option value="delivery-desc">Delivery: Latest First</option>
                </Select>
              )}
            </HStack>
          </CardHeader>
          <CardBody>
            {quotes.length === 0 ? (
              <VStack spacing={4} py={8}>
                <Text color="gray.500" fontSize="lg">
                  No quotes received yet
                </Text>
                <Text color="gray.400" fontSize="sm">
                  Quotes from sellers will appear here once they submit their offers.
                </Text>
              </VStack>
            ) : (
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Seller</Th>
                      <Th>Status</Th>
                      <Th isNumeric>Price per Liter</Th>
                      <Th isNumeric>Total Price</Th>
                      <Th>Delivery Date</Th>
                      <Th>Notes</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {sortedQuotes.map((quote) => (
                      <Tr key={quote.id}>
                        <Td fontWeight="medium">{quote.sellerName}</Td>
                        <Td>
                          <Badge 
                            colorScheme={
                              quote.status === 'pending' ? 'yellow' :
                              quote.status === 'accepted' ? 'green' :
                              quote.status === 'rejected' ? 'red' :
                              quote.status === 'cancelled' ? 'gray' : 'gray'
                            }
                          >
                            {quote.status.toUpperCase()}
                          </Badge>
                        </Td>
                        <Td isNumeric>${quote.pricePerLiter.toFixed(2)}</Td>
                        <Td isNumeric fontWeight="bold" color="cyan.700">
                          ${quote.totalPrice.toLocaleString()}
                        </Td>
                        <Td>{new Date(quote.deliveryDate).toLocaleDateString()}</Td>
                        <Td>
                          {quote.notes ? (
                            <Text fontSize="sm" noOfLines={2} maxW="200px">
                              {quote.notes}
                            </Text>
                          ) : (
                            <Text color="gray.400" fontSize="sm">No notes</Text>
                          )}
                        </Td>
                        <Td>
                          <HStack spacing={2}>
                            <Button
                              size="sm"
                              variant="outline"
                              colorScheme="cyan"
                              onClick={() => handleViewQuoteDetails(quote)}
                            >
                              View Details
                            </Button>
                            {quote.status === 'pending' && !quotes.some(q => q.status === 'accepted') && (
                              <Button
                                size="sm"
                                colorScheme="cyan"
                                onClick={() => handleAcceptQuote(quote.id)}
                              >
                                Accept
                              </Button>
                            )}
                            {quote.status === 'accepted' && (
                              <Text fontSize="sm" color="green.600" fontWeight="medium">
                                Accepted
                              </Text>
                            )}
                            {quote.status === 'rejected' && (
                              <Text fontSize="sm" color="red.600" fontWeight="medium">
                                Rejected
                              </Text>
                            )}
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </CardBody>
        </Card>
      </VStack>

      {/* Quote Details Modal */}
      <Modal isOpen={isQuoteModalOpen} onClose={onQuoteModalClose} size="xl">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalHeader color={headingColor}>Quote Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedQuote && (
              <VStack spacing={6} align="stretch">
                <Box>
                  <Text fontSize="sm" color={textColor} mb={1}>
                    Seller
                  </Text>
                  <Text fontWeight="bold" fontSize="lg">
                    {selectedQuote.sellerName}
                  </Text>
                </Box>

                <Divider />

                <SimpleGrid columns={2} spacing={4}>
                  <Box>
                    <Text fontSize="sm" color={textColor} mb={1}>
                      Status
                    </Text>
                    <Badge 
                      colorScheme={
                        selectedQuote.status === 'pending' ? 'yellow' :
                        selectedQuote.status === 'accepted' ? 'green' :
                        selectedQuote.status === 'rejected' ? 'red' :
                        selectedQuote.status === 'cancelled' ? 'gray' : 'gray'
                      }
                      fontSize="sm"
                      px={2}
                      py={1}
                    >
                      {selectedQuote.status.toUpperCase()}
                    </Badge>
                  </Box>

                  <Box>
                    <Text fontSize="sm" color={textColor} mb={1}>
                      Quote ID
                    </Text>
                    <Text fontWeight="bold" fontFamily="mono" fontSize="sm">
                      {selectedQuote.id}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Divider />

                <SimpleGrid columns={2} spacing={4}>
                  <Box>
                    <Text fontSize="sm" color={textColor} mb={1}>
                      Price per Liter
                    </Text>
                    <Text fontWeight="bold" fontSize="lg" color="cyan.700">
                      ${selectedQuote.pricePerLiter.toFixed(2)}
                    </Text>
                  </Box>

                  <Box>
                    <Text fontSize="sm" color={textColor} mb={1}>
                      Total Price
                    </Text>
                    <Text fontWeight="bold" fontSize="lg" color="cyan.700">
                      ${selectedQuote.totalPrice.toLocaleString()}
                    </Text>
                  </Box>
                </SimpleGrid>

                <Divider />

                <Box>
                  <Text fontSize="sm" color={textColor} mb={1}>
                    Delivery Date
                  </Text>
                  <Text fontWeight="bold">
                    {new Date(selectedQuote.deliveryDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </Box>

                {selectedQuote.notes && (
                  <>
                    <Divider />
                    <Box>
                      <Text fontSize="sm" color={textColor} mb={2}>
                        Notes
                      </Text>
                      <Box
                        p={4}
                        bg={notesBg}
                        borderRadius="md"
                        borderWidth="1px"
                        borderColor={notesBorderColor}
                      >
                        <Text whiteSpace="pre-wrap" color={textColor}>
                          {selectedQuote.notes}
                        </Text>
                      </Box>
                    </Box>
                  </>
                )}

                {rfq && (
                  <>
                    <Divider />
                    <Box>
                      <Text fontSize="sm" color={textColor} mb={2}>
                        RFQ Information
                      </Text>
                      <SimpleGrid columns={2} spacing={4}>
                        <Box>
                          <Text fontSize="xs" color={textColor}>
                            Milk Type
                          </Text>
                          <Text fontWeight="medium">{rfq.milkType}</Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color={textColor}>
                            Quantity Requested
                          </Text>
                          <Text fontWeight="medium">{rfq.quantityLiters.toLocaleString()} L</Text>
                        </Box>
                      </SimpleGrid>
                    </Box>
                  </>
                )}

                {/* Messages Section */}
                <Divider />
                <Box>
                  <Heading size="sm" mb={4} color={headingColor}>
                    Messages
                  </Heading>
                  
                  {loadingMessages ? (
                    <VStack spacing={4} py={8}>
                      <Spinner size="md" color="cyan.700" />
                      <Text fontSize="sm" color={textColor}>Loading messages...</Text>
                    </VStack>
                  ) : messages.length === 0 ? (
                    <Box
                      p={4}
                      bg={emptyMessagesBg}
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={emptyMessagesBorderColor}
                    >
                      <Text fontSize="sm" color={textColor} textAlign="center">
                        No messages yet. Start a conversation with {selectedQuote.sellerName}.
                      </Text>
                    </Box>
                  ) : (
                    <VStack spacing={1} align="stretch" maxH="300px" overflowY="auto" mb={4}>
                      {messages.map((message, index) => {
                        // Incoming messages (from seller) should be on left, outgoing (from buyer) on right
                        const isOutgoing = message.isFromBuyer;
                        
                        // Check if this is the last message in a consecutive group from the same sender
                        const isLastInGroup = index === messages.length - 1 || 
                          messages[index + 1].isFromBuyer !== message.isFromBuyer;
                        
                        return (
                          <VStack key={message.id} spacing={0} align={isOutgoing ? 'flex-end' : 'flex-start'} width="100%">
                            <HStack
                              justify={isOutgoing ? 'flex-end' : 'flex-start'}
                              align="flex-start"
                              width="100%"
                            >
                              <Box
                                bg={isOutgoing ? messageBgBuyer : messageBgSeller}
                                color={isOutgoing ? messageColorBuyer : messageColorSeller}
                                borderRadius="lg"
                                p={3}
                                maxW="70%"
                                boxShadow="sm"
                              >
                                <Text fontSize="sm" whiteSpace="pre-wrap">
                                  {message.content}
                                </Text>
                                <Text 
                                  fontSize="xs" 
                                  color={isOutgoing ? 'whiteAlpha.700' : 'gray.500'} 
                                  textAlign="right" 
                                  mt={1}
                                >
                                  {new Date(message.createdAt).toLocaleTimeString([], { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </Text>
                              </Box>
                            </HStack>
                            {isLastInGroup && (
                              <Text 
                                fontSize="xs" 
                                color={textColor}
                                mt={1}
                                px={2}
                              >
                                {isOutgoing ? 'You' : selectedQuote.sellerName}
                              </Text>
                            )}
                          </VStack>
                        );
                      })}
                    </VStack>
                  )}

                  {/* Message Input */}
                  <VStack spacing={2} align="stretch">
                    <HStack spacing={2} justify="space-between" align="center">
                      <Text fontSize="sm" color={textColor} fontWeight="medium">
                        Compose Message
                      </Text>
                      <GenerateAIMessageButton
                        onClick={handleGenerateAIResponse}
                        isLoading={generatingAI}
                        isDisabled={generatingAI || !selectedQuote || !rfq}
                      />
                    </HStack>
                    <Textarea
                      value={newMessage}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
                      placeholder={`Message ${selectedQuote.sellerName}...`}
                      rows={3}
                      resize="none"
                      bg={textareaBg}
                      color={textareaColor}
                      borderColor={textareaBorderColor}
                      _placeholder={{ color: textareaPlaceholderColor }}
                    />
                    <Button
                      colorScheme="cyan"
                      onClick={handleSendMessage}
                      isLoading={sendingMessage}
                      isDisabled={!newMessage.trim() || generatingAI}
                      size="sm"
                    >
                      Send Message
                    </Button>
                  </VStack>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="cyan" onClick={onQuoteModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}

