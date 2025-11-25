import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { dynamic } from '@/lib/route-config';

export { dynamic };

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      console.error('Error getting user:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rfqId = params.id;

    // Verify buyer owns this RFQ
    const { data: buyerProfile, error: buyerError } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (buyerError || !buyerProfile) {
      return NextResponse.json({ error: 'Buyer profile not found' }, { status: 404 });
    }

    // Verify RFQ ownership
    const { data: rfqData, error: rfqError } = await supabaseAdmin
      .from('Requests')
      .select('rfq_id, buyer_id')
      .eq('rfq_id', rfqId)
      .single();

    if (rfqError || !rfqData) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }

    if (rfqData.buyer_id !== buyerProfile.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all quotes for this RFQ using admin client to bypass RLS
    const { data: quotesData, error: quotesError } = await supabaseAdmin
      .from('Quotes')
      .select('*')
      .eq('rfq_id', rfqId)
      .order('created_at', { ascending: false });

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
      return NextResponse.json({ error: quotesError.message }, { status: 500 });
    }

    // Get seller IDs
    const sellerIds = Array.from(new Set(quotesData?.map((q: any) => q.seller_id).filter(Boolean) || []));
    
    // Fetch seller information
    let sellerMap = new Map();
    if (sellerIds.length > 0) {
      const { data: sellers, error: sellersError } = await supabaseAdmin
        .from('Sellers')
        .select('id, company_name')
        .in('id', sellerIds);

      if (!sellersError && sellers) {
        sellerMap = new Map(sellers.map((s: any) => [s.id.toString(), s.company_name]));
      }
    }

    // Transform quotes with seller names
    const transformedQuotes = (quotesData || []).map((q: any) => ({
      id: q.id,
      sellerName: sellerMap.get(q.seller_id?.toString()) || 'Unknown Seller',
      sellerId: q.seller_id ? Number(q.seller_id) : undefined,
      pricePerLiter: Number(q.price_per_liter),
      totalPrice: Number(q.total_price),
      deliveryDate: q.delivery_date,
      notes: q.notes || null,
      status: q.status,
      createdAt: q.created_at,
    }));

    return NextResponse.json({ quotes: transformedQuotes });
  } catch (error: any) {
    console.error('Error in get RFQ quotes route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

