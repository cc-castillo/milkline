import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { dynamic } from '@/lib/route-config';

export { dynamic };

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

    // Fetch quotes submitted by this seller from the Quotes table
    // seller_id is stored as bigint, so we need to match it correctly
    const { data: myQuotes, error: quoteError } = await supabaseAdmin
      .from('Quotes')
      .select('*')
      .eq('seller_id', sellerProfile.id) // Match as bigint, not string
      .order('created_at', { ascending: false });

    if (quoteError) {
      console.error('Error fetching seller quotes:', quoteError);
      console.error('Error details:', JSON.stringify(quoteError, null, 2));
      return NextResponse.json(
        { 
          error: quoteError.message || 'Failed to fetch quotes',
          details: quoteError 
        },
        { status: 500 }
      );
    }

    // If we have quotes, fetch RFQ data for each one
    if (myQuotes && myQuotes.length > 0) {
      const rfqIds = Array.from(new Set(myQuotes.map((q: any) => q.rfq_id).filter(Boolean)));
      
      if (rfqIds.length > 0) {
        const { data: rfqsData, error: rfqsError } = await supabaseAdmin
          .from('Requests')
          .select('rfq_id, buyer_id, milk_type, quantity_liters, needed_by_date, budget_max, status, created_at')
          .in('rfq_id', rfqIds);

        if (!rfqsError && rfqsData) {
          // Fetch buyer information for each RFQ
          const buyerIds = Array.from(new Set(rfqsData.map((r: any) => r.buyer_id).filter(Boolean)));
          
          let buyerMap = new Map();
          if (buyerIds.length > 0) {
            const { data: buyers } = await supabaseAdmin
              .from('Buyers')
              .select('id, company_name')
              .in('id', buyerIds);

            buyerMap = new Map(buyers?.map((b: any) => [b.id, b.company_name]) || []);
          }

          // Create a map of RFQ data with buyer info for quick lookup
          const rfqMap = new Map();
          rfqsData.forEach((r: any) => {
            rfqMap.set(r.rfq_id, {
              ...r,
              buyer: {
                company_name: buyerMap.get(r.buyer_id) || 'Unknown Buyer',
                id: r.buyer_id,
              }
            });
          });
          
          // Attach RFQ data to each quote
          myQuotes.forEach((quote: any) => {
            quote.rfq = rfqMap.get(quote.rfq_id) || null;
          });
        }
      }
    }

    console.log(`Found ${myQuotes?.length || 0} quotes for seller ${sellerProfile.id}`);

    return NextResponse.json({
      quotes: myQuotes || [],
    });
  } catch (error: any) {
    console.error('Error in my quotes route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

