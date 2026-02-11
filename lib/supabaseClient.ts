
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// We create a function to get the client because the URL/Key can change dynamically 
// based on user settings in local storage.
export const getSupabaseClient = (url: string, key: string): SupabaseClient => {
  // 1. Basic Validation / Cleaning
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (!cleanUrl.startsWith('http')) {
    throw new Error("Supabase URL harus dimulai dengan https://");
  }

  try {
    return createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false, // Penting untuk Anon usage tanpa login user
        autoRefreshToken: false,
      }
    });
  } catch (err) {
    console.error("Supabase Client Init Error:", err);
    throw new Error("Konfigurasi Supabase tidak valid.");
  }
};
