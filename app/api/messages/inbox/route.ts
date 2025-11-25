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

    // Get buyer ID
    const { data: buyerProfile, error: buyerError } = await supabaseAdmin
      .from('Buyers')
      .select('id')
      .eq('email_login', user.email)
      .maybeSingle();

    if (buyerError || !buyerProfile) {
      return NextResponse.json({ error: 'Buyer profile not found' }, { status: 404 });
    }

    const buyerId = buyerProfile.id;

    // Get all messages for this buyer
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('Messages')
      .select('*')
      .eq('buyer_id', buyerId)
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

    // Get unique seller IDs
    const sellerIds = Array.from(new Set(messages.map((m: any) => m.seller_id).filter(Boolean)));
    
    let sellerMap = new Map();
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabaseAdmin
        .from('Sellers')
        .select('id, company_name')
        .in('id', sellerIds);

      if (sellers) {
        sellers.forEach(seller => {
          sellerMap.set(seller.id, seller.company_name);
        });
      }
    }

    // Get RFQ information if available (we'll need to link this somehow - maybe via a join table or store rfq_id in messages)
    // For now, we'll just return the conversations

    // Transform data into thread-like structure
    const inboxData = Array.from(conversationMap.entries()).map(([conversationId, conversationMessages]) => {
      const firstMessage = conversationMessages[0];
      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const sellerId = firstMessage.seller_id;
      const sellerName = sellerId ? sellerMap.get(sellerId) : 'Unknown Seller';

      return {
        id: conversationId.toString(),
        conversationId: conversationId,
        subject: `Conversation with ${sellerName}`,
        sellerName,
        sellerId: sellerId,
        lastMessageAt: lastMessage.created_at,
        createdAt: firstMessage.created_at,
        messages: conversationMessages.map((msg: any) => {
          // Use sender_id to determine if message is from buyer
          // sender_id will match either buyer_id or seller_id
          // Convert both to numbers for reliable comparison
          const isFromBuyer = Number(msg.sender_id) === Number(buyerId);
          
          return {
            id: msg.id.toString(),
            senderId: msg.sender_id ? msg.sender_id.toString() : (msg.buyer_id.toString()),
            content: msg.content,
            createdAt: msg.created_at,
            isFromBuyer: isFromBuyer,
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
    console.error('Error fetching inbox:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
