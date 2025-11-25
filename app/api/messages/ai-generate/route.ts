import { NextRequest, NextResponse } from 'next/server';
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

    const { conversationHistory, sellerName, buyerName, rfqContext } = await request.json();

    if (!conversationHistory || (!sellerName && !buyerName)) {
      return NextResponse.json(
        { error: 'Missing required fields: conversationHistory and either sellerName or buyerName are required' },
        { status: 400 }
      );
    }

    // Determine if this is a buyer or seller responding
    const isBuyer = !!sellerName;
    const otherPartyName = isBuyer ? sellerName : buyerName;

    // Get API key from environment
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Build conversation context for the AI
    const conversationText = conversationHistory
      .map((msg: { content: string; isFromBuyer: boolean; createdAt: string }) => {
        const sender = msg.isFromBuyer ? 'Buyer' : 'Seller';
        return `${sender}: ${msg.content}`;
      })
      .join('\n\n');

    // Build the prompt based on whether this is a buyer or seller
    const systemPrompt = isBuyer
      ? `You are a helpful assistant helping a buyer respond to a seller (${otherPartyName}) in a business conversation about a milk procurement RFQ (Request for Quote). 
Generate a professional, concise, and friendly response that:
- Is appropriate for a business context
- Addresses any questions or concerns from the seller
- Maintains a professional tone
- Is concise (2-3 sentences typically)
- If this is the first message, introduce yourself and express interest in their quote

Keep the response natural and conversational, not overly formal.`
      : `You are a helpful assistant helping a seller respond to a buyer (${otherPartyName}) in a business conversation about a milk procurement RFQ (Request for Quote). 
Generate a professional, concise, and friendly response that:
- Is appropriate for a business context
- Addresses any questions or concerns from the buyer
- Maintains a professional and helpful tone
- Is concise (2-3 sentences typically)
- If this is the first message, introduce yourself and express willingness to help

Keep the response natural and conversational, not overly formal.`;

    const userPrompt = `Here is the conversation history:
${conversationText || 'No previous messages.'}

${rfqContext ? `Context: This conversation is about an RFQ for ${rfqContext.quantityLiters} liters of ${rfqContext.milkType}.` : ''}

Generate an appropriate response from the ${isBuyer ? 'buyer' : 'seller'} to continue this conversation.`;

    // Call Anthropic API directly
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\n${userPrompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to generate AI message';
      try {
        const errorData = JSON.parse(errorText);
        // Handle different error response formats
        if (errorData.error) {
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message;
          } else {
            errorMessage = JSON.stringify(errorData.error);
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        errorMessage = errorText || errorMessage;
      }
      console.error('Anthropic API error:', { status: response.status, error: errorMessage, fullResponse: errorText });
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    const generatedMessage = data.content[0].text.trim();

    return NextResponse.json({
      success: true,
      message: generatedMessage,
    });
  } catch (error: any) {
    console.error('Error generating AI message:', error);
    
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

