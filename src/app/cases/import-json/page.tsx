"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { useAppStore } from "@/store/app-store";
import { safeParseAppDataJson } from "@/lib/data/migrate";
import { parseLlmCaseJsonToNewCaseInput } from "@/lib/import/llm-case-json";
import { formatWonDigits, parseWonInput } from "@/lib/format/won";
import {
  filterAreaSqmInputRaw,
  parseAreaSqmInputToNumber,
} from "@/lib/format/area-input";

export default function ImportJsonCasePage() {
  const router = useRouter();
  const addCase = useAppStore((s) => s.addCase);
  const importData = useAppStore((s) => s.importData);

  const [jsonText, setJsonText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

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

  const parse = () => {
    setMsg(null);
    setWarnings([]);

    const appParsed = safeParseAppDataJson(jsonText);
    if (!(appParsed instanceof Error)) {
      const mode = confirm(
        "이 JSON은 전체 AppData(export)로 보입니다.\n확인=덮어쓰기, 취소=병합",
      )
        ? "replace"
        : "merge";
      importData(jsonText, mode);
      setMsg(
        mode === "replace"
          ? "AppData를 교체했습니다. (/data와 동일)"
          : "AppData를 병합했습니다. (/data와 동일)",
      );
      return;
    }

    const r = parseLlmCaseJsonToNewCaseInput(jsonText);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setWarnings(r.warnings);

    setUrl(r.input.sourceUrl ?? "llm-import:unknown");
    setCaseNumber(r.input.caseNumber ?? "");
    setAddress(r.input.address ?? "");
    setPropertyType(r.input.propertyType ?? "");
    setBuiltYear(r.input.builtYear ?? "");
    setAppraisalPrice(
      r.input.appraisalPrice != null ? formatWonDigits(r.input.appraisalPrice) : "",
    );
    setMinPrice(r.input.minPrice != null ? formatWonDigits(r.input.minPrice) : "");
    setBidDate(r.input.bidDate ?? "");
    setLandAreaSqm(r.input.landAreaSqm != null ? String(r.input.landAreaSqm) : "");
    setBuildingAreaSqm(
      r.input.buildingAreaSqm != null ? String(r.input.buildingAreaSqm) : "",
    );
    setParkingUnitCount(
      r.input.parkingUnitCount != null ? String(r.input.parkingUnitCount) : "",
    );
    setMemo(r.input.memo ?? "");

    setMsg("파싱 완료. 아래에서 수정 후 저장하세요.");
  };

  const canSubmit = useMemo(() => url.trim().length > 0, [url]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
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

    const c = addCase({
      sourceUrl: url.trim(),
      caseNumber: caseNumber.trim() || undefined,
      address: address.trim() || undefined,
      propertyType: propertyType.trim() || undefined,
      builtYear: builtYear.trim() || undefined,
      appraisalPrice: parseWonInput(appraisalPrice),
      minPrice: parseWonInput(minPrice),
      bidDate: bidDate || null,
      landAreaSqm: parseAreaSqmInputToNumber(landAreaSqm),
      buildingAreaSqm: parseAreaSqmInputToNumber(buildingAreaSqm),
      parkingUnitCount: parkingUnitCountVal,
      memo: memo.trim() || undefined,
    });
    router.push(`/cases/${c.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">JSON로 가져오기</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          LLM이 만든 단일 케이스 JSON(부분 필드 가능)을 붙여넣어 물건으로 추가합니다.
          전체 <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-900">AppData</code>{" "}
          JSON이면 <Link href="/data" className="underline underline-offset-2">/data</Link>와 동일하게 병합/교체됩니다.
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <label className="text-sm font-medium">JSON 입력</label>
        <AutoGrowTextarea
          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-950"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='예: {"caseNumber":"2024타경12345","address":"...","minPrice":"123,000,000원","bidDate":"2026.05.30"}'
          maxViewportFraction={0.7}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={parse}
            className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            파싱/미리보기
          </button>
          <button
            type="button"
            onClick={() => {
              setJsonText("");
              setMsg(null);
              setWarnings([]);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
          >
            비우기
          </button>
        </div>

        {msg && (
          <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
            {msg}
          </p>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">파싱 경고</p>
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

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">sourceUrl *</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
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
              />
            </div>
            <div>
              <label className="text-sm font-medium">준공/사용승인</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={builtYear}
                onChange={(e) => setBuiltYear(e.target.value)}
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
                onChange={(e) => setLandAreaSqm(filterAreaSqmInputRaw(e.target.value))}
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
        </section>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          저장하고 상세로 이동
        </button>
      </form>
    </div>
  );
}

