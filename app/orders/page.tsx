'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getStatusColor } from '@/lib/utils';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Card,
  CardBody,
  Badge,
  SimpleGrid,
  Button,
  Progress,
  Divider,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useDisclosure,
  Spinner,
  Alert,
  AlertIcon,
  Icon,
} from '@chakra-ui/react';
import { fetchOrder, updateOrderStatus, updateOrderTracking, TransformedOrder } from '@/lib/orders';
import { DarkModeToggle } from '@/components/DarkModeToggle';

function OrderTrackingContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [order, setOrder] = useState<TransformedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [trackingUpdate, setTrackingUpdate] = useState({
    currentLocation: '',
    carrier: '',
    trackingNumber: '',
    estimatedArrival: '',
    notes: '',
  });

  // Get order ID from URL params
  const orderId = searchParams.get('id');

  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided. Please provide an order ID in the URL (e.g., /orders?id=ORDER_ID)');
      setLoading(false);
      return;
    }

    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    if (!orderId) return;
    
    setLoading(true);
    setError(null);
    try {
      const orderData = await fetchOrder(orderId);
      if (!orderData) {
        setError('Order not found');
      } else {
        setOrder(orderData);
        // Pre-fill tracking form with existing data
        if (orderData.trackingInfo) {
          setTrackingUpdate({
            currentLocation: orderData.trackingInfo.currentLocation || '',
            carrier: orderData.trackingInfo.carrier || '',
            trackingNumber: orderData.trackingInfo.trackingNumber || '',
            estimatedArrival: orderData.trackingInfo.estimatedArrival || '',
            notes: '',
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
      toast({
        title: 'Error',
        description: err.message || 'Failed to load order',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusProgress = (status: string) => {
    const progressMap: Record<string, number> = {
      confirmed: 33,
      in_transit: 66,
      delivered: 100,
      cancelled: 0,
    };
    return progressMap[status] || 0;
  };


  const handleUpdateTracking = async () => {
    if (!orderId || !order) return;

    setUpdating(true);
    try {
      const updatedOrder = await updateOrderTracking(orderId, {
        currentLocation: trackingUpdate.currentLocation || undefined,
        carrier: trackingUpdate.carrier || undefined,
        trackingNumber: trackingUpdate.trackingNumber || undefined,
        estimatedArrival: trackingUpdate.estimatedArrival || undefined,
      });

      setOrder(updatedOrder);
      toast({
        title: 'Tracking Updated',
        description: 'Order tracking information has been updated',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setTrackingUpdate({ currentLocation: '', carrier: '', trackingNumber: '', estimatedArrival: '', notes: '' });
      onClose();
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Please try again',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!orderId || !order) return;

    setUpdating(true);
    try {
      const updatedOrder = await updateOrderStatus(orderId, 'delivered');
      setOrder(updatedOrder);

      toast({
        title: 'Order Marked as Delivered',
        description: 'The order status has been updated to delivered',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: any) {
      toast({
        title: 'Update Failed',
        description: err.message || 'Please try again',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Container maxW="container.lg" py={8} bg="cyan.700">
        <VStack spacing={4} align="center" justify="center" minH="400px">
          <Spinner size="xl" color="white" />
          <Text color="white" fontSize="lg">Loading order...</Text>
        </VStack>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container maxW="container.lg" py={8} bg="cyan.700">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          {error || 'Order not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="container.lg" py={8} bg="cyan.700">
      {/* Dark Mode Toggle */}
      <Box position="fixed" top={4} right={4} zIndex={1000}>
        <DarkModeToggle size="sm" color="gray.600" />
      </Box>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="start">
          <Box border="1px solid" borderColor="gray.800" 
          bg="orange.50" borderRadius="md" p={4}>
            <Heading size="lg" color="black.900">
              Order Details for {order.id}
            </Heading>
            <Text color="gray.800" mt={1}>
              Buyer: {order.buyerCompany}
            </Text>
          </Box>
          <Badge colorScheme={getStatusColor(order.status)} fontSize="lg" px={3} py={1}>
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </HStack>

        {/* Progress Bar */}
        <Card>
          <CardBody>
            <VStack spacing={4}>
              <Progress
                value={getStatusProgress(order.status)}
                size="lg"
                colorScheme={getStatusColor(order.status)}
                w="full"
                borderRadius="md"
              />
              <HStack justify="space-between" w="full" fontSize="sm">
                <VStack spacing={0} align="center">
                  <Text fontWeight="bold" color={order.status === 'confirmed' ? 'cyan.600' : 'gray.600'}>
                    Confirmed
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {new Date(order.timeline.confirmed).toLocaleDateString()}
                  </Text>
                </VStack>
                <VStack spacing={0} align="center">
                  <Text fontWeight="bold" color={order.status === 'in_transit' ? 'green.600' : 'gray.600'}>
                    In Transit
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {order.timeline.inTransit ? new Date(order.timeline.inTransit).toLocaleDateString() : 'Pending'}
                  </Text>
                </VStack>
                <VStack spacing={0} align="center">
                  <Text fontWeight="bold" color={order.status === 'delivered' ? 'green.600' : 'gray.600'}>
                    Delivered
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {order.timeline.delivered ? new Date(order.timeline.delivered).toLocaleDateString() : 'Pending'}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Order Details */}
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          <Card>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Heading size="sm" color="gray.700">
                  Order Information
                </Heading>
                <Divider />
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Buyer
                  </Text>
                  <Text fontWeight="bold">{order.buyerCompany}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Seller
                  </Text>
                  <Text fontWeight="bold">{order.sellerCompany}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Product
                  </Text>
                  <Text fontWeight="bold">{order.milkType}</Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Quantity
                  </Text>
                  <Text fontWeight="bold" color="black">
                    {order.quantity.toLocaleString()} Liters
                  </Text>
                </Box>
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Total Value
                  </Text>
                  <Text fontWeight="bold" fontSize="lg" color="green.600">
                    ${order.totalPrice.toLocaleString()}
                  </Text>
                </Box>
              </VStack>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <VStack spacing={3} align="stretch">
                <Heading size="sm" color="gray.700">
                  Delivery Information
                </Heading>
                <Divider />
                <Box>
                  <Text fontSize="sm" color="gray.600">
                    Expected Delivery
                  </Text>
                  <Text fontWeight="bold">
                    {new Date(order.deliveryDate).toLocaleDateString()}
                  </Text>
                </Box>
                {order.trackingInfo && (
                  <>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Carrier
                      </Text>
                      <Text fontWeight="bold">{order.trackingInfo.carrier}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="sm" color="gray.600">
                        Tracking Number
                      </Text>
                      <Text fontWeight="bold" fontFamily="mono">
                        {order.trackingInfo.trackingNumber}
                      </Text>
                    </Box>
                    {order.trackingInfo.estimatedArrival && (
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          Estimated Arrival
                        </Text>
                        <Text fontWeight="bold" color="pink.600">
                          {new Date(order.trackingInfo.estimatedArrival).toLocaleDateString()}
                        </Text>
                      </Box>
                    )}
                  </>
                )}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Current Status */}
        {order.trackingInfo && order.status === 'in_transit' && (
          <Card bg="orange.50">
            <CardBody>
              <VStack spacing={2} align="stretch">
                <Heading size="sm" color="pink.600">
                  Current Location
                </Heading>
                <Text fontWeight="bold" fontSize="lg">
                  {order.trackingInfo.currentLocation}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Last updated: {new Date(order.trackingInfo.lastUpdate || '').toLocaleString()}
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Action Buttons */}
        {(order.status === 'confirmed' || order.status === 'in_transit') && (
          <HStack spacing={4}>
            <Button 
              bg="teal.300" 
              color="white" 
              _hover={{ bg: 'teal.100' }} 
              onClick={onOpen}
              isLoading={updating}
            >
              Update Tracking Info
            </Button>
            {order.status === 'in_transit' && (
              <Button 
                bg="teal.300" 
                color="white" 
                _hover={{ bg: 'teal.100' }} 
                onClick={handleMarkDelivered}
                isLoading={updating}
              >
                Mark as Delivered
              </Button>
            )}
            <Button variant="outline">Contact {order.buyerCompany}</Button>
          </HStack>
        )}

        {order.status === 'delivered' && (
          <Card bg="green.50">
            <CardBody>
              <VStack spacing={2}>
                <Text fontWeight="bold" color="green.800" fontSize="lg">
                  ✓ Order Successfully Delivered
                </Text>
                <Text color="gray.700">
                  This order was delivered on {order.timeline.delivered && new Date(order.timeline.delivered).toLocaleDateString()}
                </Text>
              </VStack>
            </CardBody>
          </Card>
        )}
      </VStack>

      {/* Update Tracking Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update Tracking Information</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Carrier</FormLabel>
                <Input
                  value={trackingUpdate.carrier}
                  onChange={(e) =>
                    setTrackingUpdate(prev => ({ ...prev, carrier: e.target.value }))
                  }
                  placeholder="e.g., FreightPro Logistics"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Tracking Number</FormLabel>
                <Input
                  value={trackingUpdate.trackingNumber}
                  onChange={(e) =>
                    setTrackingUpdate(prev => ({ ...prev, trackingNumber: e.target.value }))
                  }
                  placeholder="e.g., FPL-987654321"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Current Location</FormLabel>
                <Input
                  value={trackingUpdate.currentLocation}
                  onChange={(e) =>
                    setTrackingUpdate(prev => ({ ...prev, currentLocation: e.target.value }))
                  }
                  placeholder="e.g., Distribution Center - Seattle, WA"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Estimated Arrival</FormLabel>
                <Input
                  type="date"
                  value={trackingUpdate.estimatedArrival}
                  onChange={(e) =>
                    setTrackingUpdate(prev => ({ ...prev, estimatedArrival: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Update Notes</FormLabel>
                <Textarea
                  value={trackingUpdate.notes}
                  onChange={(e) =>
                    setTrackingUpdate(prev => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Any additional information about the shipment..."
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" color="cyan.700" mr={3} onClick={onClose} isDisabled={updating}>
              Cancel
            </Button>
            <Button 
              bg="cyan.700" 
              _hover={{ bg: 'teal.300' }} 
              onClick={handleUpdateTracking}
              isLoading={updating}
            >
              Update Tracking
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}

export default function OrderTracking() {
  return (
    <Suspense fallback={
      <Container maxW="container.lg" py={8} bg="cyan.700">
        <VStack spacing={4} align="center" justify="center" minH="400px">
          <Spinner size="xl" color="white" />
          <Text color="white" fontSize="lg">Loading...</Text>
        </VStack>
      </Container>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}