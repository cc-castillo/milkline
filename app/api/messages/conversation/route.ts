import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const buyerId = searchParams.get('buyerId');
    const sellerId = searchParams.get('sellerId');

    if (!buyerId || !sellerId) {
      return NextResponse.json(
        { error: 'Missing required parameters: buyerId and sellerId are required' },
        { status: 400 }
      );
    }

    // Verify user is the buyer
    const { data: buyerProfile } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (!buyerProfile || buyerProfile.id !== Number(buyerId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get messages for this conversation
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('Messages')
      .select('*')
      .eq('buyer_id', Number(buyerId))
      .eq('seller_id', Number(sellerId))
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        messages: [],
        conversationId: null,
      });
    }

    // Get conversation_id from first message
    const conversationId = messages[0].conversation_id;

    // Transform messages - use sender_id to determine sender
    const transformedMessages = messages.map((msg: any) => {
      // Use sender_id to determine if message is from buyer
      // sender_id will match either buyer_id or seller_id
      const isFromBuyer = msg.sender_id === Number(buyerId);
      
      return {
        id: msg.id.toString(),
        content: msg.content,
        createdAt: msg.created_at,
        isFromBuyer,
      };
    });

    return NextResponse.json({
      messages: transformedMessages,
      conversationId: conversationId,
    });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

