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
    const { quoteId } = body;

    if (!quoteId) {
      return NextResponse.json(
        { error: 'Missing required field: quoteId' },
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

    // Verify that this quote belongs to this seller
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('Quotes')
      .select('id, seller_id, status')
      .eq('id', quoteId)
      .eq('seller_id', sellerProfile.id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found or you do not have permission to cancel this quote' },
        { status: 404 }
      );
    }

    // Check if quote can be cancelled (only pending quotes can be cancelled)
    if (quote.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot cancel quote with status: ${quote.status}. Only pending quotes can be cancelled.` },
        { status: 400 }
      );
    }

    // Update the quote status to 'cancelled'
    // Note: If the database constraint doesn't allow 'cancelled', 
    // we'll get an error and can handle it appropriately
    const { data: updatedQuote, error: updateError } = await supabaseAdmin
      .from('Quotes')
      .update({ 
        status: 'cancelled',
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (updateError) {
      console.error('Error cancelling quote:', updateError);
      // Check if the error is due to a constraint violation
      if (updateError.message?.includes('check constraint') || updateError.message?.includes('invalid input value')) {
        return NextResponse.json(
          { 
            error: 'The database does not allow "cancelled" status for quotes. Please update the database schema to include "cancelled" in the status CHECK constraint, or use "rejected" instead.',
            details: updateError.message 
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quote: updatedQuote,
    });
  } catch (error: any) {
    console.error('Error in cancel quote route:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

