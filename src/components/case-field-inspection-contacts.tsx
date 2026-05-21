"use client";

import { AutoGrowTextarea } from "@/components/auto-grow-textarea";
import { HoverHint, LabelWithHint } from "@/components/hover-hint";
import {
  emptyNearbyBroker,
  FIELD_CONTACT_DISTANCE_LABEL,
  FIELD_INSPECTION_HINTS,
  MANAGEMENT_SERVICE_SCOPES,
  MAX_NEARBY_BROKERS,
} from "@/lib/domain/field-inspection";
import type {
  BuildingManagementContact,
  FieldContactDistance,
  FieldInspectionRecord,
  ManagementServiceScopeKey,
  NearbyBrokerContact,
} from "@/lib/types/domain";

const INPUT =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900";

type Props = {
  record: FieldInspectionRecord;
  onChange: (next: FieldInspectionRecord) => void;
};

export function CaseFieldInspectionContacts({
  record,
  onChange,
}: Props) {
  const persist = (patch: Partial<FieldInspectionRecord>) => {
    onChange({
      ...record,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateManagement = (patch: Partial<BuildingManagementContact>) => {
    persist({
      buildingManagement: { ...record.buildingManagement, ...patch },
    });
  };

  const updateBroker = (id: string, patch: Partial<NearbyBrokerContact>) => {
    persist({
      nearbyBrokers: record.nearbyBrokers.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      ),
    });
  };

  const removeBroker = (id: string) => {
    if (!confirm("이 부동산 기록을 삭제할까요?")) return;
    persist({
      nearbyBrokers: record.nearbyBrokers.filter((b) => b.id !== id),
    });
  };

  const addBroker = () => {
    if (record.nearbyBrokers.length >= MAX_NEARBY_BROKERS) {
      alert(`부동산은 최대 ${MAX_NEARBY_BROKERS}곳까지 기록할 수 있습니다.`);
      return;
    }
    persist({
      nearbyBrokers: [...record.nearbyBrokers, emptyNearbyBroker()],
    });
  };

  const toggleScope = (key: ManagementServiceScopeKey) => {
    const scopes = record.buildingManagement.serviceScopes;
    const next = scopes.includes(key)
      ? scopes.filter((k) => k !== key)
      : [...scopes, key];
    updateManagement({ serviceScopes: next });
  };

  const m = record.buildingManagement;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/25">
        <h3 className="text-sm font-semibold text-sky-950 dark:text-sky-100">
          <LabelWithHint
            label="임장 일정"
            hint={FIELD_INSPECTION_HINTS.visitMeta}
          />
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            방문일
            <input
              type="date"
              className={INPUT}
              value={record.visitDate ?? ""}
              onChange={(e) =>
                persist({ visitDate: e.target.value.trim() || null })
              }
            />
          </label>
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            소요(분)
            <input
              type="number"
              min={0}
              className={`${INPUT} tabular-nums`}
              value={record.visitDurationMin ?? ""}
              onChange={(e) =>
                persist({
                  visitDurationMin: parseOptionalInt(e.target.value, 999),
                })
              }
            />
          </label>
          <label className="sm:col-span-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            동행자
            <input
              className={INPUT}
              value={record.companions}
              onChange={(e) => persist({ companions: e.target.value })}
              placeholder="예: 투자자 A, 현지 부동산 실장"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">
          <LabelWithHint
            label="건물 관리업체"
            hint={FIELD_INSPECTION_HINTS.buildingManagement}
          />
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="업체명" value={m.companyName} onChange={(v) => updateManagement({ companyName: v })} />
          <TextField label="담당자" value={m.contactName} onChange={(v) => updateManagement({ contactName: v })} />
          <TextField label="전화" value={m.phone} onChange={(v) => updateManagement({ phone: v })} inputMode="tel" />
          <label className="text-xs font-medium text-neutral-500">
            호당 관리비(만원)
            <input
              type="number"
              min={0}
              className={`${INPUT} tabular-nums`}
              value={m.monthlyFeePerUnitManwon ?? ""}
              onChange={(e) =>
                updateManagement({
                  monthlyFeePerUnitManwon: parseOptionalInt(e.target.value, 9999),
                })
              }
            />
          </label>
          <label className="text-xs font-medium text-neutral-500">
            방문일
            <input
              type="date"
              className={INPUT}
              value={m.visitedAt ?? ""}
              onChange={(e) =>
                updateManagement({ visitedAt: e.target.value.trim() || null })
              }
            />
          </label>
          <label className="text-xs font-medium text-neutral-500">
            신뢰도 (1~5)
            <input
              type="number"
              min={1}
              max={5}
              className={`${INPUT} tabular-nums`}
              value={m.reliabilityScore ?? ""}
              onChange={(e) =>
                updateManagement({
                  reliabilityScore: parseScore1to5(e.target.value),
                })
              }
            />
          </label>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-neutral-500">업무 범위</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MANAGEMENT_SERVICE_SCOPES.map((scope) => (
              <label
                key={scope.key}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-800"
              >
                <input
                  type="checkbox"
                  checked={m.serviceScopes.includes(scope.key)}
                  onChange={() => toggleScope(scope.key)}
                />
                {scope.label}
                <HoverHint text={scope.hint} />
              </label>
            ))}
          </div>
          {m.serviceScopes.includes("other") && (
            <input
              className={`${INPUT} mt-2`}
              value={m.serviceScopeOther}
              onChange={(e) => updateManagement({ serviceScopeOther: e.target.value })}
              placeholder="기타 업무 상세"
            />
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TriStateField
            label="공실 출입"
            value={m.vacantAccessAvailable}
            onChange={(v) => updateManagement({ vacantAccessAvailable: v })}
            hint="공실 비밀번호·열쇠 제공 가능 여부"
          />
          <TriStateField
            label="미납대장"
            value={m.arrearsLedgerAvailable}
            onChange={(v) => updateManagement({ arrearsLedgerAvailable: v })}
            hint="관리비 미납·공실 검증용 대장 열람 가능 여부"
          />
          <TriStateField
            label="원격 관리"
            value={m.remoteManagement}
            onChange={(v) => updateManagement({ remoteManagement: v })}
            hint="사진·비대면 점검 등 원격 관리 가능 여부"
          />
          <TriStateField
            label="낙찰 후 협조"
            value={m.postAuctionCooperation}
            onChange={(v) => updateManagement({ postAuctionCooperation: v })}
            hint="낙찰 증명·사건번호 제시 시 호실 연락처·미납대장 협조 의사"
          />
        </div>
        <label className="mt-3 block text-xs font-medium text-neutral-500">
          관리업체 메모
          <AutoGrowTextarea
            className={INPUT}
            value={m.memo}
            onChange={(e) => updateManagement({ memo: e.target.value })}
            rows={2}
            placeholder="수리 이력, 청소 주기, 관리실 위치 등"
          />
        </label>
      </section>

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            <LabelWithHint
              label="주변 부동산"
              hint={FIELD_INSPECTION_HINTS.nearbyBrokers}
            />
          </h3>
          <button type="button" className={BTN} onClick={addBroker}>
            + 부동산 추가 ({record.nearbyBrokers.length}/{MAX_NEARBY_BROKERS})
          </button>
        </div>
        {record.nearbyBrokers.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            손품한 부동산을 추가하세요. 거리는 100m·250m 기준으로 구분합니다.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {record.nearbyBrokers.map((b, idx) => (
              <article
                key={b.id}
                className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-900"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-600">
                    #{idx + 1}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:underline"
                    onClick={() => removeBroker(b.id)}
                  >
                    삭제
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TextField
                    label="상호"
                    value={b.agencyName}
                    onChange={(v) => updateBroker(b.id, { agencyName: v })}
                  />
                  <TextField
                    label="사장/실장"
                    value={b.ownerName}
                    onChange={(v) => updateBroker(b.id, { ownerName: v })}
                  />
                  <TextField
                    label="전화"
                    value={b.phone}
                    onChange={(v) => updateBroker(b.id, { phone: v })}
                    inputMode="tel"
                  />
                  <label className="text-xs font-medium text-neutral-500">
                    거리
                    <select
                      className={INPUT}
                      value={b.distance}
                      onChange={(e) =>
                        updateBroker(b.id, {
                          distance: e.target.value as FieldContactDistance,
                        })
                      }
                    >
                      {(
                        Object.keys(FIELD_CONTACT_DISTANCE_LABEL) as FieldContactDistance[]
                      ).map((key) => (
                        <option key={key} value={key}>
                          {FIELD_CONTACT_DISTANCE_LABEL[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-neutral-500">
                    상담일
                    <input
                      type="date"
                      className={INPUT}
                      value={b.contactedAt ?? ""}
                      onChange={(e) =>
                        updateBroker(b.id, {
                          contactedAt: e.target.value.trim() || null,
                        })
                      }
                    />
                  </label>
                  <TriStateField
                    label="다가구 전문"
                    value={b.isMultifamilySpecialist}
                    onChange={(v) =>
                      updateBroker(b.id, { isMultifamilySpecialist: v })
                    }
                    hint="이 동네 다가구·원룸 손품 전문 여부"
                  />
                  <TriStateField
                    label="낙찰 후 관리"
                    value={b.willManageAfterAcquisition}
                    onChange={(v) =>
                      updateBroker(b.id, { willManageAfterAcquisition: v })
                    }
                    hint="낙찰 후 임대·공실 관리 대행 의사"
                  />
                </div>
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  <label className="text-xs font-medium text-neutral-500">
                    임대·월세 의견
                    <AutoGrowTextarea
                      className={INPUT}
                      value={b.rentOpinion}
                      onChange={(e) =>
                        updateBroker(b.id, { rentOpinion: e.target.value })
                      }
                      rows={2}
                      placeholder="룸별 시세, 공실, 보증금 관행"
                    />
                  </label>
                  <label className="text-xs font-medium text-neutral-500">
                    매매·호가 의견
                    <AutoGrowTextarea
                      className={INPUT}
                      value={b.saleOpinion}
                      onChange={(e) =>
                        updateBroker(b.id, { saleOpinion: e.target.value })
                      }
                      rows={2}
                      placeholder="매각가·수익률·유사 건물 거래"
                    />
                  </label>
                </div>
                <label className="mt-2 block text-xs font-medium text-neutral-500">
                  메모
                  <input
                    className={INPUT}
                    value={b.memo}
                    onChange={(e) => updateBroker(b.id, { memo: e.target.value })}
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">기타 현장 연락</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label="청소업체"
            value={record.cleaningCompanyName}
            onChange={(v) => persist({ cleaningCompanyName: v })}
            hint={FIELD_INSPECTION_HINTS.cleaningCompany}
          />
          <TextField
            label="청소 전화"
            value={record.cleaningCompanyPhone}
            onChange={(v) => persist({ cleaningCompanyPhone: v })}
            inputMode="tel"
          />
          <label className="text-xs font-medium text-neutral-500">
            <LabelWithHint
              label="관리실 위치"
              hint={FIELD_INSPECTION_HINTS.managementOfficeLocation}
            />
            <select
              className={INPUT}
              value={record.managementOfficeLocation ?? ""}
              onChange={(e) =>
                persist({
                  managementOfficeLocation:
                    e.target.value === ""
                      ? null
                      : (e.target.value as "in_building" | "off_site" | "unknown"),
                })
              }
            >
              <option value="">미확인</option>
              <option value="in_building">건물 내</option>
              <option value="off_site">건물 외부</option>
              <option value="unknown">불명</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-medium text-neutral-500">
          <LabelWithHint
            label="공실 출입 메모"
            hint={FIELD_INSPECTION_HINTS.vacantAccess}
          />
          <AutoGrowTextarea
            className={INPUT}
            value={record.vacantUnitAccessNote}
            onChange={(e) => persist({ vacantUnitAccessNote: e.target.value })}
            rows={2}
            placeholder="예: 201·302 공실, 관리실 열쇠, 비밀번호 1234*"
          />
        </label>
        <label className="mt-3 block text-xs font-medium text-neutral-500">
          <LabelWithHint label="임장 연락 메모" hint={FIELD_INSPECTION_HINTS.fieldMemo} />
          <AutoGrowTextarea
            className={INPUT}
            value={record.memo}
            onChange={(e) => persist({ memo: e.target.value })}
            rows={3}
          />
        </label>
      </section>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "tel" | "text";
  hint?: string;
}) {
  return (
    <label className="text-xs font-medium text-neutral-500">
      {hint ? <LabelWithHint label={label} hint={hint} /> : label}
      <input
        inputMode={inputMode}
        className={`${INPUT} tabular-nums`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TriStateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  hint?: string;
}) {
  return (
    <label className="text-xs font-medium text-neutral-500">
      {hint ? <LabelWithHint label={label} hint={hint} /> : label}
      <select
        className={INPUT}
        value={value === null ? "" : value ? "yes" : "no"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : v === "yes");
        }}
      >
        <option value="">미확인</option>
        <option value="yes">예</option>
        <option value="no">아니오</option>
      </select>
    </label>
  );
}

function parseOptionalInt(raw: string, max: number): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n)) : null;
}

function parseScore1to5(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
}
