import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mhytpyyqecnwrcqygqjp.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oeXRweXlxZWNud3JjcXlncWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4Mjg4MjYsImV4cCI6MjEwNTQwNDgyNn0.YXHIgDZ-h-sN1YzABcT13NN9zn_eJ76sE0GSC6P22n0";

let supabaseServerClient: SupabaseClient<Database> | null = null;

export function getSupabaseServerClient(): SupabaseClient<Database> {
  if (!supabaseServerClient) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("SUPABASE_CONFIG_ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or API key");
    }
    supabaseServerClient = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseServerClient;
}
