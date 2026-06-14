"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { useAppStore } from "@/store/app-store";
import { formatWonDigits, parseWonInput } from "@/lib/format/won";
import {
  filterAreaSqmInputRaw,
  parseAreaSqmInputToNumber,
} from "@/lib/format/area-input";
import { listTitleFromStructuredJson } from "@/lib/domain/case-document-facts";
import { registerSourcePdfUpload } from "@/lib/pdf/register-source-pdf-upload";
import type { CaseSourceDocumentKind } from "@/lib/types/domain";

const AUCTION_PDF_KIND_OPTIONS: {
  value: CaseSourceDocumentKind;
  label: string;
}[] = [
  { value: "daejangauction-pdf", label: "대장옥션 경매 PDF (기본)" },
  { value: "speedauction-pdf", label: "스피드옥션 경매 PDF" },
];

type ApiOk = {
  ok: true;
  kind?: CaseSourceDocumentKind;
  meta: { fileName: string; fileSize: number; pageCount: number | null };
  extracted: { caseNumber?: string | null; sourceUrl?: string | null };
  newCaseInput: {
    sourceUrl: string;
    caseNumber?: string;
    address?: string;
    propertyType?: string;
    builtYear?: string;
    appraisalPrice?: number | null;
    minPrice?: number | null;
    bidDate?: string | null;
    landAreaSqm?: number | null;
    buildingAreaSqm?: number | null;
    parkingUnitCount?: number | null;
    memo?: string;
    listTitle?: string;
  };
  warnings: string[];
  rawText: string;
  structuredJson: unknown;
};

type ApiErr = { ok: false; error: string };

type CaseDraft = ApiOk["newCaseInput"] & {
  pdfKind: CaseSourceDocumentKind;
  meta: ApiOk["meta"] | null;
  rawText: string;
  structuredJson: unknown | null;
  extractedCaseNumber?: string | null;
};

export default function ImportPdfCasePage() {
  const router = useRouter();
  const addCase = useAppStore((s) => s.addCase);
  const updateCase = useAppStore((s) => s.updateCase);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [structuredJson, setStructuredJson] = useState<unknown | null>(null);
  const [meta, setMeta] = useState<ApiOk["meta"] | null>(null);
  const pdfFileRef = useRef<File | null>(null);
  const extractedCaseNumberRef = useRef<string | null>(null);

  // Draft fields
  const [url, setUrl] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [appraisalPrice, setAppraisalPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [bidDate, setBidDate] = useState("");
  const [landAreaSqm, setLandAreaSqm] = useState("");
  const [buildingAreaSqm, setBuildingAreaSqm] = useState("");
  const [parkingUnitCount, setParkingUnitCount] = useState("");
  const [memo, setMemo] = useState("");
  const [pdfKind, setPdfKind] =
    useState<CaseSourceDocumentKind>("daejangauction-pdf");
  const autoCreateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creatingRef = useRef(false);

  const createCaseFromDraft = useCallback(
    async (draft: CaseDraft) => {
      if (creatingRef.current) return;
      const sourceUrl =
        draft.sourceUrl.trim() ||
        `pdf-import:${draft.meta?.fileName ?? "upload.pdf"}`;
      creatingRef.current = true;
      const listTitle =
        draft.listTitle?.trim() ||
        listTitleFromStructuredJson(draft.structuredJson) ||
        undefined;
      const c = addCase({
        sourceUrl,
        caseNumber: draft.caseNumber?.trim() || undefined,
        address: draft.address?.trim() || undefined,
        propertyType: draft.propertyType?.trim() || undefined,
        builtYear: draft.builtYear?.trim() || undefined,
        appraisalPrice: draft.appraisalPrice ?? null,
        minPrice: draft.minPrice ?? null,
        bidDate: draft.bidDate ?? null,
        landAreaSqm: draft.landAreaSqm ?? null,
        buildingAreaSqm: draft.buildingAreaSqm ?? null,
        parkingUnitCount: draft.parkingUnitCount ?? null,
        memo: draft.memo?.trim() || undefined,
        listTitle,
        sourceDocuments: [],
      });

      if (pdfFileRef.current && draft.meta && draft.rawText) {
        try {
          const document = await registerSourcePdfUpload({
            caseId: c.id,
            caseNumber: draft.caseNumber,
            extractedCaseNumber:
              draft.extractedCaseNumber ??
              extractedCaseNumberRef.current ??
              null,
            kind: draft.pdfKind,
            file: pdfFileRef.current,
            meta: draft.meta,
            rawText: draft.rawText,
            structuredJson: draft.structuredJson,
          });
          updateCase(c.id, { sourceDocuments: [document] });
        } catch (err) {
          console.warn("원본 PDF 저장 실패:", err);
        }
      }

      router.push(`/cases/${c.id}`);
    },
    [addCase, router, updateCase],
  );

  const onFile = async (f: File) => {
    setBusy(true);
    setMsg(null);
    setWarnings([]);
    setRawText("");
    setStructuredJson(null);
    setMeta(null);
    pdfFileRef.current = f;
    try {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("kind", pdfKind);
      const r = await fetch("/api/pdf-to-case", { method: "POST", body: fd });
      const json = (await r.json()) as ApiOk | ApiErr;
      if (!json.ok) {
        setMsg(json.error || "실패했습니다.");
        return;
      }

      setMeta(json.meta);
      setWarnings(json.warnings ?? []);
      setRawText(json.rawText ?? "");
      setStructuredJson(json.structuredJson ?? null);
      const nc = json.newCaseInput;
      extractedCaseNumberRef.current = json.extracted?.caseNumber ?? null;

      setUrl(
        nc.sourceUrl ??
          json.extracted?.sourceUrl ??
          `pdf-import:${f.name}`,
      );
      setCaseNumber(nc.caseNumber ?? "");
      setAddress(nc.address ?? "");
      setPropertyType(nc.propertyType ?? "");
      setBuiltYear(nc.builtYear ?? "");
      setAppraisalPrice(
        nc.appraisalPrice != null ? formatWonDigits(nc.appraisalPrice) : "",
      );
      setMinPrice(nc.minPrice != null ? formatWonDigits(nc.minPrice) : "");
      setBidDate(nc.bidDate ?? "");
      setLandAreaSqm(nc.landAreaSqm != null ? String(nc.landAreaSqm) : "");
      setBuildingAreaSqm(
        nc.buildingAreaSqm != null ? String(nc.buildingAreaSqm) : "",
      );
      setParkingUnitCount(
        nc.parkingUnitCount != null ? String(nc.parkingUnitCount) : "",
      );
      setMemo(nc.memo ?? "");
      setMsg("추출 완료. 1초 후 자동으로 물건을 등록합니다.");
      if (autoCreateTimerRef.current) {
        clearTimeout(autoCreateTimerRef.current);
        autoCreateTimerRef.current = null;
      }
      autoCreateTimerRef.current = setTimeout(() => {
        autoCreateTimerRef.current = null;
        void createCaseFromDraft({
          ...nc,
          pdfKind: json.kind ?? pdfKind,
          sourceUrl:
            nc.sourceUrl ??
            json.extracted?.sourceUrl ??
            `pdf-import:${f.name}`,
          meta: json.meta,
          rawText: json.rawText ?? "",
          structuredJson: json.structuredJson ?? null,
          extractedCaseNumber: json.extracted?.caseNumber ?? null,
        });
      }, 1000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = useMemo(() => url.trim().length > 0, [url]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoCreateTimerRef.current) {
      clearTimeout(autoCreateTimerRef.current);
      autoCreateTimerRef.current = null;
    }
    if (!url.trim()) {
      setMsg("sourceUrl(URL)을 입력하세요.");
      return;
    }

    const pkRaw = parkingUnitCount.trim().replace(/\D/g, "");
    const pkParsed = pkRaw === "" ? null : parseInt(pkRaw, 10);
    const parkingUnitCountVal =
      pkParsed != null && Number.isFinite(pkParsed) && pkParsed >= 0
        ? Math.min(99999, pkParsed)
        : null;

    void createCaseFromDraft({
      sourceUrl: url.trim(),
      pdfKind,
      caseNumber,
      address,
      propertyType,
      builtYear,
      appraisalPrice: parseWonInput(appraisalPrice),
      minPrice: parseWonInput(minPrice),
      bidDate: bidDate || null,
      landAreaSqm: parseAreaSqmInputToNumber(landAreaSqm),
      buildingAreaSqm: parseAreaSqmInputToNumber(buildingAreaSqm),
      parkingUnitCount: parkingUnitCountVal,
      memo,
      meta,
      rawText,
      structuredJson,
      extractedCaseNumber: extractedCaseNumberRef.current,
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          PDF로 물건 추가
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          경매 PDF를 업로드하면 텍스트를 추출해 필드를 채웁니다. 기본은
          대장옥션 형식이며, 스피드옥션 PDF는 아래에서 선택하세요.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <label className="text-sm font-medium">경매 PDF 출처</label>
        <select
          value={pdfKind}
          onChange={(e) =>
            setPdfKind(e.target.value as CaseSourceDocumentKind)
          }
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          disabled={busy}
        >
          {AUCTION_PDF_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950">
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onFile(f);
            }}
          />
          <span className="font-medium">PDF 업로드</span>
          <span className="text-xs text-neutral-500">
            {busy ? "처리 중…" : "파일 선택"}
          </span>
        </label>

        {meta && (
          <p className="mt-2 text-xs text-neutral-500">
            파일: <span className="font-mono">{meta.fileName}</span> ·{" "}
            {(meta.fileSize / 1024 / 1024).toFixed(2)}MB · 페이지{" "}
            {meta.pageCount ?? "?"}
          </p>
        )}

        {msg && (
          <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
            {msg}
          </p>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">추출 경고</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {warnings.map((w, i) => (
                <li key={`${i}-${w}`}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <form onSubmit={submit} className="space-y-4">
        <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-sm font-medium">미리보기 / 수정</h2>

          <div className="mt-3 space-y-3">
            <div>
              <label className="text-sm font-medium">sourceUrl *</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="가능하면 경매 상세 URL을 입력하세요"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">사건번호</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">주소</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">물건 유형</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  placeholder="다가구 / 아파트 등"
                />
              </div>
              <div>
                <label className="text-sm font-medium">준공/사용승인</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={builtYear}
                  onChange={(e) => setBuiltYear(e.target.value)}
                  placeholder="예: 2021 또는 2021-07-26"
                />
              </div>
              <div>
                <label className="text-sm font-medium">감정가 (원)</label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={appraisalPrice}
                  onChange={(e) => {
                    const n = parseWonInput(e.target.value);
                    setAppraisalPrice(n != null ? formatWonDigits(n) : "");
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">최저가 (원)</label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={minPrice}
                  onChange={(e) => {
                    const n = parseWonInput(e.target.value);
                    setMinPrice(n != null ? formatWonDigits(n) : "");
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">입찰일</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={bidDate}
                  onChange={(e) => setBidDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">토지면적 (㎡)</label>
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={landAreaSqm}
                  onChange={(e) =>
                    setLandAreaSqm(filterAreaSqmInputRaw(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">건물면적 (㎡)</label>
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={buildingAreaSqm}
                  onChange={(e) =>
                    setBuildingAreaSqm(filterAreaSqmInputRaw(e.target.value))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">주차 대수</label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={parkingUnitCount}
                  onChange={(e) =>
                    setParkingUnitCount(e.target.value.replace(/\D/g, ""))
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium">메모</label>
                <AutoGrowTextarea
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxViewportFraction={0.7}
                />
              </div>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          저장하고 상세로 이동
        </button>
      </form>

      <details className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="cursor-pointer text-sm font-medium">
          원문 텍스트(추출) 보기
        </summary>
        <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
          {rawText.trim() || "(텍스트가 비어있습니다)"}
        </pre>
      </details>

      <details className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <summary className="cursor-pointer text-sm font-medium">
          구조화 JSON 보기
        </summary>
        <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-100 p-3 text-xs text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
          {structuredJson
            ? JSON.stringify(structuredJson, null, 2)
            : "(구조화 JSON이 없습니다)"}
        </pre>
      </details>
    </div>
  );
}
