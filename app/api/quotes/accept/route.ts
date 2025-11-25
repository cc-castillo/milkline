import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json(
        { error: 'Missing required field: quoteId' },
        { status: 400 }
      );
    }

    // Get quote details - ensure we get seller_id from the quote
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('Quotes')
      .select('rfq_id, seller_id, id')
      .eq('id', quoteId)
      .single();

    // Debug logging
    console.log('Quote seller_id:', quote?.seller_id, 'Type:', typeof quote?.seller_id);

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      );
    }

    // Validate that the quote has a seller_id
    if (!quote.seller_id) {
      console.error('Quote missing seller_id:', quote);
      return NextResponse.json(
        { error: 'Quote is missing seller_id. Cannot create order.' },
        { status: 400 }
      );
    }

    // Get RFQ details to verify authorization and get milk_type
    const { data: rfq, error: rfqError } = await supabaseAdmin
      .from('Requests')
      .select('buyer_id, milk_type')
      .eq('rfq_id', quote.rfq_id)
      .single();

    if (rfqError || !rfq) {
      return NextResponse.json(
        { error: 'RFQ not found' },
        { status: 404 }
      );
    }

    // Get buyer profile to verify authorization
    const { data: buyerProfile } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (!buyerProfile) {
      return NextResponse.json(
        { error: 'User is not a buyer' },
        { status: 403 }
      );
    }

    // Verify user is the buyer of this RFQ
    if (rfq.buyer_id !== buyerProfile.id) {
      return NextResponse.json(
        { error: 'Unauthorized: You can only accept quotes for your own RFQs' },
        { status: 403 }
      );
    }

    // Check if any quote is already accepted for this RFQ
    const { data: existingAccepted } = await supabaseAdmin
      .from('Quotes')
      .select('id')
      .eq('rfq_id', quote.rfq_id)
      .eq('status', 'accepted')
      .maybeSingle();

    if (existingAccepted) {
      return NextResponse.json(
        { error: 'A quote has already been accepted for this RFQ' },
        { status: 400 }
      );
    }

    // Update quote status to accepted
    const { error: updateError } = await supabaseAdmin
      .from('Quotes')
      .update({ status: 'accepted' })
      .eq('id', quoteId);

    if (updateError) {
      console.error('Error updating quote status:', updateError);
      return NextResponse.json(
        { error: `Failed to accept quote: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Reject all other quotes for this RFQ
    const { error: rejectError } = await supabaseAdmin
      .from('Quotes')
      .update({ status: 'rejected' })
      .eq('rfq_id', quote.rfq_id)
      .neq('id', quoteId);

    if (rejectError) {
      console.error('Error rejecting other quotes:', rejectError);
      // Don't fail the request, but log the error
    }

    // Update RFQ status to 'ordered'
    const { error: rfqUpdateError } = await supabaseAdmin
      .from('Requests')
      .update({ status: 'ordered' })
      .eq('rfq_id', quote.rfq_id);

    if (rfqUpdateError) {
      console.error('Error updating RFQ status:', rfqUpdateError);
      // Don't fail the request, but log the error
    }

    // Create a new order with status 'created'
    // Orders table only has rfq_id and quote_id (no buyer_id, seller_id, or milk_type - these are transitive dependencies)
    // milk_type comes from Requests table via rfq_id
    console.log('Creating order - Quote ID:', quoteId, 'RFQ ID:', quote.rfq_id);
    
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('Orders')
      .insert({
        rfq_id: quote.rfq_id,
        quote_id: Number(quoteId), // Link to the accepted quote
        status: 'created',
      })
      .select('order_id, rfq_id, quote_id')
      .single();

    if (newOrder) {
      console.log('Order created successfully:');
      console.log('  - Order ID:', newOrder.order_id);
      console.log('  - Quote ID:', newOrder.quote_id);
      console.log('  - RFQ ID:', newOrder.rfq_id);
    }

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { 
          success: true,
          message: 'Quote accepted successfully, but order creation failed',
          warning: `Order creation failed: ${orderError.message}`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully and order created',
      orderId: newOrder?.order_id,
    });
  } catch (error: any) {
    console.error('Error accepting quote:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

