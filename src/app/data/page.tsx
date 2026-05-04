import { DataPageClient } from "@/app/data/data-page-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

function supabaseHostHint(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

export default async function DataPage() {
  const serverHasSupabaseEnv = isSupabaseConfigured();
  const serverSupabaseHost = serverHasSupabaseEnv ? supabaseHostHint() : null;

  let initialSessionEmail: string | null = null;

  if (serverHasSupabaseEnv) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      initialSessionEmail = user?.email ?? null;
    } catch {
      initialSessionEmail = null;
    }
  }

  return (
    <DataPageClient
      initialSessionEmail={initialSessionEmail}
      serverHasSupabaseEnv={serverHasSupabaseEnv}
      serverSupabaseHost={serverSupabaseHost}
    />
  );
}
