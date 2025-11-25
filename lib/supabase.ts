import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL. Please add it to your .env.local file.');
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY. Please add it to your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (!supabaseServiceRoleKey) {
  console.warn('Missing env.SUPABASE_SERVICE_ROLE_KEY. Admin operations may not work.');
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey || supabaseAnonKey // Fallback to anon key if service role key is missing
);