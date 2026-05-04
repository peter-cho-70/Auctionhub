"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const configured = useMemo(() => isSupabaseConfigured(), []);

  const urlError = searchParams.get("error");
  const errorHint =
    urlError === "config"
      ? "Supabase 설정을 확인하세요."
      : urlError === "auth"
        ? "인증에 실패했습니다. 다시 시도하세요."
        : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!configured) {
      setMsg("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 설정되지 않았습니다.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("로그인 링크를 이메일로 보냈습니다. 메일함을 확인하세요.");
      setEmail("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">로그인</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          이메일로 매직 링크를 보냅니다. Supabase 대시보드에서 이메일 인증·
          Redirect URL을 설정해야 합니다.
        </p>
      </div>

      {!configured && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          로컬에서는 <code className="rounded bg-white/60 px-1 dark:bg-black/30">.env.local</code>
          에 Supabase URL과 anon 키를 넣으세요.
        </p>
      )}

      {errorHint && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          {errorHint}
        </p>
      )}

      {msg && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          {msg}
        </p>
      )}

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
        <label className="block text-sm font-medium">
          이메일
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {loading ? "보내는 중…" : "매직 링크 보내기"}
        </button>
      </form>

      <p className="text-center text-sm">
        <Link href="/dashboard" className="text-neutral-600 underline dark:text-neutral-400">
          대시보드로 돌아가기
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center text-sm text-neutral-500">
          로딩 중…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
