import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabaseConfig } from "./supabase-config.js";

export const SUPABASE_BUCKET = "evidence";
export const supabaseConfigured =
  /^https:\/\/[^\s]+\.supabase\.co$/.test(supabaseConfig.url) &&
  supabaseConfig.publishableKey &&
  !supabaseConfig.url.includes("TU-PROYECTO") &&
  !supabaseConfig.publishableKey.includes("TU_SUPABASE");

export const supabase = supabaseConfigured
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export function assertSupabaseConfigured() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase Storage todavía no está configurado. Completa js/supabase-config.js con tu Project URL y Publishable key.");
  }
}
