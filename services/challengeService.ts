
/**
 * ==========================================
 * CHALLENGE SERVICE (Async Multiplayer)
 * Handles creating and fetching challenge data from Supabase.
 * ==========================================
 */

import { MikirCloud, SupabaseConfig } from "./supabaseService";
import { ChallengeData, Question } from "../types";
import { getSupabaseConfig } from "./storageService";
import { v4 as uuidv4 } from 'uuid'; // Fallback if not available, use Math.random

const TABLE_NAME = 'mikir_challenges';

// SQL TO RUN IN SUPABASE:
/*
create table if not exists public.mikir_challenges (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  creator_name text,
  topic text,
  questions jsonb not null,
  creator_score integer,
  challengers jsonb default '[]'::jsonb
);

alter table public.mikir_challenges enable row level security;
create policy "Public Challenges" on public.mikir_challenges for all using (true) with check (true);
*/

export const createChallenge = async (
  creatorName: string,
  topic: string,
  questions: Question[],
  creatorScore: number
): Promise<string> => {
  
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) throw new Error("Fitur Challenge butuh koneksi Supabase. Cek Settings.");

  const challengeId = Math.random().toString(36).substring(2, 10); // Simple ID
  
  const payload = {
    id: challengeId,
    creator_name: creatorName,
    topic: topic,
    questions: questions, // Store strict snapshot
    creator_score: creatorScore,
    challengers: [] 
  };

  const sb = MikirCloud._client(sbConfig);
  const { error } = await sb.from(TABLE_NAME).insert(payload);

  if (error) {
     if (error.message.includes('relation') && error.message.includes('does not exist')) {
        throw new Error("Tabel 'mikir_challenges' belum dibuat di Supabase.");
     }
     throw new Error(error.message);
  }

  return challengeId;
};

export const getChallenge = async (challengeId: string): Promise<ChallengeData | null> => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) return null;

  const sb = MikirCloud._client(sbConfig);
  const { data, error } = await sb.from(TABLE_NAME).select('*').eq('id', challengeId).single();

  if (error || !data) return null;

  return {
    id: data.id,
    creatorName: data.creator_name,
    topic: data.topic,
    questions: data.questions,
    creatorScore: data.creator_score,
    created_at: data.created_at
  };
};

export const submitChallengeAttempt = async (
  challengeId: string,
  challengerName: string,
  score: number
) => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) return;

  const sb = MikirCloud._client(sbConfig);
  
  // Fetch existing first to append (Simple implementation)
  // In production, use RPC function to append safely
  const { data } = await sb.from(TABLE_NAME).select('challengers').eq('id', challengeId).single();
  
  if (data) {
     const newEntry = { name: challengerName, score, date: new Date().toISOString() };
     const updatedList = [...(data.challengers || []), newEntry];
     
     await sb.from(TABLE_NAME).update({ challengers: updatedList }).eq('id', challengeId);
  }
};
