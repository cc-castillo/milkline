import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { dynamic } from '@/lib/route-config';

export { dynamic };

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

    // Get seller IDs from request body
    const body = await request.json();
    const { sellerIds } = body;

    if (!sellerIds || !Array.isArray(sellerIds) || sellerIds.length === 0) {
      return NextResponse.json({
        sellers: [],
      });
    }

    // Fetch seller information using admin client
    const { data: sellers, error: sellersError } = await supabaseAdmin
      .from('Sellers')
      .select('id, company_name')
      .in('id', sellerIds.map((id: any) => id.toString()));

    if (sellersError) {
      console.error('Error fetching sellers:', sellersError);
      return NextResponse.json(
        { error: sellersError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sellers: sellers || [],
    });
  } catch (error: any) {
    console.error('Error in sellers route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

