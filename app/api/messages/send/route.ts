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

    const { rfqId, buyerId, sellerId, content, conversationId } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Missing required field: content is required' },
        { status: 400 }
      );
    }

    // Determine if user is buyer or seller and get their ID
    const { data: buyerProfile } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    const { data: sellerProfile } = await supabaseAdmin
      .from('Sellers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    const isBuyer = !!buyerProfile;
    const isSeller = !!sellerProfile;
    
    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let finalBuyerId: number;
    let finalSellerId: number | null = null;
    let finalConversationId: number;

    // If conversationId is provided, use existing conversation (for replies)
    if (conversationId) {
      finalConversationId = Number(conversationId);
      
      // Get existing conversation to determine buyer_id and seller_id
      const { data: existingMessage } = await supabaseAdmin
        .from('Messages')
        .select('buyer_id, seller_id')
        .eq('conversation_id', finalConversationId)
        .limit(1)
        .maybeSingle();

      if (existingMessage) {
        finalBuyerId = existingMessage.buyer_id;
        finalSellerId = existingMessage.seller_id;
      } else {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
    } else {
      // Create new conversation - need both buyerId and sellerId
      if (isBuyer) {
        // Buyer is sending, so they provide sellerId
        if (!sellerId) {
          return NextResponse.json(
            { error: 'Missing required field: sellerId is required when buyer sends a message' },
            { status: 400 }
          );
        }
        finalBuyerId = Number(buyerProfile!.id);
        finalSellerId = Number(sellerId);
      } else if (isSeller) {
        // Seller is sending, so they provide buyerId
        if (!buyerId) {
          return NextResponse.json(
            { error: 'Missing required field: buyerId is required when seller sends a message' },
            { status: 400 }
          );
        }
        finalBuyerId = Number(buyerId);
        finalSellerId = Number(sellerProfile!.id);
      } else {
        return NextResponse.json(
          { error: 'Invalid user type' },
          { status: 400 }
        );
      }

      // Check if conversation already exists between these buyer and seller
      const { data: existingMessage } = await supabaseAdmin
        .from('Messages')
        .select('conversation_id')
        .eq('buyer_id', finalBuyerId)
        .eq('seller_id', finalSellerId)
        .limit(1)
        .maybeSingle();

      if (existingMessage) {
        finalConversationId = existingMessage.conversation_id;
      } else {
        // Generate a new conversation_id using timestamp (simple approach)
        // In production, you might want to use a sequence or more sophisticated ID generation
        finalConversationId = Date.now();
      }
    }

    // Determine sender_id based on whether user is buyer or seller
    const senderId = isBuyer ? buyerProfile!.id : sellerProfile!.id;

    // Insert message into existing conversation
    const { data: message, error: messageError } = await supabaseAdmin
      .from('Messages')
      .insert({
        buyer_id: finalBuyerId,
        seller_id: finalSellerId,
        sender_id: senderId,
        content,
        conversation_id: finalConversationId,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return NextResponse.json(
        { error: `Failed to send message: ${messageError.message}` },
        { status: 500 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Failed to send message: No message returned' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        conversationId: finalConversationId,
        content: message.content,
        createdAt: message.created_at,
        isFromBuyer: isBuyer, // Include sender info in response
      },
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
