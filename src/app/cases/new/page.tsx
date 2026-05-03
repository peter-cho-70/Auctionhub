"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { useAppStore } from "@/store/app-store";
import { parseAuctionUrl } from "@/lib/domain/url-parser";
import { formatWonDigits, parseWonInput } from "@/lib/format/won";
import {
  emptyRoomShapeMix,
  ROOM_SHAPE_OPTIONS,
} from "@/lib/types/domain";
import {
  filterAreaSqmInputRaw,
  parseAreaSqmInputToNumber,
} from "@/lib/format/area-input";

export default function NewCasePage() {
  const router = useRouter();
  const addCase = useAppStore((s) => s.addCase);

  const [url, setUrl] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [builtYear, setBuiltYear] = useState("");
  const [floor, setFloor] = useState("");
  const [householdCount, setHouseholdCount] = useState("");
  const [roomShapeMix, setRoomShapeMix] = useState(emptyRoomShapeMix);
  const [appraisalPrice, setAppraisalPrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [bidDate, setBidDate] = useState("");
  const [priority, setPriority] = useState<"high" | "normal" | "low">("normal");
  const [fieldSurvey, setFieldSurvey] = useState("");
  const [memo, setMemo] = useState("");
  const [landAreaSqm, setLandAreaSqm] = useState("");
  const [buildingAreaSqm, setBuildingAreaSqm] = useState("");
  const [parkingUnitCount, setParkingUnitCount] = useState("");
  const [hasBuildingViolation, setHasBuildingViolation] = useState(false);
  const [buildingCoverageRatio, setBuildingCoverageRatio] = useState("");
  const [floorAreaRatio, setFloorAreaRatio] = useState("");
  const [lienBaseline, setLienBaseline] = useState("");

  const applyUrl = () => {
    const p = parseAuctionUrl(url);
    if (p.caseNumber && !caseNumber) setCaseNumber(p.caseNumber);
    if (p.address && !address) setAddress(p.address);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const hcRaw = householdCount.trim();
    const hcParsed = hcRaw === "" ? null : parseInt(hcRaw, 10);
    const householdCountVal =
      hcParsed != null && Number.isFinite(hcParsed) && hcParsed >= 0
        ? Math.min(99999, hcParsed)
        : null;
    const pkRaw = parkingUnitCount.trim().replace(/\D/g, "");
    const pkParsed = pkRaw === "" ? null : parseInt(pkRaw, 10);
    const parkingUnitCountVal =
      pkParsed != null && Number.isFinite(pkParsed) && pkParsed >= 0
        ? Math.min(99999, pkParsed)
        : null;
    const c = addCase({
      sourceUrl: url.trim(),
      caseNumber: caseNumber || undefined,
      address: address || undefined,
      propertyType: propertyType || undefined,
      builtYear: builtYear || undefined,
      floor: floor || undefined,
      householdCount: householdCountVal,
      roomShapeMix,
      landAreaSqm: parseAreaSqmInputToNumber(landAreaSqm),
      buildingAreaSqm: parseAreaSqmInputToNumber(buildingAreaSqm),
      parkingUnitCount: parkingUnitCountVal,
      hasBuildingViolation,
      buildingCoverageRatio: buildingCoverageRatio || undefined,
      floorAreaRatio: floorAreaRatio || undefined,
      lienBaseline: lienBaseline || undefined,
      appraisalPrice: parseWonInput(appraisalPrice),
      minPrice: parseWonInput(minPrice),
      bidDate: bidDate || null,
      priority,
      fieldSurvey: fieldSurvey || undefined,
      memo: memo || undefined,
    });
    router.push(`/cases/${c.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">새 물건</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          경매 URL을 붙여넣은 뒤, 자동 추출된 값을 보완하세요.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium">경매 URL *</label>
          <div className="mt-1 flex gap-2">
            <input
              required
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.courtauction.go.kr/..."
            />
            <button
              type="button"
              onClick={applyUrl}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
            >
              URL에서 추출
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">사건번호</label>
            <input
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="예: 2024타경12345"
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
          <div className="grid gap-3 sm:grid-cols-4 sm:col-span-2">
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
              <label className="text-sm font-medium">준공년도</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={builtYear}
                onChange={(e) => setBuiltYear(e.target.value)}
                placeholder="예: 1998"
              />
            </div>
            <div>
              <label className="text-sm font-medium">층</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="예: 지상3층"
              />
            </div>
            <div>
              <label className="text-sm font-medium">가구 수</label>
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                value={householdCount}
                onChange={(e) =>
                  setHouseholdCount(e.target.value.replace(/\D/g, ""))
                }
                placeholder="세대·호 수"
              />
            </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
              <div>
                <label className="text-sm font-medium">토지면적 (㎡)</label>
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={landAreaSqm}
                  onChange={(e) =>
                    setLandAreaSqm(filterAreaSqmInputRaw(e.target.value))
                  }
                  placeholder="예: 165.2"
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
                  placeholder="예: 298.45"
                />
              </div>
              <div>
                <label className="text-sm font-medium">주차 대수</label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                  value={parkingUnitCount}
                  onChange={(e) =>
                    setParkingUnitCount(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="대"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasBuildingViolation}
                  onChange={(e) =>
                    setHasBuildingViolation(e.target.checked)
                  }
                  className="rounded border-neutral-300"
                />
                위반건축 (건축물대장 등)
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
              <div>
                <label className="text-sm font-medium">건폐율</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={buildingCoverageRatio}
                  onChange={(e) =>
                    setBuildingCoverageRatio(e.target.value)
                  }
                  placeholder="예: 60%"
                />
              </div>
              <div>
                <label className="text-sm font-medium">용적율</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={floorAreaRatio}
                  onChange={(e) => setFloorAreaRatio(e.target.value)}
                  placeholder="예: 200%"
                />
              </div>
              <div>
                <label className="text-sm font-medium">말소기준</label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                  value={lienBaseline}
                  onChange={(e) => setLienBaseline(e.target.value)}
                  placeholder="말소기준권리 등"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium">가구 형태</p>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              룸 타입별 호실 수를 입력합니다. (없으면 0 또는 비움)
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ROOM_SHAPE_OPTIONS.map((shape) => (
                <label key={shape} className="block text-xs text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {shape}
                  </span>
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
                    value={
                      roomShapeMix[shape] === 0
                        ? ""
                        : String(roomShapeMix[shape])
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const n =
                        raw === "" ? 0 : Math.min(9999, parseInt(raw, 10) || 0);
                      setRoomShapeMix((prev) => ({
                        ...prev,
                        [shape]: Number.isFinite(n) && n >= 0 ? n : 0,
                      }));
                    }}
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">우선순위</label>
            <select
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as "high" | "normal" | "low")
              }
            >
              <option value="high">high</option>
              <option value="normal">normal</option>
              <option value="low">low</option>
            </select>
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
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">임장조사</label>
            <AutoGrowTextarea
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              placeholder="현장 확인, 주변 시세, 관리비·공실 등"
              value={fieldSurvey}
              onChange={(e) => setFieldSurvey(e.target.value)}
              maxViewportFraction={0.7}
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

        <button
          type="submit"
          className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          등록하고 상세로 이동
        </button>
      </form>
    </div>
  );
}
