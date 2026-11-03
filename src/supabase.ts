// Supabase client for sign-in and cloud progress.
// The URL and publishable key are public by design (they ship to every browser);
// data is protected by row level security on the kb_progress table.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://eyaukfkckfyeyrelnnwr.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bfPrQKVAG-Uo-eJ3r_wjfQ_Xye7Kou6";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
    storageKey: "kettlebell-auth-v1",
  },
});

export const SHARE_URL = "https://kettlebell.bernardourbina.com/?invite=1";

// Where confirmation and magic-link emails send people back to.
export function redirectUrl(): string {
  const host = window.location.hostname;
  if (host === "kettlebell.bernardourbina.com") return SHARE_URL;
  return window.location.origin + window.location.pathname + "?invite=1";
}
