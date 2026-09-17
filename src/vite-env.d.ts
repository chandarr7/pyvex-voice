/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Public: it identifies the project, nothing more. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon key. Public by design; access is enforced by RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
