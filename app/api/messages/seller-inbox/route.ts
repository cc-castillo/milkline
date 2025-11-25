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

    // Get seller ID
    const { data: sellerProfile, error: sellerError } = await supabaseAdmin
      .from('Sellers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (sellerError || !sellerProfile) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 });
    }

    const sellerId = sellerProfile.id;

    // Get all messages for this seller
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('Messages')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ threads: [] });
    }

    // Group messages by conversation_id
    const conversationMap = new Map<number, any[]>();
    messages.forEach((msg: any) => {
      const convId = msg.conversation_id;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, []);
      }
      conversationMap.get(convId)!.push(msg);
    });

    // Get unique buyer IDs
    const buyerIds = Array.from(new Set(messages.map((m: any) => m.buyer_id).filter(Boolean)));
    
    let buyerMap = new Map();
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabaseAdmin
        .from('Buyers')
        .select('id, company_name')
        .in('id', buyerIds);

      if (buyers) {
        buyers.forEach(buyer => {
          buyerMap.set(buyer.id, buyer.company_name);
        });
      }
    }

    // Transform data into thread-like structure
    const inboxData = Array.from(conversationMap.entries()).map(([conversationId, conversationMessages]) => {
      const firstMessage = conversationMessages[0];
      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const buyerId = firstMessage.buyer_id;
      const buyerName = buyerId ? buyerMap.get(buyerId) : 'Unknown Buyer';

      return {
        id: conversationId.toString(),
        conversationId: conversationId,
        subject: `Conversation with ${buyerName}`,
        buyerName,
        buyerId: buyerId,
        lastMessageAt: lastMessage.created_at,
        createdAt: firstMessage.created_at,
        messages: conversationMessages.map((msg: any) => {
          // Use sender_id to determine if message is from seller
          // sender_id will match either buyer_id or seller_id
          // Convert both to numbers for reliable comparison
          const isFromSeller = Number(msg.sender_id) === Number(sellerId);
          
          return {
            id: msg.id.toString(),
            senderId: msg.sender_id ? msg.sender_id.toString() : (msg.seller_id.toString()),
            content: msg.content,
            createdAt: msg.created_at,
            isFromSeller: isFromSeller,
          };
        }),
        unreadCount: 0, // TODO: Implement proper unread count logic
      };
    });

    // Sort by last message time
    inboxData.sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return NextResponse.json({ threads: inboxData });
  } catch (error: any) {
    console.error('Error fetching seller inbox:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

