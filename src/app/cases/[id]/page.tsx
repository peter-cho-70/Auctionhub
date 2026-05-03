"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { STATUS_LABELS } from "@/lib/domain/status-labels";
import {
  buildTemplateContext,
  interpolateTemplate,
  STANDARD_TEMPLATE_KEYS,
} from "@/lib/domain/template-vars";
import {
  filterAreaSqmInputRaw,
  parseAreaSqmInputToNumber,
} from "@/lib/format/area-input";
import { formatWonDigits, formatWonWithUnit, parseWonInput } from "@/lib/format/won";
import { canSecondBidderReport } from "@/lib/domain/finance";
import type {
  AuctionCase,
  BidRound,
  BidRoundResult,
  CaseStatus,
} from "@/lib/types/domain";
import {
  emptyRoomShapeMix,
  ROOM_SHAPE_OPTIONS,
} from "@/lib/types/domain";
import { CaseRentSettingPanel } from "@/components/case-rent-setting-panel";
import { normalizeRentSetting } from "@/lib/domain/rent-setting";
import { useAppStore } from "@/store/app-store";

type Tab =
  | "basic"
  | "rent"
  | "checklists"
  | "rounds"
  | "decision"
  | "templates"
  | "tools";

const MONEY_EXTRA_KEYS = ["낙찰가", "보증금", "내입찰가"] as const;

function onExtraMoneyChange(
  key: (typeof MONEY_EXTRA_KEYS)[number],
  raw: string,
  setExtras: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  const v = raw;
  const n = parseWonInput(v);
  setExtras((prev) => ({
    ...prev,
    [key]:
      v.trim() === "" ? "" : n != null ? formatWonDigits(n) : v,
  }));
}

export default function CaseDetailPage() {
  const params = useParams();
  const id = String(params.id);

  const c = useAppStore((s) => s.data.cases.find((x) => x.id === id));
  const updateCase = useAppStore((s) => s.updateCase);
  const setCaseStatus = useAppStore((s) => s.setCaseStatus);
  const toggleChecklistItem = useAppStore((s) => s.toggleChecklistItem);
  const setChecklistItemNote = useAppStore((s) => s.setChecklistItemNote);
  const updateCaseChecklistItemFields = useAppStore(
    (s) => s.updateCaseChecklistItemFields,
  );
  const addCaseChecklistItem = useAppStore((s) => s.addCaseChecklistItem);
  const removeCaseChecklistItem = useAppStore((s) => s.removeCaseChecklistItem);
  const setDecision = useAppStore((s) => s.setDecision);
  const addBidRound = useAppStore((s) => s.addBidRound);
  const updateBidRound = useAppStore((s) => s.updateBidRound);
  const removeBidRound = useAppStore((s) => s.removeBidRound);
  const setWonDayActionsCompleted = useAppStore(
    (s) => s.setWonDayActionsCompleted,
  );
  const reapplyTemplatesToCase = useAppStore((s) => s.reapplyTemplatesToCase);
  const templates = useAppStore((s) => s.data.messageTemplates);

  const [tab, setTab] = useState<Tab>("basic");

  const [basicDraft, setBasicDraft] = useState<Partial<AuctionCase> | null>(
    null,
  );
  const caseForForm = basicDraft ?? c ?? null;

  const [extras, setExtras] = useState<Record<string, string>>({
    명의: "개인",
    현주택수: "",
    소득요약: "",
    카드사용: "",
    부채요약: "",
    물건특징: "",
    매도전략: "임대 수익 목적",
    낙찰가: "",
    보증금: "",
    내입찰가: "",
  });

  const [winP, setWinP] = useState("");
  const [dep, setDep] = useState("");
  const [myBid, setMyBid] = useState("");

  const secondOk = useMemo(() => {
    const w = parseWonInput(winP);
    const d = parseWonInput(dep);
    const m = parseWonInput(myBid);
    if (w == null || d == null || m == null) return null;
    return canSecondBidderReport(w, d, m);
  }, [winP, dep, myBid]);

  const [landSqmInput, setLandSqmInput] = useState("");
  const [buildingSqmInput, setBuildingSqmInput] = useState("");
  const [parkingCountInput, setParkingCountInput] = useState("");

  useEffect(() => {
    if (!c) return;
    setLandSqmInput(c.landAreaSqm != null ? String(c.landAreaSqm) : "");
    setBuildingSqmInput(
      c.buildingAreaSqm != null ? String(c.buildingAreaSqm) : "",
    );
    setParkingCountInput(
      c.parkingUnitCount != null ? String(c.parkingUnitCount) : "",
    );
  }, [
    c?.id,
    c?.landAreaSqm,
    c?.buildingAreaSqm,
    c?.parkingUnitCount,
  ]);

  const caseViewForRent = useMemo((): AuctionCase | null => {
    if (!c) return null;
    const merged = { ...c, ...(basicDraft ?? {}) };
    const landParsed = parseAreaSqmInputToNumber(landSqmInput);
    const buildingParsed = parseAreaSqmInputToNumber(buildingSqmInput);
    return {
      ...merged,
      landAreaSqm: landParsed ?? merged.landAreaSqm ?? null,
      buildingAreaSqm: buildingParsed ?? merged.buildingAreaSqm ?? null,
    };
  }, [c, basicDraft, landSqmInput, buildingSqmInput]);

  if (!c) {
    return (
      <div className="space-y-3">
        <p>물건을 찾을 수 없습니다.</p>
        <Link href="/cases" className="text-sm underline">
          목록으로
        </Link>
      </div>
    );
  }

  const viewCase = caseViewForRent ?? c;

  const syncDraftFromCase = () => setBasicDraft(null);

  const saveBasic = () => {
    if (!caseForForm) return;
    updateCase(id, {
      caseNumber: caseForForm.caseNumber ?? "",
      address: caseForForm.address ?? "",
      propertyType: caseForForm.propertyType ?? "",
      builtYear: caseForForm.builtYear ?? "",
      floor: caseForForm.floor ?? "",
      householdCount: caseForForm.householdCount ?? null,
      roomShapeMix: {
        ...emptyRoomShapeMix(),
        ...(caseForForm.roomShapeMix ?? {}),
      },
      appraisalPrice: caseForForm.appraisalPrice ?? null,
      minPrice: caseForForm.minPrice ?? null,
      bidDate: caseForForm.bidDate ?? null,
      priority: caseForForm.priority ?? "normal",
      fieldSurvey: caseForForm.fieldSurvey ?? "",
      memo: caseForForm.memo ?? "",
      sourceUrl: caseForForm.sourceUrl ?? c.sourceUrl,
      landAreaSqm: parseAreaSqmInputToNumber(landSqmInput),
      buildingAreaSqm: parseAreaSqmInputToNumber(buildingSqmInput),
      parkingUnitCount: (() => {
        const raw = parkingCountInput.trim().replace(/\D/g, "");
        if (raw === "") return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n >= 0
          ? Math.min(99999, n)
          : null;
      })(),
      hasBuildingViolation:
        (caseForForm ?? c).hasBuildingViolation === true,
      buildingCoverageRatio: caseForForm.buildingCoverageRatio ?? "",
      floorAreaRatio: caseForForm.floorAreaRatio ?? "",
      lienBaseline: caseForForm.lienBaseline ?? "",
    });
    syncDraftFromCase();
  };

  const saveRentSetting = (rentSetting: Parameters<typeof normalizeRentSetting>[0]) => {
    updateCase(id, { rentSetting: normalizeRentSetting(rentSetting) });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "basic", label: "기본·수동입력" },
    { key: "rent", label: "임대세팅" },
    { key: "checklists", label: "체크리스트" },
    { key: "rounds", label: "입찰·유찰 회차" },
    { key: "decision", label: "판단 기록" },
    { key: "templates", label: "문자·템플릿" },
    { key: "tools", label: "도구" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/cases"
            className="text-xs text-neutral-500 hover:underline"
          >
            ← 목록
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {c.address || c.caseNumber || "물건 상세"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {STATUS_LABELS[c.status]}
            {c.bidDate && ` · 입찰 ${c.bidDate}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">상태</span>
            <select
              value={c.status}
              onChange={(e) =>
                setCaseStatus(id, e.target.value as CaseStatus)
              }
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            >
              {(Object.keys(STATUS_LABELS) as CaseStatus[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={c.wonDayActionsCompleted}
              onChange={(e) =>
                setWonDayActionsCompleted(id, e.target.checked)
              }
            />
            낙찰 당일 액션 완료
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-2.5 py-1.5 text-sm ${
              tab === t.key
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "basic" && (
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            필드를 수정한 뒤 저장하세요. 체크리스트 구조는 &quot;프로세스&quot;
            메뉴에서 바꾼 뒤, 아래 버튼으로 이 물건에 다시 적용할 수 있습니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">
                경매 URL
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).sourceUrl}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    sourceUrl: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                사건번호
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).caseNumber}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    caseNumber: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                우선순위
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).priority}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    priority: e.target.value as AuctionCase["priority"],
                  })
                }
              >
                <option value="high">high</option>
                <option value="normal">normal</option>
                <option value="low">low</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">주소</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).address}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    address: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4 sm:col-span-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  물건 유형
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).propertyType}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      propertyType: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  준공년도
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).builtYear ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      builtYear: e.target.value,
                    })
                  }
                  placeholder="예: 1998"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  층
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).floor}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      floor: e.target.value,
                    })
                  }
                  placeholder="예: 지상3층"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  가구 수
                </label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={
                    (caseForForm ?? c).householdCount != null
                      ? String((caseForForm ?? c).householdCount)
                      : ""
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const n =
                      raw === ""
                        ? null
                        : Math.min(99999, parseInt(raw, 10) || 0);
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      householdCount: n,
                    });
                  }}
                  placeholder="세대·호 수"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  토지면적 (㎡)
                </label>
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={landSqmInput}
                  onChange={(e) =>
                    setLandSqmInput(filterAreaSqmInputRaw(e.target.value))
                  }
                  placeholder="예: 165.2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  건물면적 (㎡)
                </label>
                <input
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={buildingSqmInput}
                  onChange={(e) =>
                    setBuildingSqmInput(filterAreaSqmInputRaw(e.target.value))
                  }
                  placeholder="예: 298.45"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  주차 대수
                </label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                  value={parkingCountInput}
                  onChange={(e) =>
                    setParkingCountInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="대"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={(caseForForm ?? c).hasBuildingViolation}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      hasBuildingViolation: e.target.checked,
                    })
                  }
                  className="rounded border-neutral-300"
                />
                위반건축 (건축물대장 등)
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 sm:col-span-2">
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  건폐율
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).buildingCoverageRatio ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      buildingCoverageRatio: e.target.value,
                    })
                  }
                  placeholder="예: 60%"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  용적율
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).floorAreaRatio ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      floorAreaRatio: e.target.value,
                    })
                  }
                  placeholder="예: 200%"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">
                  말소기준
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  value={(caseForForm ?? c).lienBaseline ?? ""}
                  onChange={(e) =>
                    setBasicDraft({
                      ...(caseForForm ?? c),
                      lienBaseline: e.target.value,
                    })
                  }
                  placeholder="말소기준권리 등"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-neutral-500">가구 형태</p>
              <p className="mt-0.5 text-[11px] text-neutral-500">
                룸 타입별 호실 수
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ROOM_SHAPE_OPTIONS.map((shape) => {
                  const mix = {
                    ...emptyRoomShapeMix(),
                    ...((caseForForm ?? c).roomShapeMix ?? {}),
                  };
                  return (
                    <label
                      key={shape}
                      className="block text-[11px] text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {shape}
                      </span>
                      <input
                        inputMode="numeric"
                        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-900"
                        value={
                          mix[shape] === 0 ? "" : String(mix[shape])
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          const num =
                            raw === ""
                              ? 0
                              : Math.min(9999, parseInt(raw, 10) || 0);
                          const base = caseForForm ?? c;
                          setBasicDraft({
                            ...base,
                            roomShapeMix: {
                              ...emptyRoomShapeMix(),
                              ...(base.roomShapeMix ?? {}),
                              [shape]: num,
                            },
                          });
                        }}
                        placeholder="0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                감정가 (원)
              </label>
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  (caseForForm ?? c).appraisalPrice != null
                    ? formatWonDigits((caseForForm ?? c).appraisalPrice)
                    : ""
                }
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    appraisalPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500">
                최저가 (원)
              </label>
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  (caseForForm ?? c).minPrice != null
                    ? formatWonDigits((caseForForm ?? c).minPrice)
                    : ""
                }
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    minPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">
                입찰일
              </label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).bidDate ?? ""}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    bidDate: e.target.value || null,
                  })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">
                임장조사
              </label>
              <AutoGrowTextarea
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="현장 확인, 주변 시세, 관리비·공실 등"
                value={(caseForForm ?? c).fieldSurvey}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    fieldSurvey: e.target.value,
                  })
                }
                maxViewportFraction={0.7}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-neutral-500">메모</label>
              <AutoGrowTextarea
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={(caseForForm ?? c).memo}
                onChange={(e) =>
                  setBasicDraft({
                    ...(caseForForm ?? c),
                    memo: e.target.value,
                  })
                }
                maxViewportFraction={0.7}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveBasic}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              기본 정보 저장
            </button>
            <button
              type="button"
              onClick={() => {
                if (basicDraft) syncDraftFromCase();
              }}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
            >
              편집 취소
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "저장된 체크리스트 진행 상황이 초기화될 수 있습니다. 계속할까요?",
                  )
                ) {
                  reapplyTemplatesToCase(id);
                }
              }}
              className="rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:text-amber-200"
            >
              최신 프로세스 템플릿으로 체크리스트 재생성
            </button>
          </div>
          {c.nextExpectedMinPrice != null && (
            <p className="text-xs text-neutral-500">
              다음 회차 예상 최저가(감액 20% 가정):{" "}
              <strong className="tabular-nums">
                {formatWonWithUnit(c.nextExpectedMinPrice)}
              </strong>
            </p>
          )}
        </section>
      )}

      {tab === "rent" && (
        <CaseRentSettingPanel
          caseId={id}
          caseData={viewCase}
          templateExtras={extras}
          onSave={saveRentSetting}
        />
      )}

      {tab === "checklists" && (
        <div className="space-y-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            항목 문구·필수 여부를 바꾸거나 행을 추가·삭제할 수 있습니다. 전체
            단계를 프로세스 템플릿과 맞추려면 기본 정보 탭의
            &quot;재생성&quot;을 사용하세요.
          </p>
          {c.checklists.map((cl) => (
            <section
              key={cl.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <h3 className="font-medium">{cl.title}</h3>
              <ul className="mt-3 space-y-3">
                {cl.items.map((it) => (
                  <li
                    key={it.id}
                    className="rounded-lg border border-neutral-100 p-2 dark:border-neutral-900"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <label className="flex shrink-0 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={it.done}
                          onChange={(e) =>
                            toggleChecklistItem(
                              id,
                              cl.id,
                              it.id,
                              e.target.checked,
                            )
                          }
                          className="mt-1"
                        />
                        <span className="text-xs text-neutral-500">완료</span>
                      </label>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="w-full min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                            placeholder="체크리스트 항목"
                            value={it.label}
                            onChange={(e) =>
                              updateCaseChecklistItemFields(
                                id,
                                cl.id,
                                it.id,
                                { label: e.target.value },
                              )
                            }
                          />
                          <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={it.required}
                              onChange={(e) =>
                                updateCaseChecklistItemFields(
                                  id,
                                  cl.id,
                                  it.id,
                                  { required: e.target.checked },
                                )
                              }
                            />
                            필수
                          </label>
                          <button
                            type="button"
                            className="text-xs text-rose-600 hover:underline"
                            onClick={() =>
                              removeCaseChecklistItem(id, cl.id, it.id)
                            }
                          >
                            삭제
                          </button>
                        </div>
                        <input
                          placeholder="완료 메모"
                          className="w-full rounded border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900"
                          value={it.note}
                          onChange={(e) =>
                            setChecklistItemNote(
                              id,
                              cl.id,
                              it.id,
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => addCaseChecklistItem(id, cl.id)}
                className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
              >
                항목 추가
              </button>
            </section>
          ))}
        </div>
      )}

      {tab === "rounds" && (
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <BidRoundsEditor
            caseId={id}
            rounds={c.bidRounds}
            addBidRound={addBidRound}
            updateBidRound={updateBidRound}
            removeBidRound={removeBidRound}
          />
        </section>
      )}

      {tab === "decision" && (
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              판단
              <select
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={c.decision.verdict ?? ""}
                onChange={(e) =>
                  setDecision(id, {
                    verdict:
                      e.target.value === ""
                        ? null
                        : (e.target.value as NonNullable<
                            AuctionCase["decision"]["verdict"]
                          >),
                  })
                }
              >
                <option value="">미정</option>
                <option value="recommend">입찰 추천</option>
                <option value="caution">주의</option>
                <option value="not_recommend">비추천</option>
                <option value="abandon">포기</option>
              </select>
            </label>
            <label className="text-sm">
              리스크
              <select
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={c.decision.riskLevel ?? ""}
                onChange={(e) =>
                  setDecision(id, {
                    riskLevel:
                      e.target.value === ""
                        ? null
                        : (e.target.value as NonNullable<
                            AuctionCase["decision"]["riskLevel"]
                          >),
                  })
                }
              >
                <option value="">미정</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
            <label className="text-sm">
              최대 입찰 가능가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  c.decision.maxBidPrice != null
                    ? formatWonDigits(c.decision.maxBidPrice)
                    : ""
                }
                onChange={(e) =>
                  setDecision(id, {
                    maxBidPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-sm">
              실제 입찰가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                value={
                  c.decision.actualBidPrice != null
                    ? formatWonDigits(c.decision.actualBidPrice)
                    : ""
                }
                onChange={(e) =>
                  setDecision(id, {
                    actualBidPrice: parseWonInput(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <label className="text-sm">
            판단 사유
            <textarea
              rows={5}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={c.decision.reason}
              onChange={(e) =>
                setDecision(id, { reason: e.target.value })
              }
            />
          </label>
        </section>
      )}

      {tab === "templates" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <h3 className="font-medium">템플릿에 넣을 추가 값</h3>
            <p className="mt-1 text-xs text-neutral-500">
              물건 기본 필드 외에 문자에 필요한 값입니다.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  "명의",
                  "현주택수",
                  "소득요약",
                  "카드사용",
                  "부채요약",
                  "물건특징",
                  "매도전략",
                  "낙찰가",
                  "보증금",
                  "내입찰가",
                ] as const
              ).map((key) => (
                <label key={key} className="text-xs">
                  {key}
                  <input
                    className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 tabular-nums dark:border-neutral-800 dark:bg-neutral-900"
                    inputMode={
                      (MONEY_EXTRA_KEYS as readonly string[]).includes(key)
                        ? "numeric"
                        : undefined
                    }
                    value={extras[key] ?? ""}
                    onChange={(e) =>
                      (MONEY_EXTRA_KEYS as readonly string[]).includes(key)
                        ? onExtraMoneyChange(
                            key as (typeof MONEY_EXTRA_KEYS)[number],
                            e.target.value,
                            setExtras,
                          )
                        : setExtras((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          {templates.map((tm) => {
            const ctx = buildTemplateContext(viewCase, extras);
            const body = interpolateTemplate(tm.body, ctx);
            return (
              <div
                key={tm.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{tm.name}</h3>
                  <CopyButton text={body} label="원클릭 복사" />
                </div>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
                  {body}
                </pre>
              </div>
            );
          })}

          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer">표준 변수 키 목록</summary>
            <p className="mt-2">
              {STANDARD_TEMPLATE_KEYS.map((k) => `{${k}}`).join(" · ")}
            </p>
          </details>
        </section>
      )}

      {tab === "tools" && (
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <h3 className="font-medium">차순위 매수신고 가능 여부</h3>
          <p className="text-xs text-neutral-500">
            낙찰가 − 보증금 &lt; 내 입찰가 이면 신고 가능 (PRD).
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              낙찰가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded border px-2 py-1 tabular-nums dark:bg-neutral-900"
                value={winP}
                onChange={(e) => {
                  const n = parseWonInput(e.target.value);
                  setWinP(n != null ? formatWonDigits(n) : "");
                }}
              />
            </label>
            <label className="text-xs">
              보증금 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded border px-2 py-1 tabular-nums dark:bg-neutral-900"
                value={dep}
                onChange={(e) => {
                  const n = parseWonInput(e.target.value);
                  setDep(n != null ? formatWonDigits(n) : "");
                }}
              />
            </label>
            <label className="text-xs">
              내 입찰가 (원)
              <input
                inputMode="numeric"
                className="mt-1 w-full rounded border px-2 py-1 tabular-nums dark:bg-neutral-900"
                value={myBid}
                onChange={(e) => {
                  const n = parseWonInput(e.target.value);
                  setMyBid(n != null ? formatWonDigits(n) : "");
                }}
              />
            </label>
          </div>
          {secondOk != null && (
            <p className="text-sm font-medium">
              결과:{" "}
              {secondOk ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  차순위 매수신고 가능 조건 충족
                </span>
              ) : (
                <span className="text-rose-700 dark:text-rose-400">
                  조건 미충족 (입찰가가 더 낮거나 같음)
                </span>
              )}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function BidRoundsEditor({
  caseId,
  rounds,
  addBidRound,
  updateBidRound,
  removeBidRound,
}: {
  caseId: string;
  rounds: BidRound[];
  addBidRound: (caseId: string, round: Omit<BidRound, "id">) => void;
  updateBidRound: (
    caseId: string,
    roundId: string,
    patch: Partial<BidRound>,
  ) => void;
  removeBidRound: (caseId: string, roundId: string) => void;
}) {
  const sorted = [...rounds].sort((a, b) => a.round - b.round);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs text-neutral-500">
              <th className="py-2 pr-2">회차</th>
              <th className="py-2 pr-2">최저가</th>
              <th className="py-2 pr-2">내 입찰</th>
              <th className="py-2 pr-2">결과</th>
              <th className="py-2 pr-2">입찰일</th>
              <th className="py-2 pr-2">메모</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-900">
                <td className="py-1 pr-2">
                  <input
                    className="w-14 rounded border px-1 py-0.5 dark:bg-neutral-900"
                    type="number"
                    value={r.round}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        round: Number(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    className="w-28 rounded border px-1 py-0.5 dark:bg-neutral-900"
                    inputMode="numeric"
                    value={
                      r.minPrice != null ? formatWonDigits(r.minPrice) : ""
                    }
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        minPrice: parseWonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    className="w-28 rounded border px-1 py-0.5 dark:bg-neutral-900"
                    inputMode="numeric"
                    value={
                      r.myBidPrice != null ? formatWonDigits(r.myBidPrice) : ""
                    }
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        myBidPrice: parseWonInput(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <select
                    className="rounded border px-1 py-0.5 dark:bg-neutral-900"
                    value={r.result}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        result: e.target.value as BidRoundResult,
                      })
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="failed">유찰/실패</option>
                    <option value="won">낙찰</option>
                    <option value="lost">패찰</option>
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="date"
                    className="w-36 rounded border px-1 py-0.5 dark:bg-neutral-900"
                    value={r.bidDate ?? ""}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, {
                        bidDate: e.target.value || null,
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    className="w-32 rounded border px-1 py-0.5 dark:bg-neutral-900"
                    value={r.memo}
                    onChange={(e) =>
                      updateBidRound(caseId, r.id, { memo: e.target.value })
                    }
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:underline"
                    onClick={() => removeBidRound(caseId, r.id)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
        onClick={() => {
          const next =
            sorted.length > 0
              ? Math.max(...sorted.map((x) => x.round)) + 1
              : 1;
          addBidRound(caseId, {
            round: next,
            minPrice: null,
            myBidPrice: null,
            result: "failed",
            bidDate: null,
            memo: "",
          });
        }}
      >
        회차 추가
      </button>
    </div>
  );
}
