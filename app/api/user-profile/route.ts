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

    // Get the current user - the client is already configured with the token
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user || !user.email) {
      console.error('Error getting user:', userError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS and check both tables
    const { data: buyerProfile, error: buyerError } = await supabaseAdmin
      .from('Buyers')
      .select('id, company_name')
      .eq('email_login', user.email)
      .maybeSingle();

    if (buyerProfile && !buyerError) {
      return NextResponse.json({
        userType: 'buyer',
        profile: buyerProfile,
      });
    }

    // Check Sellers table (if it exists)
    const { data: sellerProfile, error: sellerError } = await supabaseAdmin
      .from('Sellers')
      .select('id, company_name')
      .eq('email_login', user.email)
      .maybeSingle();

    if (sellerProfile && !sellerError) {
      return NextResponse.json({
        userType: 'seller',
        profile: sellerProfile,
      });
    }

    // If not found in either table
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

