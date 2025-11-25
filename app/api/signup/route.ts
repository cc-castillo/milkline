import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, companyName, userType, contactEmail, phone, address } = body;

    // Validate required fields
    if (!email || !password || !companyName || !userType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // First, check if profile already exists in the appropriate table
    // Only check the table that matches the selected user type (Buyers OR Sellers, not both)
    const tableName = userType === 'buyer' ? 'Buyers' : 'Sellers';
    const { data: existingProfile } = await supabaseAdmin
      .from(tableName)
      .select('id')
      .eq('email_login', email)
      .maybeSingle();

    if (existingProfile) {
      // Profile already exists in the selected table - user is fully registered
      return NextResponse.json(
        { error: 'A user with this email address has already been registered' },
        { status: 400 }
      );
    }

    // Check if user already exists in auth before trying to create
    const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = allUsers?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    let authUser;

    if (existingAuthUser) {
      // User exists in auth but not in profile - update password and proceed to create profile
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAuthUser.id,
        { password }
      );

      if (updateError) {
        console.error('Error updating existing auth user:', updateError);
        return NextResponse.json(
          { error: `Failed to update existing user: ${updateError.message}` },
          { status: 400 }
        );
      }

      authUser = existingAuthUser;
    } else {
      // User doesn't exist in auth - create new user
      const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
      });

      if (signUpError) {
        // Log the actual error for debugging
        console.error('Error creating auth user:', signUpError);
        
        // Check if error is because user already exists (in case listUsers didn't catch it)
        const errorMessage = signUpError.message?.toLowerCase() || '';
        if (errorMessage.includes('already') || errorMessage.includes('exists') || errorMessage.includes('registered')) {
          // Try to get the user one more time
          const { data: retryUsers } = await supabaseAdmin.auth.admin.listUsers();
          const retryUser = retryUsers?.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          
          if (retryUser) {
            // Update password and proceed
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              retryUser.id,
              { password }
            );

            if (updateError) {
              return NextResponse.json(
                { error: `Failed to update existing user: ${updateError.message}` },
                { status: 400 }
              );
            }

            authUser = retryUser;
          } else {
            return NextResponse.json(
              { error: signUpError.message || 'A user with this email address has already been registered' },
              { status: 400 }
            );
          }
        } else {
          // Some other error creating user
          return NextResponse.json(
            { error: signUpError.message || 'Failed to create user account' },
            { status: 400 }
          );
        }
      } else {
        // User created successfully
        if (!authData.user) {
          return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
          );
        }

        authUser = authData.user;
      }
    }

    // Determine the correct field name based on table
    const profileData: any = userType === 'buyer' 
      ? {
          company_name: companyName,
          email_login: email,
          email_contact: contactEmail || email,
        }
      : {
          company_name: companyName,
          email_login: email,
          contact_email: contactEmail || email,
        };
    
    // Add phone and address if provided
    if (phone && phone.trim()) {
      profileData.telephone = phone.trim();
    }
    if (address && (address.street || address.city || address.state || address.zip || address.country)) {
      // Only include non-empty address fields
      const addressData: any = {};
      if (address.street) addressData.street = address.street;
      if (address.city) addressData.city = address.city;
      if (address.state) addressData.state = address.state;
      if (address.zip) addressData.zip = address.zip;
      if (address.country) addressData.country = address.country;
      
      if (Object.keys(addressData).length > 0) {
        profileData.address = addressData;
      }
    }

    const { error: profileError } = await supabaseAdmin
      .from(tableName)
      .insert(profileData);

    if (profileError) {
      // If profile creation fails, check if it's a duplicate key error
      if (profileError.code === '23505' || profileError.message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'A user with this email address has already been registered' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: authUser,
      userType,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

