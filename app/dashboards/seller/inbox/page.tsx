'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  useToast,
  Spinner,
  Divider,
  useColorModeValue,
  Textarea,
  Icon,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { GenerateAIMessageButton } from '@/components/GenerateAIMessageButton';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isFromSeller: boolean;
}

interface Thread {
  id: string;
  conversationId: number;
  subject: string;
  rfqId?: string;
  rfqInfo?: {
    milkType: string;
    quantityLiters: number;
  } | null;
  buyerName: string;
  buyerId: string;
  lastMessageAt: string;
  createdAt: string;
  messages: Message[];
  unreadCount: number;
}

export default function SellerInbox() {
  const toast = useToast();
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentSellerId, setCurrentSellerId] = useState<number | null>(null);
  const [generatingAI, setGeneratingAI] = useState(false);

  const bgColor = useColorModeValue('gray.50', 'black');
  const cardBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const headingColor = useColorModeValue('cyan.900', 'gray.100');
  const selectedThreadBg = useColorModeValue('cyan.50', 'gray.700');
  const hoverThreadBg = useColorModeValue('gray.100', 'gray.700');
  const messageBgCurrentUser = useColorModeValue('cyan.100', 'cyan.800');
  const messageBgOther = useColorModeValue('gray.100', 'gray.700');
  const messageTextCurrentUser = useColorModeValue('gray.800', 'gray.100');
  const messageTextOther = useColorModeValue('gray.800', 'gray.100');

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
        router.push('/signin');
      }
    } catch (error: any) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    const loadInbox = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData?.session?.access_token) {
          router.push('/signin');
          return;
        }

        const token = sessionData.session.access_token;

        // Get current seller ID
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const sellerResponse = await fetch('/api/user-profile', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (sellerResponse.ok) {
            const sellerData = await sellerResponse.json();
            if (sellerData.profile?.id) {
              setCurrentSellerId(sellerData.profile.id);
            }
          }
        }

        const response = await fetch('/api/messages/seller-inbox', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to load inbox');
        }

        const data = await response.json();
        setThreads(data.threads || []);
      } catch (error: any) {
        console.error('Error loading inbox:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load messages',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadInbox();
  }, [router, toast]);

  const handleSendReply = async () => {
    if (!selectedThread || !newMessage.trim()) {
      return;
    }

    setSendingMessage(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Get seller ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('User not found');
      }

      const sellerResponse = await fetch('/api/user-profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!sellerResponse.ok) {
        throw new Error('Failed to get seller profile');
      }

      const sellerData = await sellerResponse.json();
      const sellerId = sellerData.profile?.id;

      if (!sellerId) {
        throw new Error('Seller ID not found');
      }

      // Send reply using existing thread
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: selectedThread.conversationId,
          content: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      toast({
        title: 'Message Sent',
        description: 'Your reply has been sent.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setNewMessage('');
      // Reload inbox
      const inboxResponse = await fetch('/api/messages/seller-inbox', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (inboxResponse.ok) {
        const inboxData = await inboxResponse.json();
        setThreads(inboxData.threads || []);
        // Update selected thread
        const updatedThread = inboxData.threads?.find((t: Thread) => t.id === selectedThread.id);
        if (updatedThread) {
          setSelectedThread(updatedThread);
        }
      }
    } catch (error: any) {
      console.error('Error sending reply:', error);
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

  const handleGenerateAIResponse = async () => {
    if (!selectedThread || !currentSellerId) {
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
          conversationHistory: selectedThread.messages.map(msg => ({
            content: msg.content,
            isFromBuyer: !msg.isFromSeller,
            createdAt: msg.createdAt,
          })),
          sellerName: null, // For seller inbox, we're responding to buyer
          buyerName: selectedThread.buyerName,
          rfqContext: selectedThread.rfqInfo ? {
            milkType: selectedThread.rfqInfo.milkType,
            quantityLiters: selectedThread.rfqInfo.quantityLiters,
          } : null,
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

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={4} align="center" justify="center" minH="400px">
          <Spinner size="xl" color="cyan.700" />
          <Text>Loading inbox...</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <Box>
            <HStack justify="space-between" align="flex-start" mb={4}>
              <VStack align="start" spacing={2}>
                <Button
                  variant="ghost"
                  color="cyan.900"
                  onClick={() => router.push('/dashboards/seller')}
                >
                  ← Back to Dashboard
                </Button>
                <Heading size="xl" color={headingColor}>
                  Inbox
                </Heading>
              </VStack>
              <HStack align="center" spacing={2}>
                <DarkModeToggle size="sm" color="teal.600" />
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  size="sm"
                >
                  Logout
                </Button>
              </HStack>
            </HStack>
          </Box>

          {/* Inbox Content */}
          {threads.length === 0 ? (
            <Card bg={cardBg}>
              <CardBody>
                <VStack spacing={4} py={8}>
                  <Text color={textColor} fontSize="lg">
                    No messages yet
                  </Text>
                  <Text color={textColor} fontSize="sm">
                    Messages from buyers will appear here
                  </Text>
                </VStack>
              </CardBody>
            </Card>
          ) : (
            <HStack spacing={4} align="stretch">
              {/* Thread List */}
              <Box flex={1} maxW="400px">
                <Card bg={cardBg}>
                  <CardHeader>
                    <Heading size="md">Conversations</Heading>
                  </CardHeader>
                  <CardBody p={0}>
                    <VStack spacing={0} align="stretch">
                      {threads.map((thread) => (
                        <Box
                          key={thread.id}
                          p={4}
                          borderBottom="1px solid"
                          borderColor={useColorModeValue('gray.200', 'gray.700')}
                          cursor="pointer"
                          bg={selectedThread?.id === thread.id ? selectedThreadBg : 'transparent'}
                          _hover={{ bg: hoverThreadBg }}
                          onClick={() => setSelectedThread(thread)}
                        >
                          <HStack justify="space-between" mb={2}>
                            <Text fontWeight="bold" fontSize="sm">
                              {thread.buyerName}
                            </Text>
                            {thread.unreadCount > 0 && (
                              <Badge colorScheme="red" borderRadius="full">
                                {thread.unreadCount}
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color={textColor} noOfLines={1}>
                            {thread.rfqInfo ? `${thread.rfqInfo.milkType} - ${thread.rfqInfo.quantityLiters}L` : 'RFQ Discussion'}
                          </Text>
                          <Text fontSize="xs" color={textColor} mt={1}>
                            {new Date(thread.lastMessageAt).toLocaleDateString()}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  </CardBody>
                </Card>
              </Box>

              {/* Message Thread */}
              {selectedThread && (
                <Box flex={2}>
                  <Card bg={cardBg}>
                    <CardHeader>
                      <VStack align="start" spacing={2}>
                        <Heading size="md">{selectedThread.subject}</Heading>
                        <Text fontSize="sm" color={textColor}>
                          {selectedThread.buyerName}{selectedThread.rfqId ? ` • RFQ ${selectedThread.rfqId.slice(0, 8)}` : ''}
                        </Text>
                      </VStack>
                    </CardHeader>
                    <CardBody>
                      <VStack spacing={4} align="stretch" maxH="500px" overflowY="auto">
                        {selectedThread.messages.map((message) => {
                          // Check if message is from current user (seller)
                          const isCurrentUser = currentSellerId && message.senderId && Number(message.senderId) === currentSellerId;
                          
                          return (
                            <Box
                              key={message.id}
                              alignSelf={isCurrentUser ? 'flex-end' : 'flex-start'}
                              maxW="70%"
                            >
                              <Box
                                bg={isCurrentUser ? messageBgCurrentUser : messageBgOther}
                                color={isCurrentUser ? messageTextCurrentUser : messageTextOther}
                                p={3}
                                borderRadius="md"
                              >
                                <Text fontSize="sm">{message.content}</Text>
                                <Text fontSize="xs" opacity={0.7} mt={1}>
                                  {new Date(message.createdAt).toLocaleString()}
                                </Text>
                              </Box>
                            </Box>
                          );
                        })}
                      </VStack>

                      <Divider my={4} />

                      {/* Reply Section */}
                      <VStack spacing={3} align="stretch">
                        <HStack spacing={2} justify="space-between" align="center">
                          <Text fontSize="sm" color={textColor} fontWeight="medium">
                            Compose Message
                          </Text>
                          <GenerateAIMessageButton
                            onClick={handleGenerateAIResponse}
                            isLoading={generatingAI}
                            isDisabled={generatingAI || !selectedThread}
                          />
                        </HStack>
                        <Textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your reply..."
                          rows={3}
                          bg={useColorModeValue('white', 'gray.700')}
                          color={useColorModeValue('gray.800', 'gray.100')}
                          borderColor={useColorModeValue('gray.300', 'gray.600')}
                          _placeholder={{ color: useColorModeValue('gray.400', 'gray.500') }}
                        />
                        <Button
                          colorScheme="cyan"
                          onClick={handleSendReply}
                          isLoading={sendingMessage}
                          isDisabled={!newMessage.trim() || generatingAI}
                        >
                          Send Reply
                        </Button>
                      </VStack>
                    </CardBody>
                  </Card>
                </Box>
              )}
            </HStack>
          )}
        </VStack>
      </Container>
    </Box>
  );
}

