"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import {
  MAX_AUCTION_SALE_COMPARABLES,
  MAX_PDF_COMPARABLES_PER_BATCH,
} from "@/lib/domain/auction-bid-analysis";
import { applyStorageReclaim } from "@/lib/data/compact-storage";
import { auctionPdfExtractToComparable } from "@/lib/pdf/pdf-to-comparable";
import type { AuctionPdfExtract } from "@/lib/pdf/auction-pdf-parser";
import { useAppStore } from "@/store/app-store";

type Props = {
  caseId: string;
  defaultDong?: string;
  onImported?: (totalCount: number) => void;
};

export function AuctionComparablePdfImport({
  caseId,
  defaultDong = "",
  onImported,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localLog, setLocalLog] = useState("");
  const appendAuctionSaleComparables = useAppStore(
    (s) => s.appendAuctionSaleComparables,
  );

  const { comparableCount, storeLog, busy, warnings } = useAppStore(
    useShallow((s) => ({
      comparableCount:
        s.data.cases.find((c) => c.id === caseId)?.auctionSaleComparables
          ?.length ?? 0,
      storeLog: s.bidPdfImportLog,
      busy: s.bidPdfImportBusy,
      warnings: s.bidPdfImportWarnings,
    })),
  );

  const displayLog =
    localLog.trim() ||
    storeLog.trim() ||
    "PDF를 선택하면 여기에 진행 상황이 표시됩니다.";

  const slotsLeft = MAX_AUCTION_SALE_COMPARABLES - comparableCount;
  const disabled = busy || slotsLeft <= 0;

  useEffect(() => {
    setLocalLog("");
    useAppStore.setState({ bidPdfImportBusy: false });
  }, [caseId]);

  const runImport = async (picked: File[]) => {
    const files = picked.slice(0, MAX_PDF_COMPARABLES_PER_BATCH);
    if (files.length === 0) {
      setLocalLog("파일이 비어 있습니다.");
      return;
    }

    useAppStore.setState({ bidPdfImportBusy: true });
    setLocalLog(`「${files[0]!.name}」 처리 중…`);

    const added: ReturnType<typeof auctionPdfExtractToComparable>["comparable"][] =
      [];
    const warnList: string[] = [];

    try {
      if (typeof appendAuctionSaleComparables !== "function") {
        setLocalLog("앱을 새로고침(Cmd+Shift+R) 후 다시 시도하세요.");
        return;
      }

      if (!useAppStore.getState().data.cases.some((c) => c.id === caseId)) {
        setLocalLog(`물건 ID(${caseId})를 찾을 수 없습니다.`);
        return;
      }

      for (const file of files) {
        const len =
          useAppStore.getState().data.cases.find((c) => c.id === caseId)
            ?.auctionSaleComparables?.length ?? 0;
        if (len >= MAX_AUCTION_SALE_COMPARABLES) {
          warnList.push(`${file.name}: 상한 ${MAX_AUCTION_SALE_COMPARABLES}건`);
          break;
        }

        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/pdf-to-case", { method: "POST", body: fd });
        const json = (await res.json()) as
          | {
              ok: true;
              extracted: AuctionPdfExtract;
              rawText?: string;
              warnings?: string[];
            }
          | { ok: false; error: string };

        if (!res.ok || !json.ok) {
          const err = !json.ok ? json.error : `HTTP ${res.status}`;
          warnList.push(`${file.name}: ${err}`);
          continue;
        }

        const mapped = auctionPdfExtractToComparable({
          extracted: json.extracted,
          sourceUrl: `pdf-import:${file.name}`,
          rawText: json.rawText ?? "",
          defaultDong,
        });
        for (const w of json.warnings ?? []) warnList.push(`${file.name}: ${w}`);
        for (const w of mapped.warnings) warnList.push(`${file.name}: ${w}`);
        added.push(mapped.comparable);
      }

      useAppStore.setState({ bidPdfImportWarnings: warnList });

      if (added.length === 0) {
        setLocalLog(
          warnList[0] ?? "추가된 사례 없음. PDF가 물건정보(옥션원) 형식인지 확인하세요.",
        );
        return;
      }

      const storedTotal = appendAuctionSaleComparables(caseId, added);

      if (storedTotal < 0) {
        setLocalLog(`파싱 ${added.length}건 — 저장 실패(물건 없음).`);
      } else {
        setLocalLog(`완료: 매각 사례 ${storedTotal}건 (방금 ${added.length}건 추가)`);
        useAppStore.getState().setBidPdfImportLog(
          `PDF ${added.length}건 추가 · 총 ${storedTotal}건`,
        );
      }

      onImported?.(storedTotal >= 0 ? storedTotal : added.length);
    } catch (e) {
      setLocalLog(`오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      useAppStore.setState({ bidPdfImportBusy: false });
    }
  };

  const handleFiles = (picked: File[]) => {
    if (picked.length === 0) return;
    flushSync(() =>
      setLocalLog(
        `선택됨: ${picked[0]!.name} (${picked.length}개) — 처리 시작`,
      ),
    );
    void runImport(picked);
  };

  const reclaimStorage = () => {
    const result = applyStorageReclaim(useAppStore.getState().data);
    useAppStore.setState({ data: result.data });
    setLocalLog(
      result.ok
        ? `${result.message} PDF를 다시 선택해 보세요.`
        : result.message,
    );
  };

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80 p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
        PDF로 매각완료 사례 추가
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        한 번에 최대 {MAX_PDF_COMPARABLES_PER_BATCH}개 · 이 물건{" "}
        {comparableCount}/{MAX_AUCTION_SALE_COMPARABLES}건
        {slotsLeft <= 0 ? " (상한 도달)" : ""}
      </p>

      <div
        className="mt-3 min-h-[3rem] rounded-lg border-2 border-sky-200 bg-white px-3 py-2 text-sm dark:border-sky-800 dark:bg-neutral-950"
        aria-live="assertive"
        role="status"
      >
        <p className="whitespace-pre-wrap font-medium text-neutral-900 dark:text-neutral-100">
          {displayLog}
        </p>
      </div>

      {disabled && slotsLeft <= 0 && (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
          사례가 {MAX_AUCTION_SALE_COMPARABLES}건에 도달했습니다. 표에서 삭제 후 PDF를
          추가하세요.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <label
          className={`inline-flex cursor-pointer items-center rounded-lg border px-4 py-2.5 text-sm font-medium ${
            disabled
              ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
              : "border-sky-400 bg-sky-100 text-sky-950 hover:bg-sky-200 dark:border-sky-700 dark:bg-sky-900 dark:text-sky-100"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="absolute h-0 w-0 overflow-hidden opacity-0"
            disabled={disabled}
            onChange={(e) => {
              const input = e.target;
              const list = input.files;
              if (!list?.length) return;
              const picked = Array.from(list);
              handleFiles(picked);
              queueMicrotask(() => {
                input.value = "";
              });
            }}
          />
          {busy ? "처리 중…" : "PDF 파일 선택"}
        </label>

        <button
          type="button"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          onClick={reclaimStorage}
        >
          저장 공간 정리
        </button>
      </div>

      {warnings.length > 0 && (
        <ul className="mt-2 max-h-36 list-disc space-y-0.5 overflow-auto pl-4 text-xs text-amber-800 dark:text-amber-200">
          {warnings.map((w, i) => (
            <li key={`${i}-${w}`}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
