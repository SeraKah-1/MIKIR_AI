
/**
 * ==========================================
 * KEYCARD SERVICE (🔒)
 * Handles AES Encryption/Decryption for .mikir files
 * ==========================================
 */
import CryptoJS from 'crypto-js';
import { KeycardData, AiProvider } from '../types';
import { saveApiKey, saveStorageConfig, saveApiKeysPool, setKeycardId, generateId } from './storageService';

const KEYCARD_SESSION_KEY = 'mikir_active_keycard';

// --- GENERATE KEYCARD (ADMIN) ---
export const generateKeycard = (
  pin: string,
  data: Omit<KeycardData, 'version'>
): string => {
  const payload: KeycardData = {
    ...data,
    version: '2.0', // Bump version for ID support
    id: data.id || generateId(), // Ensure ID exists
  };

  const jsonString = JSON.stringify(payload);
  
  // Encrypt using AES
  const encrypted = CryptoJS.AES.encrypt(jsonString, pin).toString();
  
  // Add a signature header to verify it's a valid card before decrypting
  return `MIKIRCARDv1|${encrypted}`;
};

// --- READ KEYCARD (USER) ---
export const unlockKeycard = (fileContent: string, pin: string): KeycardData => {
  if (!fileContent.startsWith('MIKIRCARDv1|')) {
    throw new Error("Format kartu tidak valid atau rusak.");
  }

  const encryptedData = fileContent.split('|')[1];

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, pin);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) throw new Error("PIN Salah");
    
    const data: KeycardData = JSON.parse(decryptedString);

    // Validation Checks
    if (data.metadata.expires_at && Date.now() > data.metadata.expires_at) {
      throw new Error("Kartu Akses ini sudah kadaluarsa.");
    }

    if (data.metadata.valid_domain) {
       const currentDomain = window.location.hostname;
       if (!currentDomain.includes(data.metadata.valid_domain) && !currentDomain.includes('localhost')) {
          throw new Error(`Kartu ini hanya valid untuk domain: ${data.metadata.valid_domain}`);
       }
    }

    return data;
  } catch (e) {
    throw new Error("PIN Salah atau Kartu Rusak.");
  }
};

// --- SESSION MANAGEMENT ---
export const applyKeycardToSession = (data: KeycardData): { upgraded: boolean, newId?: string } => {
  let upgraded = false;
  let newId: string | undefined;

  // 0. HANDLE IDENTITY (ID)
  if (data.id) {
      setKeycardId(data.id);
  } else {
      // LEGACY MIGRATION: Generate new ID for old cards
      newId = generateId();
      setKeycardId(newId);
      upgraded = true;
  }
  
  // DETERMINE ACTIVE PROVIDER
  let activeProvider = data.config.preferredProvider;
  if (!activeProvider) {
      // Fallback for legacy cards
      if ((data.config.geminiKeys && data.config.geminiKeys.length > 0) || data.config.geminiKey) {
          activeProvider = 'gemini';
      } else if ((data.config.groqKeys && data.config.groqKeys.length > 0) || data.config.groqKey) {
          activeProvider = 'groq';
      } else {
          activeProvider = 'gemini';
      }
  }

  // 1. APPLY KEYS BASED ON PROVIDER
  if (activeProvider === 'gemini') {
      // Load Gemini
      if (data.config.geminiKeys && data.config.geminiKeys.length > 0) {
         saveApiKeysPool('gemini', data.config.geminiKeys);
         saveApiKey('gemini', data.config.geminiKeys[0]);
      } else if (data.config.geminiKey) {
         saveApiKey('gemini', data.config.geminiKey);
      }
      
      // WIPE GROQ (Enforce Exclusivity)
      localStorage.removeItem('glassquiz_groq_key');
      localStorage.removeItem('glassquiz_groq_keys_pool');
      
  } else {
      // Load Groq
      if (data.config.groqKeys && data.config.groqKeys.length > 0) {
         saveApiKeysPool('groq', data.config.groqKeys);
         saveApiKey('groq', data.config.groqKeys[0]);
      } else if (data.config.groqKey) {
         saveApiKey('groq', data.config.groqKey);
      }
      
      // WIPE GEMINI (Enforce Exclusivity)
      localStorage.removeItem('glassquiz_api_key');
      localStorage.removeItem('glassquiz_gemini_keys_pool');
  }

  // Handle Legacy cards (v1.0) that had generic 'apiKey' and 'provider'
  // @ts-ignore
  if (data.config.apiKey && data.config.provider) {
     // @ts-ignore
     // Only apply if it matches our active provider decision
     if (data.config.provider === activeProvider) {
        saveApiKey(data.config.provider, data.config.apiKey);
     }
  }

  // Inject Supabase
  if (data.config.supabaseUrl && data.config.supabaseKey) {
    saveStorageConfig('supabase', { 
      url: data.config.supabaseUrl, 
      key: data.config.supabaseKey 
    });
  }

  // Save metadata to know we are logged in via card
  localStorage.setItem(KEYCARD_SESSION_KEY, JSON.stringify(data.metadata));
  window.dispatchEvent(new Event('keycard_changed'));
  
  return { upgraded, newId };
};

export const getKeycardSession = () => {
  const raw = localStorage.getItem(KEYCARD_SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
};

export const logoutKeycard = () => {
  // 1. Remove Session Metadata
  localStorage.removeItem(KEYCARD_SESSION_KEY);
  
  // 2. Remove Credentials
  localStorage.removeItem('glassquiz_api_key');
  localStorage.removeItem('glassquiz_groq_key');
  
  // Remove Arrays
  localStorage.removeItem('glassquiz_gemini_keys_pool');
  localStorage.removeItem('glassquiz_groq_keys_pool');
  
  localStorage.removeItem('glassquiz_supabase_config');
  
  // 3. Reset Preferences
  localStorage.setItem('glassquiz_storage_pref', 'local');
  
  // 4. Force UI update by dispatching storage event (optional) or just reloading page
  console.log("Keycard Ejected. Storage Cleared.");
  window.dispatchEvent(new Event('keycard_changed'));
};
