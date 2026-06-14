"use client";

import {
  Fragment,
  useEffect,
  useState,
  type ComponentType,
  type InputHTMLAttributes,
} from "react";
import type { TenantDistributionView } from "@/lib/domain/tenant-dividend-display";
import { numberValue, textValue } from "@/lib/domain/case-document-payload";
import {
  TenantDateDetailGrid,
  TenantDateSummary,
} from "@/components/tenant/tenant-date-ui";
import { formatWonDigits, parseWonInput } from "@/lib/format/won";
import {
  TABLE_COMPACT,
  TC_ACTION,
  TC_DATE,
  TC_MONEY,
  TC_MONEY_SM,
  TC_NAME,
  TC_AREA,
  TC_SELECT,
  TC_TD,
  TC_TH,
  TC_UNIT,
} from "@/lib/ui/compact-table";

const SELECT =
  "w-full min-w-0 rounded border border-neutral-200 px-1.5 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900";

export type TenantDisplayRow = {
  tenant: Record<string, unknown>;
  originalIndex: number;
  distribution: TenantDistributionView;
};

type Option = { value: string; label: string };

type Props = {
  rows: TenantDisplayRow[];
  expandedKey: string | null;
  onExpandedKeyChange: (key: string | null) => void;
  occupancyOptions: readonly Option[];
  contractIntentOptions: readonly Option[];
  roomTypeOptions: readonly string[];
  fieldOccupancyValue: (raw: unknown) => string;
  fieldContractIntentValue: (raw: unknown) => string;
  onUpdateField: (index: number, field: string, value: unknown) => void;
  onDeleteRow: (index: number) => void;
  parseAreaSqm: (raw: string) => number | null;
  wonValue: (v: unknown) => string;
  tenantNameTone: (args: {
    tenantName: string;
    distribution: TenantDistributionView;
    isHousingCorp: boolean;
  }) => "risk" | "success" | "warning" | undefined;
  isHousingCorp: (name: string) => boolean;
  DistributionBadge: ComponentType<{
    distribution: TenantDistributionView | undefined;
  }>;
  RiskFlag: ComponentType<{ value: unknown }>;
};

function TenantInlineInput({
  value,
  onChange,
  placeholder,
  inputMode,
  tone,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  tone?: "risk" | "success" | "warning";
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onChange(draft);
  };
  const toneClass =
    tone === "risk"
      ? "border-rose-300 font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-400"
      : tone === "success"
        ? "border-emerald-300 font-semibold text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
        : tone === "warning"
          ? "border-amber-300 font-semibold text-amber-800 dark:border-amber-800 dark:text-amber-200"
          : "border-neutral-200 dark:border-neutral-800";
  return (
    <input
      inputMode={inputMode}
      className={`w-full min-w-0 rounded border px-1.5 py-1 text-xs tabular-nums dark:bg-neutral-900 ${toneClass}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
    />
  );
}

export function TenantAnalysisCompactTable({
  rows,
  expandedKey,
  onExpandedKeyChange,
  occupancyOptions,
  contractIntentOptions,
  roomTypeOptions,
  fieldOccupancyValue,
  fieldContractIntentValue,
  onUpdateField,
  onDeleteRow,
  parseAreaSqm,
  wonValue,
  tenantNameTone,
  isHousingCorp,
  DistributionBadge,
  RiskFlag,
}: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500 dark:bg-neutral-900">
        임차인 목록이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className={TABLE_COMPACT}>
        <thead className="sticky top-0 z-[1] bg-neutral-50 text-[11px] text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className={`${TC_TH} ${TC_UNIT}`}>호실</th>
            <th className={`${TC_TH} ${TC_NAME}`}>입주자</th>
            <th className={`${TC_TH} ${TC_SELECT}`}>점유</th>
            <th className={`${TC_TH} ${TC_SELECT}`}>계약</th>
            <th className={`${TC_TH} ${TC_SELECT}`}>룸</th>
            <th className={`${TC_TH} ${TC_AREA}`}>㎡</th>
            <th className={`${TC_TH} ${TC_MONEY}`}>보증금</th>
            <th className={`${TC_TH} ${TC_MONEY_SM}`}>월세</th>
            <th className={`${TC_TH} ${TC_MONEY}`}>배당</th>
            <th className={`${TC_TH} w-[4rem]`}>권리</th>
            <th className={`${TC_TH} ${TC_DATE}`}>날짜</th>
            <th className={`${TC_TH} ${TC_ACTION}`} />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ tenant, originalIndex, distribution }) => {
            const noDividendRequest = !textValue(tenant.dividend_request_date);
            const roomType = textValue(tenant.room_type);
            const deposit = numberValue(tenant.deposit);
            const monthlyRent = numberValue(tenant.monthly_rent);
            const tenantTone =
              tenantNameTone({
                tenantName: textValue(tenant.name),
                distribution,
                isHousingCorp: isHousingCorp(textValue(tenant.name)),
              }) ?? (noDividendRequest ? "risk" : undefined);
            const rowKey = `row-${textValue(tenant.unit) || "unit"}-${originalIndex}`;
            const expanded = expandedKey === rowKey;
            const notePlaceholder =
              [
                textValue(tenant.business_name),
                tenant.converted_deposit != null
                  ? `환산 ${wonValue(tenant.converted_deposit)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ") || "메모";

            return (
              <Fragment key={rowKey}>
                <tr
                  className={`border-t border-neutral-100 dark:border-neutral-900 ${
                    noDividendRequest ? "bg-rose-50/30 dark:bg-rose-950/10" : ""
                  }`}
                >
                  <td className={`${TC_TD} ${TC_UNIT} font-medium`}>
                    <span
                      className={
                        noDividendRequest
                          ? "text-rose-700 dark:text-rose-400"
                          : ""
                      }
                    >
                      {textValue(tenant.unit) || "—"}
                    </span>
                  </td>
                  <td className={`${TC_TD} ${TC_NAME}`}>
                    <TenantInlineInput
                      value={textValue(tenant.name)}
                      onChange={(v) => onUpdateField(originalIndex, "name", v)}
                      placeholder="입주자"
                      tone={tenantTone}
                    />
                  </td>
                  <td className={`${TC_TD} ${TC_SELECT}`}>
                    <select
                      className={SELECT}
                      value={fieldOccupancyValue(tenant.field_occupancy_status)}
                      onChange={(e) =>
                        onUpdateField(
                          originalIndex,
                          "field_occupancy_status",
                          e.target.value,
                        )
                      }
                    >
                      {occupancyOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${TC_TD} ${TC_SELECT}`}>
                    <select
                      className={SELECT}
                      value={fieldContractIntentValue(tenant.field_contract_intent)}
                      onChange={(e) =>
                        onUpdateField(
                          originalIndex,
                          "field_contract_intent",
                          e.target.value,
                        )
                      }
                    >
                      {contractIntentOptions.map((o) => (
                        <option key={o.value || "auto"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${TC_TD} ${TC_SELECT}`}>
                    <select
                      className={SELECT}
                      value={roomType}
                      onChange={(e) =>
                        onUpdateField(originalIndex, "room_type", e.target.value)
                      }
                    >
                      {roomTypeOptions.map((option) => (
                        <option key={option || "empty"} value={option}>
                          {option || "—"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${TC_TD} ${TC_AREA}`}>
                    <TenantInlineInput
                      value={
                        numberValue(tenant.area_sqm) != null
                          ? String(numberValue(tenant.area_sqm))
                          : ""
                      }
                      onChange={(v) =>
                        onUpdateField(
                          originalIndex,
                          "area_sqm",
                          parseAreaSqm(v),
                        )
                      }
                      placeholder="㎡"
                      inputMode="decimal"
                    />
                  </td>
                  <td className={`${TC_TD} ${TC_MONEY}`}>
                    <TenantInlineInput
                      value={deposit != null ? formatWonDigits(deposit) : ""}
                      onChange={(v) =>
                        onUpdateField(originalIndex, "deposit", parseWonInput(v))
                      }
                      placeholder="보증금"
                      inputMode="numeric"
                      tone={
                        /원룸/.test(roomType) &&
                        deposit != null &&
                        deposit < 50_000_000
                          ? "risk"
                          : undefined
                      }
                    />
                  </td>
                  <td className={`${TC_TD} ${TC_MONEY_SM}`}>
                    <TenantInlineInput
                      value={monthlyRent != null ? formatWonDigits(monthlyRent) : ""}
                      onChange={(v) =>
                        onUpdateField(
                          originalIndex,
                          "monthly_rent",
                          parseWonInput(v),
                        )
                      }
                      placeholder="월세"
                      inputMode="numeric"
                      tone={
                        monthlyRent != null && monthlyRent < 400_000
                          ? "risk"
                          : undefined
                      }
                    />
                  </td>
                  <td className={`${TC_TD} ${TC_MONEY}`}>
                    <DistributionBadge distribution={distribution} />
                    <p className="mt-0.5 tabular-nums text-[10px] text-neutral-500">
                      {distribution.estimatedAmount != null
                        ? wonValue(distribution.estimatedAmount)
                        : "—"}
                    </p>
                  </td>
                  <td className={`${TC_TD} w-[4rem] text-[10px] whitespace-nowrap`}>
                    <span className="text-neutral-500">대항</span>{" "}
                    <RiskFlag value={tenant.has_opposing_power} />
                    <br />
                    <span className="text-neutral-500">임차</span>{" "}
                    <RiskFlag value={tenant.lien_registered} />
                  </td>
                  <td className={`${TC_TD} ${TC_DATE}`}>
                    <TenantDateSummary
                      moveIn={
                        textValue(tenant.move_in_date) ||
                        textValue(tenant.business_registration_date)
                      }
                      confirmed={textValue(tenant.confirmed_date)}
                      dividend={textValue(tenant.dividend_request_date)}
                      highlightMissingDividend={noDividendRequest}
                    />
                  </td>
                  <td className={`${TC_TD} ${TC_ACTION} text-center`}>
                    <button
                      type="button"
                      className="text-[10px] text-sky-700 underline dark:text-sky-300"
                      onClick={() =>
                        onExpandedKeyChange(expanded ? null : rowKey)
                      }
                    >
                      {expanded ? "닫기" : "상세"}
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-t border-neutral-100 bg-neutral-50/70 dark:border-neutral-900 dark:bg-neutral-900/30">
                    <td colSpan={12} className="px-2 py-2">
                      <TenantDateDetailGrid
                        moveIn={textValue(tenant.move_in_date)}
                        businessDate={textValue(tenant.business_registration_date)}
                        confirmed={textValue(tenant.confirmed_date)}
                        dividend={textValue(tenant.dividend_request_date)}
                        notes={textValue(tenant.notes)}
                        notesPlaceholder={notePlaceholder}
                        onMoveInChange={(v) =>
                          onUpdateField(originalIndex, "move_in_date", v || null)
                        }
                        onBusinessDateChange={(v) =>
                          onUpdateField(
                            originalIndex,
                            "business_registration_date",
                            v || null,
                          )
                        }
                        onConfirmedChange={(v) =>
                          onUpdateField(originalIndex, "confirmed_date", v || null)
                        }
                        onDividendChange={(v) =>
                          onUpdateField(
                            originalIndex,
                            "dividend_request_date",
                            v || null,
                          )
                        }
                        onNotesChange={(v) =>
                          onUpdateField(originalIndex, "notes", v || null)
                        }
                        extra={
                          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-4">
                            <button
                              type="button"
                              className="text-xs text-rose-600"
                              onClick={() => onDeleteRow(originalIndex)}
                            >
                              삭제
                            </button>
                          </div>
                        }
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
