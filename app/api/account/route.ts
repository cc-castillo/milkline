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

    // Check Buyers table
    const { data: buyerProfile, error: buyerError } = await supabaseAdmin
      .from('Buyers')
      .select('id, company_name, email_login, email_contact, telephone, address')
      .eq('email_login', user.email)
      .maybeSingle();

    if (buyerProfile && !buyerError) {
      return NextResponse.json({
        userType: 'buyer',
        profile: buyerProfile,
      });
    }

    // Check Sellers table
    const { data: sellerProfile, error: sellerError } = await supabaseAdmin
      .from('Sellers')
      .select('id, company_name, email_login, contact_email, telephone, address')
      .eq('email_login', user.email)
      .maybeSingle();

    if (sellerProfile && !sellerError) {
      return NextResponse.json({
        userType: 'seller',
        profile: sellerProfile,
      });
    }

    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  } catch (error: any) {
    console.error('Error fetching account:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { userType, companyName, contactEmail, phone, address } = body;

    if (!userType) {
      return NextResponse.json({ error: 'Missing userType' }, { status: 400 });
    }

    const tableName = userType === 'buyer' ? 'Buyers' : 'Sellers';
    const updateData: any = {};

    if (companyName !== undefined) updateData.company_name = companyName;
    if (contactEmail !== undefined) {
      if (userType === 'buyer') {
        updateData.email_contact = contactEmail;
      } else {
        updateData.contact_email = contactEmail;
      }
    }
    if (phone !== undefined) updateData.telephone = phone;
    if (address !== undefined) updateData.address = address;

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from(tableName)
      .update(updateData)
      .eq('email_login', user.email)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error('Error updating account:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

