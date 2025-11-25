import { supabase } from './supabase';

export interface OrderData {
  id: string;
  rfq_id: string;
  quote_id?: string; // Orders table has quote_id (not quotation_id)
  status: 'confirmed' | 'in_transit' | 'delivered' | 'cancelled' | 'created';
  tracking_info?: {
    carrier?: string;
    trackingNumber?: string;
    estimatedArrival?: string;
    currentLocation?: string;
    lastUpdate?: string;
  };
  created_at: string;
  updated_at: string;
  rfq?: {
    rfq_id: string;
    buyer_id?: string | number; // Get from Request
    milk_type: string;
    quantity_liters: number;
    needed_by_date: string;
  };
  quote?: {
    id: string;
    seller_id?: string | number; // Get from Quote
    total_price: number;
    delivery_date: string;
  };
}

export interface OrderTimeline {
  confirmed: string;
  inTransit?: string;
  delivered?: string;
}

export interface TransformedOrder {
  id: string;
  rfqId: string;
  buyerCompany: string;
  sellerCompany: string;
  milkType: string;
  quantity: number;
  totalPrice: number;
  deliveryDate: string;
  status: 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
  trackingInfo?: {
    carrier?: string;
    trackingNumber?: string;
    estimatedArrival?: string;
    currentLocation?: string;
    lastUpdate?: string;
  };
  createdAt: string;
  timeline: OrderTimeline;
}

/**
 * Transform database order structure to UI-friendly format
 */
export function transformOrder(order: OrderData): TransformedOrder {
  const timeline: OrderTimeline = {
    confirmed: order.created_at,
  };

  // Determine when status changed to in_transit or delivered
  if (order.status === 'in_transit' || order.status === 'delivered') {
    // If we have tracking info with lastUpdate, use that as in_transit time
    // Otherwise, use updated_at if status is in_transit
    if (order.tracking_info?.lastUpdate) {
      timeline.inTransit = order.tracking_info.lastUpdate;
    } else if (order.status === 'in_transit') {
      timeline.inTransit = order.updated_at;
    }
  }

  if (order.status === 'delivered') {
    timeline.delivered = order.updated_at;
  }

  // Get buyer/seller info from joined tables
  // buyer_id comes from rfq.buyer_id, seller_id comes from quote.seller_id
  // Note: We'd need to join to Buyers/Sellers tables to get company_name
  // For now, return IDs - caller can fetch company names if needed
  return {
    id: order.id,
    rfqId: order.rfq_id,
    buyerCompany: 'Unknown Buyer', // TODO: Join to Buyers table to get company_name
    sellerCompany: 'Unknown Seller', // TODO: Join to Sellers table to get company_name
    milkType: order.rfq?.milk_type || 'Unknown',
    quantity: Number(order.rfq?.quantity_liters || 0),
    totalPrice: Number(order.quote?.total_price || 0),
    deliveryDate: order.quote?.delivery_date || order.rfq?.needed_by_date || '',
    status: order.status,
    trackingInfo: order.tracking_info,
    createdAt: order.created_at,
    timeline,
  };
}

/**
 * Fetch an order by ID from Supabase
 */
export async function fetchOrder(orderId: string): Promise<TransformedOrder | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      rfq:Requests(
        rfq_id,
        buyer_id,
        milk_type,
        quantity_liters,
        needed_by_date
      ),
      quote:Quotes(
        id,
        seller_id,
        total_price,
        delivery_date
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Error fetching order:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return transformOrder(data as OrderData);
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: 'confirmed' | 'in_transit' | 'delivered' | 'cancelled',
  trackingInfo?: any
): Promise<TransformedOrder> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (trackingInfo) {
    updateData.tracking_info = trackingInfo;
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select(`
      *,
      rfq:Requests(
        rfq_id,
        milk_type,
        quantity_liters,
        needed_by_date
      ),
      quote:Quotes(
        id,
        total_price,
        delivery_date
      ),
      rfq:Requests(
        rfq_id,
        buyer_id,
        milk_type,
        quantity_liters,
        needed_by_date
      ),
      quote:Quotes(
        id,
        seller_id,
        total_price,
        delivery_date
      )
    `)
    .single();

  if (error) {
    console.error('Error updating order status:', error);
    throw error;
  }

  // If delivered, update RFQ status to fulfilled
  if (status === 'delivered') {
    const orderData = data as OrderData;
    await supabase
      .from('Requests')
      .update({ status: 'fulfilled' })
      .eq('rfq_id', orderData.rfq_id);
  }

  return transformOrder(data as OrderData);
}

/**
 * Update order tracking information
 */
export async function updateOrderTracking(
  orderId: string,
  trackingInfo: {
    carrier?: string;
    trackingNumber?: string;
    estimatedArrival?: string;
    currentLocation?: string;
    lastUpdate?: string;
  }
): Promise<TransformedOrder> {
  // Get existing tracking info and merge
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('tracking_info')
    .eq('id', orderId)
    .single();

  const mergedTrackingInfo = {
    ...(existingOrder?.tracking_info || {}),
    ...trackingInfo,
    lastUpdate: new Date().toISOString(),
  };

  // Get current order status
  const { data: currentOrder } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  const updateData: any = {
    tracking_info: mergedTrackingInfo,
    updated_at: new Date().toISOString(),
  };

  // If status is confirmed, automatically move to in_transit when tracking is added
  if (currentOrder?.status === 'confirmed') {
    updateData.status = 'in_transit';
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select(`
      *,
      rfq:Requests(
        rfq_id,
        milk_type,
        quantity_liters,
        needed_by_date
      ),
      quote:Quotes(
        id,
        total_price,
        delivery_date
      ),
      rfq:Requests(
        rfq_id,
        buyer_id,
        milk_type,
        quantity_liters,
        needed_by_date
      ),
      quote:Quotes(
        id,
        seller_id,
        total_price,
        delivery_date
      )
    `)
    .single();

  if (error) {
    console.error('Error updating order tracking:', error);
    throw error;
  }

  return transformOrder(data as OrderData);
}

/**
 * List orders for a user (buyer or seller)
 */
export async function listOrders(userId: string, role: 'buyer' | 'seller'): Promise<TransformedOrder[]> {
  // Orders table doesn't have buyer_id or seller_id - filter via joins
  let query = supabase
    .from('orders')
    .select(`
      *,
      rfq:Requests(
        rfq_id,
        buyer_id,
        milk_type,
        quantity_liters,
        needed_by_date
      ),
      quote:Quotes(
        id,
        seller_id,
        total_price,
        delivery_date
      )
    `);
  
  // Filter by buyer_id from Request or seller_id from Quote
  if (role === 'buyer') {
    query = query.eq('rfq.buyer_id', userId);
  } else {
    query = query.eq('quote.seller_id', userId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing orders:', error);
    throw error;
  }

  return (data || []).map(order => transformOrder(order as OrderData));
}

