import { DataPageClient } from "@/app/data/data-page-client";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  let initialSessionEmail: string | null = null;

  if (isSupabaseConfigured()) {
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

  return <DataPageClient initialSessionEmail={initialSessionEmail} />;
}
