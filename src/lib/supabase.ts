/**
 * Supabase client for the Pyvex Voice browser app.
 *
 * The URL and anon key are public by design: they identify the project and
 * carry no privilege of their own. Access is enforced by the row-level
 * security policies in `supabase/migrations/`, not by hiding these values. The
 * service-role key is a secret and never appears in this bundle.
 *
 * When the project is not configured the client is null rather than a stub
 * pointed at a placeholder URL, so callers fail with a clear error instead of
 * issuing requests that cannot succeed.
 */
import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The OAuth redirect returns the session in the URL fragment.
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * The account as this application uses it.
 *
 * Kept separate from the provider's own user shape so components depend on
 * these four fields rather than on Supabase's metadata layout.
 */
export interface AppUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export function toAppUser(user: User | null | undefined): AppUser | null {
  if (!user) return null;
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const asText = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value : null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: asText(metadata.full_name) ?? asText(metadata.name),
    avatarUrl: asText(metadata.avatar_url) ?? asText(metadata.picture),
  };
}

export type { Session };

/**
 * Turn a PostgREST failure into a message naming the operation and table.
 *
 * Always throws, so a caller can use it as the whole body of a `catch`.
 */
export function handleDatabaseError(error: unknown, operation: string, table: string): never {
  const code = (error as { code?: string })?.code;
  const detail = (error as { message?: string })?.message ?? String(error);

  // 42501 is insufficient_privilege: the row-level security policy refused.
  if (code === '42501' || code === 'PGRST301') {
    throw new Error(
      `Permission denied on ${operation} of "${table}". Check your sign-in state and the row-level security policies.`
    );
  }
  throw new Error(`Failed to ${operation} "${table}": ${detail}`);
}
