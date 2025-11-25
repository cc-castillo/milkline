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

    // List all open RFQs using admin client to bypass RLS
    // This allows sellers to see all open RFQs regardless of RLS policies
    const { data: rfqs, error: rfqError } = await supabaseAdmin
      .from('Requests')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (rfqError) {
      console.error('Error listing open RFQs:', rfqError);
      return NextResponse.json(
        { error: rfqError.message },
        { status: 500 }
      );
    }

    // Fetch buyer information for each RFQ
    if (rfqs && rfqs.length > 0) {
      const buyerIds = Array.from(new Set(rfqs.map(rfq => rfq.buyer_id).filter(Boolean)));
      
      if (buyerIds.length > 0) {
        const { data: buyers } = await supabaseAdmin
          .from('Buyers')
          .select('id, company_name')
          .in('id', buyerIds);

        // Map buyer info to RFQs
        const buyerMap = new Map(buyers?.map(b => [b.id, b.company_name]) || []);
        
        rfqs.forEach(rfq => {
          rfq.buyer = {
            company_name: buyerMap.get(rfq.buyer_id) || 'Unknown Buyer',
            id: rfq.buyer_id,
          };
        });
      }
    }

    return NextResponse.json({
      rfqs: rfqs || [],
    });
  } catch (error: any) {
    console.error('Error in open RFQs route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

