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
      console.error('Error getting user:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rfqId } = body;

    if (!rfqId) {
      return NextResponse.json({ error: 'Missing required field: rfqId' }, { status: 400 });
    }

    // Get buyer profile to verify ownership
    const { data: buyerProfile, error: buyerError } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (buyerError || !buyerProfile) {
      console.error('Error fetching buyer profile:', buyerError);
      return NextResponse.json({ error: 'Buyer profile not found' }, { status: 404 });
    }

    // Verify that this RFQ belongs to this buyer
    const { data: existingRFQ, error: fetchRFQError } = await supabaseAdmin
      .from('Requests')
      .select('rfq_id, buyer_id, status')
      .eq('rfq_id', rfqId)
      .single();

    if (fetchRFQError || !existingRFQ) {
      console.error('Error fetching RFQ:', fetchRFQError);
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 });
    }

    // Verify ownership - buyer_id should match
    if (existingRFQ.buyer_id !== buyerProfile.id) {
      return NextResponse.json({ error: 'Unauthorized to cancel this RFQ' }, { status: 403 });
    }

    // Check if RFQ can be cancelled (cannot cancel if already fulfilled or cancelled)
    if (existingRFQ.status === 'fulfilled') {
      return NextResponse.json({ error: 'Cannot cancel a fulfilled RFQ' }, { status: 400 });
    }

    if (existingRFQ.status === 'cancelled') {
      return NextResponse.json({ error: 'RFQ is already cancelled' }, { status: 400 });
    }

    // Update the RFQ status to 'cancelled'
    const { data: updatedRFQ, error: updateError } = await supabaseAdmin
      .from('Requests')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('rfq_id', rfqId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling RFQ:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rfq: updatedRFQ });
  } catch (error: any) {
    console.error('Error in cancel RFQ route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

