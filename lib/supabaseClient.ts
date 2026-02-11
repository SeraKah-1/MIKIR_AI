
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cache container untuk menyimpan instance client
let clientInstance: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

/**
 * Mendapatkan atau membuat instance Supabase Client.
 * Menggunakan pola Singleton: jika URL/Key sama, pakai client yang sudah ada.
 */
export const getSupabaseClient = (url: string, key: string): SupabaseClient => {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  if (!cleanUrl || !cleanKey) {
    throw new Error("Supabase URL dan Key tidak boleh kosong.");
  }

  // Jika kredensial berubah, reset instance
  if (cleanUrl !== cachedUrl || cleanKey !== cachedKey) {
    clientInstance = null;
  }

  if (!clientInstance) {
    try {
      clientInstance = createClient(cleanUrl, cleanKey, {
        auth: {
          persistSession: false, // Kita pakai mode 'Anon' / Public Key
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
        global: {
          headers: { 'x-application-name': 'mikir-app' }
        }
      });
      
      // Update cache
      cachedUrl = cleanUrl;
      cachedKey = cleanKey;
    } catch (err) {
      console.error("Gagal inisialisasi Supabase:", err);
      throw new Error("Format URL/Key Supabase tidak valid.");
    }
  }

  return clientInstance;
};
