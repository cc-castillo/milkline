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

    // Get the buyer ID using admin client to bypass RLS
    const { data: buyerProfile, error: buyerError } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (buyerError) {
      console.error('Error fetching buyer profile:', buyerError);
      return NextResponse.json(
        { error: buyerError.message },
        { status: 500 }
      );
    }

    if (!buyerProfile) {
      return NextResponse.json(
        { error: 'Buyer profile not found' },
        { status: 404 }
      );
    }

    // List RFQs for this buyer using admin client to bypass RLS
    const { data: rfqs, error: rfqError } = await supabaseAdmin
      .from('Requests')
      .select('*')
      .eq('buyer_id', buyerProfile.id)
      .order('created_at', { ascending: false });

    if (rfqError) {
      console.error('Error listing RFQs:', rfqError);
      return NextResponse.json(
        { error: rfqError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rfqs: rfqs || [],
    });
  } catch (error: any) {
    console.error('Error in list RFQs route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

