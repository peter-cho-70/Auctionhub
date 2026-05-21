"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseAddressMeta } from "@/lib/types/domain";
import {
  caseAddressMetaFromJuso,
  displayAddressFromJuso,
  type JusoApiRow,
} from "@/lib/address/normalize";
import { eumDetailUrl } from "@/lib/address/pnu";

type Props = {
  address: string;
  addressMeta: CaseAddressMeta | null;
  onAddressChange: (address: string) => void;
  onAddressMetaChange: (meta: CaseAddressMeta | null) => void;
  inputClassName?: string;
  disabled?: boolean;
};

/** 표준 주소 검색 칸에 넣을 기본 키워드 */
function suggestSearchQuery(
  address: string,
  addressMeta: CaseAddressMeta | null,
): string {
  return (
    addressMeta?.roadAddress?.trim() ||
    addressMeta?.jibunAddress?.trim() ||
    address.trim()
  );
}

export function AddressSearchField({
  address,
  addressMeta,
  onAddressChange,
  onAddressMetaChange,
  inputClassName = "",
  disabled = false,
}: Props) {
  const [query, setQuery] = useState(() =>
    suggestSearchQuery(address, addressMeta),
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<JusoApiRow[]>([]);
  const [landUseLabels, setLandUseLabels] = useState<string[]>([]);
  const [landUseBusy, setLandUseBusy] = useState(false);
  const [landUseErr, setLandUseErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryEditedRef = useRef(false);

  useEffect(() => {
    if (queryEditedRef.current) return;
    const next = suggestSearchQuery(address, addressMeta);
    if (next) setQuery(next);
  }, [address, addressMeta?.roadAddress, addressMeta?.jibunAddress]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const search = useCallback(async (keyword: string) => {
    const q = keyword.trim();
    if (q.length < 2) {
      setError("2글자 이상 입력하세요.");
      setItems([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/address/search?keyword=${encodeURIComponent(q)}&count=10`,
      );
      const json = (await res.json()) as
        | { ok: true; items: JusoApiRow[] }
        | { ok: false; error: string };
      if (!json.ok) {
        setError(json.error || "주소 검색에 실패했습니다.");
        setItems([]);
        return;
      }
      setItems(json.items);
      setOpen(true);
      if (json.items.length === 0) setError("검색 결과가 없습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "주소 검색에 실패했습니다.");
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, []);

  const selectRow = (row: JusoApiRow) => {
    const meta = caseAddressMetaFromJuso(row);
    const display = displayAddressFromJuso(row);
    onAddressChange(display);
    onAddressMetaChange(meta);
    queryEditedRef.current = false;
    setQuery(
      meta.roadAddress?.trim() || meta.jibunAddress?.trim() || display,
    );
    setOpen(false);
    setItems([]);
    setError(null);
  };

  const searchWithCurrentAddress = useCallback(() => {
    const next = suggestSearchQuery(address, addressMeta);
    if (!next.trim()) {
      setError("소재지 주소를 먼저 입력하세요.");
      return;
    }
    queryEditedRef.current = false;
    setQuery(next);
    void search(next);
  }, [address, addressMeta, search]);

  const clearMeta = () => {
    onAddressMetaChange(null);
    setLandUseLabels([]);
    setLandUseErr(null);
    queryEditedRef.current = false;
    const next = address.trim();
    if (next) setQuery(next);
  };

  const fetchLandUse = async (pnu: string) => {
    setLandUseBusy(true);
    setLandUseErr(null);
    try {
      const res = await fetch(
        `/api/land/use-regulation?pnu=${encodeURIComponent(pnu)}`,
      );
      const json = (await res.json()) as
        | { ok: true; landUses: string[] }
        | { ok: false; error: string };
      if (!json.ok) {
        setLandUseErr(json.error || "토지이용규제 조회 실패");
        setLandUseLabels([]);
        return;
      }
      setLandUseLabels(json.landUses);
      if (json.landUses.length === 0) {
        setLandUseErr("용도지역 정보가 없거나 API 키·PNU를 확인하세요.");
      }
    } catch (e) {
      setLandUseErr(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLandUseBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          className={inputClassName}
          value={address}
          onChange={(e) => {
            onAddressChange(e.target.value);
            if (addressMeta) onAddressMetaChange(null);
          }}
          placeholder="소재지 (직접 입력 또는 아래 검색)"
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[min(100%,280px)] flex-1 text-xs font-medium text-neutral-500">
          표준 주소 검색 (행안부)
          <div className="mt-1 flex gap-1">
            <input
              className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={query}
              onChange={(e) => {
                queryEditedRef.current = true;
                setQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search(query);
                }
              }}
              placeholder="도로명·지번·건물명 (소재지에서 자동 채움)"
              disabled={disabled}
            />
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void search(query)}
              className="shrink-0 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-neutral-200 dark:text-neutral-900"
            >
              {busy ? "검색…" : "검색"}
            </button>
          </div>
        </label>
        <button
          type="button"
          disabled={disabled || busy || !address.trim()}
          onClick={() => searchWithCurrentAddress()}
          className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          현재 주소로 검색
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}

      {open && items.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 bg-white text-sm shadow-md dark:border-neutral-700 dark:bg-neutral-950">
          {items.map((row, i) => (
            <li key={`${row.admCd ?? ""}-${row.roadAddr ?? ""}-${i}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
                onClick={() => selectRow(row)}
              >
                <span className="block font-medium text-neutral-900 dark:text-neutral-100">
                  {row.roadAddr || row.jibunAddr}
                </span>
                {row.jibunAddr && row.roadAddr && row.jibunAddr !== row.roadAddr ? (
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    지번 {row.jibunAddr}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {addressMeta?.resolvedAt && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p className="font-medium">표준 주소 확인됨</p>
          <p className="mt-1 opacity-90">
            {addressMeta.emdNm && `${addressMeta.sggNm ?? ""} ${addressMeta.emdNm}`}
            {addressMeta.legalDongCode
              ? ` · 법정동 ${addressMeta.legalDongCode}`
              : ""}
            {addressMeta.molitLawdCode
              ? ` · 실거래구역 ${addressMeta.molitLawdCode}`
              : ""}
            {addressMeta.pnu ? ` · PNU ${addressMeta.pnu}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {addressMeta.pnu ? (
              <>
                <a
                  href={eumDetailUrl(addressMeta.pnu)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  토지이음 도시계획
                </a>
                <button
                  type="button"
                  disabled={landUseBusy}
                  onClick={() => void fetchLandUse(addressMeta.pnu!)}
                  className="font-medium underline underline-offset-2 disabled:opacity-50"
                >
                  {landUseBusy ? "용도 조회…" : "용도지역 API"}
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={clearMeta}
              className="text-emerald-800/80 hover:underline dark:text-emerald-200/90"
            >
              표준주소 해제
            </button>
          </div>
          {landUseErr ? (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
              {landUseErr}
            </p>
          ) : null}
          {landUseLabels.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] opacity-90">
              {landUseLabels.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
