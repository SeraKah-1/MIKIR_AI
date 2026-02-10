
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// We create a function to get the client because the URL/Key can change dynamically 
// based on user settings in local storage.
export const getSupabaseClient = (url: string, key: string): SupabaseClient => {
  return createClient(url, key);
};
