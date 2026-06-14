"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  buildAuctionSheetModel,
  type AuctionSheetModel,
} from "@/lib/domain/auction-sheet-model";
import { formatWonWithUnit } from "@/lib/format/won";
import type { AuctionCase } from "@/lib/types/domain";

function dash(v: string | number | null | undefined): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    return v.toLocaleString("ko-KR");
  }
  const s = String(v).trim();
  return s || "—";
}

function won(v: number | null | undefined): string {
  if (v == null) return "—";
  return formatWonWithUnit(v);
}

function SheetCell({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-[15px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-[19px] text-neutral-900 dark:text-neutral-100">{value}</dd>
    </div>
  );
}

function SheetTable({
  title,
  columns,
  rows,
  empty = "데이터 없음",
}: {
  title: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, React.ReactNode>[];
  empty?: string;
}) {
  return (
    <section>
      <h3 className="border-b border-neutral-300 bg-neutral-100 px-2 py-1 text-[17px] font-semibold dark:border-neutral-700 dark:bg-neutral-900">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="px-2 py-2 text-[17px] text-neutral-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[17px]">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-2 py-1.5 font-medium text-neutral-600 dark:text-neutral-400 ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-100 dark:border-neutral-800/80"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-2 py-1.5 tabular-nums ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AuctionSheetContent({ sheet }: { sheet: AuctionSheetModel }) {
  const minRate =
    sheet.minPriceRatePct != null
      ? `${sheet.minPriceRatePct}%`
      : sheet.appraisalTotal != null && sheet.minPrice != null
        ? `${Math.round((sheet.minPrice / sheet.appraisalTotal) * 1000) / 10}%`
        : "—";

  return (
    <article className="mx-auto w-full max-w-[1024px] overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
      {/* 헤더 — 경매 PDF 상단 */}
      <header className="border-b-2 border-neutral-800 bg-neutral-50 px-4 py-3 dark:border-neutral-200 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[23px] font-bold tracking-tight">
              {dash(sheet.court) || "법원 미상"}
            </p>
            <p className="mt-0.5 text-[21px] font-semibold text-neutral-800 dark:text-neutral-200">
              {dash(sheet.caseNumber)}
              {sheet.auctionType ? ` (${sheet.auctionType})` : ""}
            </p>
            {(sheet.auctionDivision || sheet.contactPhone) && (
              <p className="mt-1 text-[17px] text-neutral-600 dark:text-neutral-400">
                {[sheet.auctionDivision, sheet.contactPhone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="text-right text-[19px]">
            <p>
              <span className="text-neutral-500">매각기일 </span>
              <strong>{dash(sheet.bidDate)}</strong>
            </p>
            <p className="mt-1">
              <span className="text-neutral-500">최저 </span>
              <strong>{won(sheet.minPrice)}</strong>
              <span className="ml-1 text-neutral-500">({minRate})</span>
            </p>
            <p className="mt-1">
              <span className="text-neutral-500">감정 </span>
              <strong>{won(sheet.appraisalTotal)}</strong>
            </p>
          </div>
        </div>
        {sheet.sourceSite && (
          <p className="mt-2 text-[15px] text-neutral-500">출처: {sheet.sourceSite}</p>
        )}
      </header>

      <div className="grid gap-0 border-b border-neutral-200 lg:grid-cols-2 dark:border-neutral-800">
        <dl className="grid grid-cols-2 gap-3 border-b border-neutral-200 p-3 lg:border-b-0 lg:border-r dark:border-neutral-800">
          <SheetCell label="소재지" value={dash(sheet.addressFull)} className="col-span-2" />
          {sheet.addressJibun && (
            <SheetCell label="지번" value={sheet.addressJibun} className="col-span-2" />
          )}
          {sheet.addressRoad && (
            <SheetCell label="도로명" value={sheet.addressRoad} className="col-span-2" />
          )}
          <SheetCell label="물건종류" value={dash(sheet.propertyType)} />
          <SheetCell label="용도지역" value={dash(sheet.zoning)} />
          <SheetCell label="토지면적" value={`${dash(sheet.landAreaSqm)} ㎡`} />
          <SheetCell label="연면적" value={`${dash(sheet.buildingAreaSqm)} ㎡`} />
          {sheet.saleTarget && (
            <SheetCell label="매각조건" value={sheet.saleTarget} className="col-span-2" />
          )}
        </dl>
        <dl className="grid grid-cols-2 gap-3 p-3">
          <SheetCell label="소유자" value={dash(sheet.owner)} />
          <SheetCell label="채무자" value={dash(sheet.debtor)} />
          <SheetCell label="채권자" value={dash(sheet.creditor)} />
          <SheetCell label="청구금액" value={won(sheet.claimAmount)} />
          <SheetCell label="말소기준" value={dash(sheet.lienBaseline)} className="col-span-2" />
        </dl>
      </div>

      {/* 감정가 breakdown */}
      <section className="border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="border-b border-neutral-300 bg-neutral-100 px-2 py-1 text-[17px] font-semibold dark:border-neutral-700 dark:bg-neutral-900">
          감정가
        </h3>
        <div className="grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-4 dark:bg-neutral-800">
          {[
            { label: "토지", value: won(sheet.landAppraisal) },
            { label: "건물", value: won(sheet.buildingAppraisal) },
            { label: "제시외", value: won(sheet.ancillaryAppraisal) },
            { label: "합계", value: won(sheet.appraisalTotal) },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white px-3 py-2 text-center dark:bg-neutral-950"
            >
              <p className="text-[15px] text-neutral-500">{item.label}</p>
              <p className="text-[19px] font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <SheetTable
        title="층별 현황"
        columns={[
          { key: "floor", label: "층" },
          { key: "use", label: "용도" },
          { key: "units", label: "호수", align: "right" },
          { key: "area", label: "면적(㎡)", align: "right" },
          { key: "price", label: "감정가", align: "right" },
        ]}
        rows={sheet.floors.map((f) => ({
          floor: f.floor,
          use: f.useType,
          units: f.unitCount > 1 ? `${f.unitCount}개호` : "—",
          area: f.areaSqm != null ? f.areaSqm.toLocaleString("ko-KR") : "—",
          price: won(f.appraisalPrice),
        }))}
      />

      <SheetTable
        title="입찰 일정"
        columns={[
          { key: "round", label: "구분" },
          { key: "date", label: "입찰기일" },
          { key: "price", label: "최저매각가격", align: "right" },
          { key: "result", label: "결과" },
        ]}
        rows={sheet.schedules.map((s) => ({
          round: (
            <span className={s.isCurrent ? "font-semibold text-emerald-700 dark:text-emerald-400" : ""}>
              {s.round || "—"}
              {s.isCurrent ? " ★" : ""}
            </span>
          ),
          date: s.date,
          price: won(s.minimumPrice),
          result: s.result || "—",
        }))}
      />

      <SheetTable
        title={`임차인 현황 (${sheet.tenants.length}명)`}
        columns={[
          { key: "rank", label: "순위", align: "right" },
          { key: "name", label: "성명" },
          { key: "unit", label: "호실" },
          { key: "deposit", label: "보증금", align: "right" },
          { key: "rent", label: "월세", align: "right" },
        ]}
        rows={sheet.tenants.map((t) => ({
          rank: t.rank,
          name: t.name || "—",
          unit: t.unit || "—",
          deposit: won(t.deposit),
          rent: won(t.monthlyRent),
        }))}
        empty="임차인 정보 없음"
      />
      {(sheet.tenantDepositTotal != null || sheet.tenantMonthlyRentTotal != null) && (
        <p className="border-b border-neutral-200 px-3 py-1.5 text-[17px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          보증금 합계 {won(sheet.tenantDepositTotal)} · 월세 합계{" "}
          {won(sheet.tenantMonthlyRentTotal)}
        </p>
      )}

      <div className="grid gap-0 lg:grid-cols-2">
        <SheetTable
          title={`건물 등기 (${sheet.buildingRights.length}건)`}
          columns={[
            { key: "no", label: "순위" },
            { key: "date", label: "접수" },
            { key: "type", label: "종류" },
            { key: "holder", label: "권리자" },
            { key: "amount", label: "금액", align: "right" },
          ]}
          rows={sheet.buildingRights.map((r) => ({
            no: r.no,
            date: r.date,
            type: r.type,
            holder: r.holder,
            amount: won(r.amount),
          }))}
        />
        <SheetTable
          title={`토지 등기 (${sheet.landRights.length}건)`}
          columns={[
            { key: "no", label: "순위" },
            { key: "date", label: "접수" },
            { key: "type", label: "종류" },
            { key: "holder", label: "권리자" },
            { key: "amount", label: "금액", align: "right" },
          ]}
          rows={sheet.landRights.map((r) => ({
            no: r.no,
            date: r.date,
            type: r.type,
            holder: r.holder,
            amount: won(r.amount),
          }))}
        />
      </div>

      {/* 건축·주차 요약 */}
      <footer className="grid grid-cols-2 gap-px border-t border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6 dark:border-neutral-800 dark:bg-neutral-800">
        {[
          { label: "총 호수", value: dash(sheet.householdCount) },
          {
            label: "주택/상가",
            value:
              sheet.residentialUnitCount != null || sheet.commercialUnitCount != null
                ? `${dash(sheet.residentialUnitCount)} / ${dash(sheet.commercialUnitCount)}`
                : "—",
          },
          { label: "주차", value: dash(sheet.parkingUnitCount) },
          { label: "건폐율", value: dash(sheet.buildingCoverageRatio) },
          { label: "용적률", value: dash(sheet.floorAreaRatio) },
          { label: "사용승인", value: dash(sheet.builtYear) },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-white px-2 py-2 text-center dark:bg-neutral-950"
          >
            <p className="text-[15px] text-neutral-500">{item.label}</p>
            <p className="text-[17px] font-medium">{item.value}</p>
          </div>
        ))}
      </footer>

      {sheet.notes && (
        <details className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <summary className="cursor-pointer text-[17px] font-medium text-neutral-600 dark:text-neutral-400">
            물건비고 · 기타
          </summary>
          <pre className="mt-2 whitespace-pre-wrap text-[17px] text-neutral-700 dark:text-neutral-300">
            {sheet.notes}
          </pre>
        </details>
      )}
    </article>
  );
}

type Props = {
  caseData: AuctionCase;
};

export function CaseAuctionSheetView({ caseData }: Props) {
  const sheet = useMemo(() => buildAuctionSheetModel(caseData), [caseData]);

  if (!sheet.hasPdf && !sheet.caseNumber && !sheet.addressFull) {
    return (
      <div className="mx-auto w-full max-w-[1024px] rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center dark:border-neutral-700 dark:bg-neutral-900/40">
        <p className="text-[17px] text-neutral-600 dark:text-neutral-400">
          등록된 경매 PDF가 없습니다.
        </p>
        <Link
          href="/cases/import"
          className="mt-3 inline-block text-[17px] font-medium text-neutral-800 underline dark:text-neutral-200"
        >
          PDF 등록 메뉴에서 추가하기
        </Link>
      </div>
    );
  }

  return <AuctionSheetContent sheet={sheet} />;
}
