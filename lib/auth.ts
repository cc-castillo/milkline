// Authentication and session utilities

import { supabase } from './supabase';

export interface SessionCheckResult {
  isAuthenticated: boolean;
  userType?: 'buyer' | 'seller';
  token?: string;
  error?: string;
}

/**
 * Check if user is authenticated and get their session token
 */
export async function checkSession(): Promise<SessionCheckResult> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { isAuthenticated: false, error: authError?.message };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData?.session?.access_token) {
      return { isAuthenticated: false, error: sessionError?.message };
    }

    return {
      isAuthenticated: true,
      token: sessionData.session.access_token,
    };
  } catch (error: any) {
    return { isAuthenticated: false, error: error.message };
  }
}

/**
 * Get user profile to determine user type
 */
export async function getUserProfile(token: string): Promise<{ userType?: 'buyer' | 'seller'; error?: string }> {
  try {
    const response = await fetch('/api/user-profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || 'Failed to get user profile' };
    }

    const data = await response.json();
    return { userType: data.userType };
  } catch (error: any) {
    return { error: error.message };
  }
}

