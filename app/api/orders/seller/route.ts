import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // Get the auth token from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a client with the user's token to verify the user
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user || !user.email) {
      console.error('Error getting user:', userError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the seller ID
    const { data: sellerProfile, error: sellerError } = await supabaseAdmin
      .from('Sellers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (sellerError || !sellerProfile) {
      return NextResponse.json(
        { error: 'Seller profile not found' },
        { status: 404 }
      );
    }

    const sellerId = sellerProfile.id;
    const sellerIdNum = Number(sellerId);

    // Debug logging
    console.log('Fetching orders for seller ID:', sellerId, 'Type:', typeof sellerId, 'As Number:', sellerIdNum);

    // Fetch orders for this seller from the Orders table
    // Orders table only has rfq_id and quote_id - seller_id comes from Quotes table via join
    // Note: We can't filter on joined table fields, so we'll fetch all orders and filter in memory
    let { data: allOrders, error: ordersError } = await supabaseAdmin
      .from('Orders')
      .select(`
        order_id,
        rfq_id,
        quote_id,
        status,
        created_at,
        shipper_id,
        tracking_id,
        quote:Quotes!quote_id(
          id,
          seller_id,
          price_per_liter,
          total_price,
          delivery_date,
          status
        )
      `)
      .order('created_at', { ascending: false });

    // Filter orders by seller_id from the joined quote
    const orders = allOrders?.filter((order: any) => {
      const quote = order.quote;
      return quote && Number(quote.seller_id) === sellerIdNum;
    }) || [];

    // Debug logging
    console.log('Orders found:', orders?.length || 0);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    // Fetch RFQ details and buyer information
    const rfqIds = Array.from(new Set(orders.map((o: any) => o.rfq_id).filter(Boolean)));
    let rfqMap = new Map();
    let buyerMap = new Map();
    
    if (rfqIds.length > 0) {
      // Fetch RFQ details (includes buyer_id and all RFQ fields)
      const { data: rfqsData } = await supabaseAdmin
        .from('Requests')
        .select('rfq_id, buyer_id, milk_type, quantity_liters, needed_by_date')
        .in('rfq_id', rfqIds);

      if (rfqsData) {
        rfqMap = new Map(rfqsData.map((r: any) => [r.rfq_id, r]));
        
        // Extract buyer IDs from RFQs
        const buyerIds = Array.from(new Set(rfqsData.map((r: any) => r.buyer_id).filter(Boolean)));
        if (buyerIds.length > 0) {
          const { data: buyers } = await supabaseAdmin
            .from('Buyers')
            .select('id, company_name')
            .in('id', buyerIds);

          if (buyers) {
            buyerMap = new Map(buyers.map((b: any) => [b.id, b.company_name]));
          }
        }
      }
    }

    // Transform orders with related data
    const transformedOrders = orders.map((order: any) => {
      // Get RFQ data (includes buyer_id)
      const rfq = rfqMap.get(order.rfq_id);
      const buyerId = rfq?.buyer_id;
      const buyerName = buyerId ? buyerMap.get(buyerId) || 'Unknown Buyer' : 'Unknown Buyer';
      // Get quote data from join (already included in select)
      const quote = order.quote || null;

      return {
        orderId: order.order_id,
        rfqId: order.rfq_id,
        buyerId: buyerId || null,
        buyerName,
        sellerId: quote?.seller_id || null,
        status: order.status,
        milkType: rfq?.milk_type || 'Unknown', // Get from Request, not Orders
        quantityLiters: rfq?.quantity_liters || 0,
        neededByDate: rfq?.needed_by_date || null,
        pricePerLiter: quote?.price_per_liter || 0,
        totalPrice: quote?.total_price || 0,
        deliveryDate: quote?.delivery_date || null,
        createdAt: order.created_at,
        shipperId: order.shipper_id,
        trackingId: order.tracking_id,
      };
    });

    return NextResponse.json({ orders: transformedOrders });
  } catch (error: any) {
    console.error('Error in seller orders route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

