import { supabase } from './supabase';

export interface RFQFormData {
  closingDate: string;
  milkType: string;
  milkQuantity: number;
  budget: number;
  neededByDate: string;
  notes?: string;
}

export interface RFQData {
  rfq_id: string;
  buyer_id: number; // Changed to number (bigint) to match Buyers table
  milk_type: string;
  quantity_liters: number;
  needed_by_date: string;
  budget_max: number | null;
  status: 'open' | 'quoted' | 'ordered' | 'fulfilled' | 'cancelled';
  quote_ids?: string | null; // Text column containing quote IDs
  created_at: string;
  updated_at: string;
}

/**
 * Get the Buyers table ID (bigint) from the authenticated user's email
 * Uses API route with admin client to bypass RLS
 */
async function getBuyerIdFromAuth(): Promise<number> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user || !user.email) {
    throw new Error('You must be logged in');
  }

  // Get session token for API call
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Failed to get session. Please sign in again.');
  }

  // Use API route with admin client to bypass RLS
  const response = await fetch('/api/buyer-id', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch buyer profile');
  }

  const data = await response.json();
  return data.buyerId;
}

/**
 * Create a new RFQ in Supabase
 * Uses API route with admin client to bypass RLS
 */
export async function createRFQ(formData: RFQFormData): Promise<RFQData> {
  // Get session token for API call
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('You must be logged in');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Failed to get session. Please sign in again.');
  }

  // Use API route with admin client to bypass RLS
  const response = await fetch('/api/rfq/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      milkType: formData.milkType,
      milkQuantity: formData.milkQuantity,
      neededByDate: formData.neededByDate,
      budget: formData.budget,
      notes: formData.notes,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create RFQ');
  }

  const data = await response.json();
  return data.rfq as RFQData;
}

/**
 * Get RFQ by ID
 * Uses API route with admin client to bypass RLS
 */
export async function getRFQ(rfqId: string): Promise<RFQData | null> {
  // Get session token for API call
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('You must be logged in');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Failed to get session. Please sign in again.');
  }

  // Use API route with admin client to bypass RLS
  const response = await fetch(`/api/rfq/${rfqId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    if (response.status === 404) {
      return null;
    }
    throw new Error(errorData.error || 'Failed to fetch RFQ');
  }

  const data = await response.json();
  return data.rfq as RFQData;
}

/**
 * List RFQs for the current user
 * Uses API route with admin client to bypass RLS
 */
export async function listMyRFQs(): Promise<RFQData[]> {
  // Get session token for API call
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    throw new Error('You must be logged in');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Failed to get session. Please sign in again.');
  }

  // Use API route with admin client to bypass RLS
  const response = await fetch('/api/rfq/list', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to list RFQs');
  }

  const data = await response.json();
  return (data.rfqs || []) as RFQData[];
}

/**
 * List all open RFQs (for sellers to see)
 */
export async function listOpenRFQs(): Promise<RFQData[]> {
  const { data, error } = await supabase
    .from('Requests')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing open RFQs:', error);
    throw error;
  }

  return (data || []) as RFQData[];
}

