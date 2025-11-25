import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
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

    // Get the request body
    const body = await request.json();
    const { rfqId, pricePerLiter, deliveryDate, notes } = body;

    // Validate required fields
    if (!rfqId || !pricePerLiter || !deliveryDate) {
      return NextResponse.json(
        { error: 'Missing required fields: rfqId, pricePerLiter, and deliveryDate are required' },
        { status: 400 }
      );
    }

    // Get the seller ID using admin client to bypass RLS
    const { data: sellerProfile, error: sellerError } = await supabaseAdmin
      .from('Sellers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (sellerError) {
      console.error('Error fetching seller profile:', sellerError);
      return NextResponse.json(
        { error: sellerError.message },
        { status: 500 }
      );
    }

    if (!sellerProfile) {
      return NextResponse.json(
        { error: 'Seller profile not found' },
        { status: 404 }
      );
    }

    // Get RFQ details for total price calculation
    const { data: rfq, error: rfqError } = await supabaseAdmin
      .from('Requests')
      .select('quantity_liters, status')
      .eq('rfq_id', rfqId)
      .single();

    if (rfqError || !rfq) {
      console.error('Error fetching RFQ:', rfqError);
      return NextResponse.json(
        { error: 'RFQ not found' },
        { status: 404 }
      );
    }

    if (rfq.status !== 'open') {
      return NextResponse.json(
        { error: 'RFQ is not open for quotes' },
        { status: 400 }
      );
    }

    // Calculate total price (ensure float values)
    const pricePerLiterFloat = parseFloat(pricePerLiter);
    const quantityLitersFloat = parseFloat(rfq.quantity_liters);
    const totalPrice = pricePerLiterFloat * quantityLitersFloat;

    // Check if this seller has already submitted a quote for this RFQ
    const { data: existingQuote } = await supabaseAdmin
      .from('Quotes')
      .select('id')
      .eq('rfq_id', rfqId)
      .eq('seller_id', sellerProfile.id) // Match as bigint
      .maybeSingle();

    if (existingQuote) {
      return NextResponse.json(
        { error: 'You have already submitted a quote for this RFQ' },
        { status: 400 }
      );
    }

    // Create a quote record in the Quotes table to support multiple quotes per RFQ
    const { data: quoteData, error: quoteError } = await supabaseAdmin
      .from('Quotes')
      .insert({
        rfq_id: rfqId,
        seller_id: sellerProfile.id, // Store as bigint (number)
        price_per_liter: pricePerLiterFloat,
        total_price: totalPrice,
        delivery_date: deliveryDate,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (quoteError) {
      console.error('Error creating quote:', quoteError);
      return NextResponse.json(
        { error: quoteError.message },
        { status: 500 }
      );
    }

    // Get current quote_ids from RFQ
    const { data: currentRfq } = await supabaseAdmin
      .from('Requests')
      .select('quote_ids')
      .eq('rfq_id', rfqId)
      .single();

    // Update quote_ids column - append the new quote ID
    let updatedQuoteIds: string;
    if (currentRfq?.quote_ids) {
      try {
        // Try parsing as JSON array
        const existingIds = JSON.parse(currentRfq.quote_ids);
        if (Array.isArray(existingIds)) {
          existingIds.push(quoteData.id);
          updatedQuoteIds = JSON.stringify(existingIds);
        } else {
          // If not an array, treat as comma-separated string
          const idsArray = currentRfq.quote_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
          idsArray.push(quoteData.id);
          updatedQuoteIds = idsArray.join(',');
        }
      } catch {
        // If parsing fails, treat as comma-separated string
        const idsArray = currentRfq.quote_ids.split(',').map((id: string) => id.trim()).filter(Boolean);
        idsArray.push(quoteData.id);
        updatedQuoteIds = idsArray.join(',');
      }
    } else {
      // No existing quotes, create new array
      updatedQuoteIds = JSON.stringify([quoteData.id]);
    }

    // Update RFQ with new quote_ids and status
    const updateData: any = {
      quote_ids: updatedQuoteIds,
      updated_at: new Date().toISOString(),
    };

    // Update status to 'quoted' if it's still 'open' (first quote received)
    if (rfq.status === 'open') {
      updateData.status = 'quoted';
    }

    await supabaseAdmin
      .from('Requests')
      .update(updateData)
      .eq('rfq_id', rfqId);

    return NextResponse.json({
      success: true,
      quote: quoteData,
    });
  } catch (error: any) {
    console.error('Error in create quote route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

