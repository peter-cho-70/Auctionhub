"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  loadAppStateAction,
  saveAppStateAction,
} from "@/app/actions/app-state";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { STANDARD_TEMPLATE_KEYS } from "@/lib/domain/template-vars";
import { safeParseAppDataJson } from "@/lib/data/migrate";
import {
  appDataCaseCount,
  listLocalDataSnapshots,
  saveLocalDataSnapshot,
} from "@/lib/data/client-backup";
import { FIELD_INTEL_GUIDES } from "@/lib/domain/field-intel";
import { useAppStore } from "@/store/app-store";

function snapshotCasePreview(json: string) {
  const parsed = safeParseAppDataJson(json);
  if (parsed instanceof Error) return [];
  return parsed.cases.slice(0, 5).map((c) => ({
    id: c.id,
    title: [c.caseNumber, c.address].filter(Boolean).join(" · ") || "제목 없는 물건",
    status: c.status,
    updatedAt: c.updatedAt,
  }));
}

export function DataPageClient({
  initialSessionEmail,
  serverHasSupabaseEnv,
  serverSupabaseHost,
}: {
  initialSessionEmail: string | null;
  serverHasSupabaseEnv: boolean;
  serverSupabaseHost: string | null;
}) {
  const router = useRouter();
  const clientHasSupabaseEnv = isSupabaseConfigured();
  const exportDataJson = useAppStore((s) => s.exportDataJson);
  const importData = useAppStore((s) => s.importData);
  const resetToDefaults = useAppStore((s) => s.resetToDefaults);
  const addKnowledgeNote = useAppStore((s) => s.addKnowledgeNote);
  const notes = useAppStore((s) => s.data.knowledgeNotes);
  const cases = useAppStore((s) => s.data.cases);
  const removeKnowledgeNote = useAppStore((s) => s.removeKnowledgeNote);

  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(
    initialSessionEmail,
  );
  const [cloudBusy, setCloudBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<
    ReturnType<typeof listLocalDataSnapshots>
  >([]);

  const refreshSnapshots = () => {
    setSnapshots(listLocalDataSnapshots());
  };

  useEffect(() => {
    if (!clientHasSupabaseEnv) return;

    const supabase = createClient();

    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user?.email) {
          setSessionEmail(data.user.email);
        }
      } catch {
        /* keep initialSessionEmail */
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionEmail(session?.user.email ?? null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [clientHasSupabaseEnv, router]);

  useEffect(() => {
    refreshSnapshots();
  }, []);

  const pullCloud = async () => {
    if (!clientHasSupabaseEnv) return;
    setCloudBusy(true);
    setMsg(null);
    try {
      const r = await loadAppStateAction();
      if (r.error) {
        setMsg(r.error);
        return;
      }
      if (!r.json) {
        setMsg("클라우드에 저장된 데이터가 없습니다.");
        return;
      }
      if (
        !confirm(
          "클라우드 데이터를 이 기기 데이터와 병합합니다. 계속할까요?",
        )
      ) {
        return;
      }
      saveLocalDataSnapshot(exportDataJson(), "before-cloud-manual-merge");
      refreshSnapshots();
      importData(r.json, "merge");
      setMsg("클라우드 데이터를 병합했습니다. 기존 로컬 데이터는 스냅샷으로 보관했습니다.");
    } finally {
      setCloudBusy(false);
    }
  };

  const pushCloud = async () => {
    if (!clientHasSupabaseEnv) return;
    setCloudBusy(true);
    setMsg(null);
    try {
      const json = exportDataJson();
      if (
        appDataCaseCount(json) === 0 &&
        !confirm("현재 물건 목록이 비어 있습니다. 빈 데이터를 클라우드에 저장할까요?")
      ) {
        return;
      }
      const { error } = await saveAppStateAction(json);
      if (error) {
        setMsg(error);
        return;
      }
      setMsg("클라우드에 저장했습니다.");
    } finally {
      setCloudBusy(false);
    }
  };

  const signOut = async () => {
    if (!clientHasSupabaseEnv) return;
    setCloudBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setSessionEmail(null);
      router.push("/login");
      router.refresh();
    } finally {
      setCloudBusy(false);
    }
  };

  const download = () => {
    const json = exportDataJson();
    saveLocalDataSnapshot(json, "manual-json-export");
    refreshSnapshots();
    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auctionflow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("파일을 내려받았습니다.");
  };

  const downloadSnapshot = (snapshot: (typeof snapshots)[number]) => {
    const blob = new Blob([snapshot.json], {
      type: "application/json;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auctionflow-snapshot-${snapshot.createdAt.slice(0, 10)}-${snapshot.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("스냅샷 파일을 내려받았습니다.");
  };

  const saveSnapshotNow = () => {
    const json = exportDataJson();
    if (appDataCaseCount(json) === 0) {
      setMsg("저장할 물건이 없습니다.");
      return;
    }
    saveLocalDataSnapshot(json, "manual-snapshot");
    refreshSnapshots();
    setMsg("로컬 스냅샷을 저장했습니다. (최대 2개 유지)");
  };

  const restoreSnapshot = (snapshot: (typeof snapshots)[number]) => {
    if (!confirm(`스냅샷(${snapshot.caseCount}개 물건)으로 현재 데이터를 교체할까요?`)) {
      return;
    }
    saveLocalDataSnapshot(exportDataJson(), "before-snapshot-restore");
    importData(snapshot.json, "replace");
    refreshSnapshots();
    setMsg("스냅샷으로 복원했습니다.");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const text = await f.text();
    const parsed = safeParseAppDataJson(text);
    if (parsed instanceof Error) {
      setMsg(parsed.message);
      return;
    }
    const mode = confirm(
      "확인=덮어쓰기(전체 교체), 취소=병합(같은 ID 제외 추가)",
    )
      ? "replace"
      : "merge";
    saveLocalDataSnapshot(exportDataJson(), `before-json-import-${mode}`);
    refreshSnapshots();
    importData(text, mode);
    setMsg(mode === "replace" ? "데이터를 교체했습니다." : "데이터를 병합했습니다.");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">데이터</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          브라우저{" "}
          <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">
            localStorage
          </code>
          에도 자동 저장됩니다. 로그인하면 Supabase에 동기화되며, 변경 후 약
          2초 뒤 자동 업로드됩니다. 백업·이전은 JSON 파일로도 할 수 있습니다.
        </p>
      </div>

      {clientHasSupabaseEnv && (
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/40">
          <h2 className="font-medium text-sky-950 dark:text-sky-100">
            Supabase 클라우드
          </h2>
          {sessionEmail ? (
            <p className="mt-2 text-sky-900 dark:text-sky-200">
              로그인: <span className="font-mono">{sessionEmail}</span>
            </p>
          ) : (
            <p className="mt-2 text-sky-900 dark:text-sky-200">
              로그인하면 여러 기기에서 같은 데이터를 쓸 수 있습니다.{" "}
              <Link
                href="/login"
                className="font-medium underline underline-offset-2"
              >
                계정으로 이동
              </Link>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={cloudBusy || !sessionEmail}
              onClick={() => void pullCloud()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
            >
              클라우드에서 불러오기
            </button>
            <button
              type="button"
              disabled={cloudBusy || !sessionEmail}
              onClick={() => void pushCloud()}
              className="rounded-lg bg-sky-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-sky-200 dark:text-sky-950"
            >
              지금 클라우드에 저장
            </button>
            {sessionEmail && (
              <button
                type="button"
                disabled={cloudBusy}
                onClick={() => void signOut()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-600"
              >
                로그아웃
              </button>
            )}
          </div>
        </section>
      )}

      {serverHasSupabaseEnv && !clientHasSupabaseEnv && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <p className="font-medium">Vercel에는 Supabase 값이 있는데, 이 페이지 빌드에는 아직 반영되지 않았습니다.</p>
          <p className="mt-2">
            <code className="rounded bg-white/70 px-1 dark:bg-black/30">NEXT_PUBLIC_*</code>{" "}
            변수는 <strong>빌드할 때</strong> 브라우저 번들에 들어갑니다. Vercel{" "}
            <strong>Settings → Environment Variables</strong>에서 두 값을 저장한 뒤,{" "}
            <strong>Deployments → Redeploy</strong>로 <strong>같은 커밋을 다시 빌드</strong>해야
            클라우드 UI가 켜집니다.
          </p>
          {serverSupabaseHost && (
            <p className="mt-2 text-xs opacity-90">
              서버가 읽은 프로젝트 호스트:{" "}
              <span className="font-mono">{serverSupabaseHost}</span>
            </p>
          )}
        </div>
      )}

      {!serverHasSupabaseEnv && !clientHasSupabaseEnv && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <p className="font-medium">Supabase 공개 환경 변수가 없습니다.</p>
          <p className="mt-2">
            이름은 정확히{" "}
            <code className="rounded bg-white/70 px-1 dark:bg-black/30">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            과{" "}
            <code className="rounded bg-white/70 px-1 dark:bg-black/30">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            (anon public 키)이어야 하며, Vercel에서는 <strong>Production</strong>에
            체크되어 있어야 합니다. 저장 후 반드시 <strong>재배포</strong>하세요.
          </p>
        </div>
      )}

      {msg && (
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          {msg}
        </p>
      )}

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-medium">로컬 자동 스냅샷</h2>
            <p className="mt-1 text-xs opacity-90">
              클라우드 병합, JSON 가져오기, 초기화·편집 후 등 최근 상태를
              최대 2개만 보관합니다. 용량이 부족하면 기존 스냅샷을 지우지 않고
              새 항목만 건너뜁니다. 편집 후 약 90초 뒤 자동 저장됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={saveSnapshotNow}
            className="shrink-0 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-medium text-white dark:bg-emerald-200 dark:text-emerald-950"
          >
            지금 스냅샷 저장
          </button>
        </div>
        {snapshots.length > 0 ? (
          <div className="mt-3 space-y-2">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {new Date(snapshot.createdAt).toLocaleString("ko-KR")} · 물건{" "}
                      {snapshot.caseCount}개
                    </p>
                    <p className="text-xs opacity-80">{snapshot.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadSnapshot(snapshot)}
                      className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs dark:border-emerald-800"
                    >
                      내려받기
                    </button>
                    <button
                      type="button"
                      onClick={() => restoreSnapshot(snapshot)}
                      className="rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-emerald-200 dark:text-emerald-950"
                    >
                      복원
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 border-t border-emerald-200/70 pt-2 text-xs dark:border-emerald-900">
                  {snapshotCasePreview(snapshot.json).map((caseItem) => (
                    <li
                      key={caseItem.id}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <span className="font-medium">{caseItem.title}</span>
                      <span className="opacity-75">
                        {caseItem.updatedAt
                          ? new Date(caseItem.updatedAt).toLocaleDateString("ko-KR")
                          : caseItem.status}
                      </span>
                    </li>
                  ))}
                  {snapshot.caseCount > 5 && (
                    <li className="opacity-75">외 {snapshot.caseCount - 5}개 물건</li>
                  )}
                  {snapshot.caseCount === 0 && (
                    <li className="opacity-75">물건이 없는 백업입니다.</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs opacity-80">
            저장된 스냅샷이 없습니다. 위 버튼으로 지금 상태를 백업할 수 있습니다.
          </p>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          JSON보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          JSON 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void onFile(e)}
        />
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "모든 물건·노트·템플릿 수정이 초기화됩니다. 계속할까요?",
              )
            ) {
              saveLocalDataSnapshot(exportDataJson(), "before-reset-to-defaults");
              refreshSnapshots();
              resetToDefaults();
              setMsg("초기 데이터로 초기화했습니다.");
            }
          }}
          className="rounded-lg border border-rose-300 px-4 py-2 text-sm text-rose-800 dark:border-rose-900 dark:text-rose-300"
        >
          초기화
        </button>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="font-medium">지식 노트</h2>
        <p className="mt-1 text-xs text-neutral-500">
          탐문·시장정보는{" "}
          <Link href="/field-intel" className="underline underline-offset-2">
            탐문 가이드
          </Link>
          와 연결할 수 있습니다.
        </p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const title = String(fd.get("title") ?? "").trim();
            const body = String(fd.get("body") ?? "").trim();
            const category = String(fd.get("category") ?? "general").trim();
            const linkedCaseId = String(fd.get("linkedCaseId") ?? "").trim();
            const fieldIntelGuideId = String(
              fd.get("fieldIntelGuideId") ?? "",
            ).trim();
            if (!title) return;
            addKnowledgeNote({
              category: category || "general",
              title,
              body,
              linkedCaseId: linkedCaseId || null,
              fieldIntelGuideId: fieldIntelGuideId || null,
            });
            e.currentTarget.reset();
            setMsg("노트를 추가했습니다.");
          }}
        >
          <input
            name="category"
            placeholder="카테고리 (탐문/대전, 권리분석…)"
            className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
          />
          <input
            name="title"
            required
            placeholder="제목"
            className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
          />
          <select
            name="fieldIntelGuideId"
            className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
            defaultValue=""
          >
            <option value="">탐문 가이드 (없음)</option>
            {FIELD_INTEL_GUIDES.map((guide) => (
              <option key={guide.id} value={guide.id}>
                {guide.title}
              </option>
            ))}
          </select>
          <select
            name="linkedCaseId"
            className="rounded border px-2 py-1 text-sm dark:bg-neutral-900"
            defaultValue=""
          >
            <option value="">연결 물건 (없음)</option>
            {cases.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.caseNumber, item.address].filter(Boolean).join(" · ") ||
                  item.id}
              </option>
            ))}
          </select>
          <textarea
            name="body"
            rows={3}
            placeholder="내용"
            className="sm:col-span-2 rounded border px-2 py-1 text-sm dark:bg-neutral-900"
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            노트 추가
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-2 rounded border border-neutral-100 p-2 dark:border-neutral-900"
            >
              <div>
                <div className="font-medium">{n.title}</div>
                <div className="text-xs text-neutral-500">{n.category}
                  {n.fieldIntelGuideId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/field-intel?guide=${n.fieldIntelGuideId}`}
                        className="underline"
                      >
                        탐문
                      </Link>
                    </>
                  ) : null}
                  {n.linkedCaseId ? (
                    <>
                      {" · "}
                      <Link href={`/cases/${n.linkedCaseId}`} className="underline">
                        물건
                      </Link>
                    </>
                  ) : null}
                </div>
                {n.body && (
                  <p className="mt-1 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                    {n.body}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-xs text-rose-600 hover:underline"
                onClick={() => removeKnowledgeNote(n.id)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-xs text-neutral-500">
        <h3 className="font-medium text-neutral-700 dark:text-neutral-300">
          문자 템플릿 표준 변수
        </h3>
        <p className="mt-2 leading-relaxed">
          {STANDARD_TEMPLATE_KEYS.map((k) => `{${k}}`).join(" · ")}
        </p>
      </section>
    </div>
  );
}
