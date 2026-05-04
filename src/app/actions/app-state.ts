"use server";

import { createClient } from "@/lib/supabase/server";
import { parseAppDataJson } from "@/lib/data/migrate";

export async function loadAppStateAction(): Promise<{
  json: string | null;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { json: null, error: "로그인이 필요합니다." };
    }

    const { data, error } = await supabase
      .from("user_app_state")
      .select("payload")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return { json: null, error: error.message };
    }
    if (!data?.payload || typeof data.payload !== "object") {
      return { json: null };
    }

    const str = JSON.stringify(data.payload);
    try {
      parseAppDataJson(str);
    } catch {
      return { json: null };
    }
    return { json: str };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { json: null, error: msg };
  }
}

export async function saveAppStateAction(
  json: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: "로그인이 필요합니다." };
    }

    const payload = parseAppDataJson(json);

    const { error } = await supabase.from("user_app_state").upsert(
      {
        user_id: user.id,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return { error: error.message };
    }
    return {};
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}
