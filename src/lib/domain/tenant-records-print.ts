import { formatWonWithUnit } from "@/lib/format/won";
import {
  refreshTenantRecordsFromCase,
  TENANT_DIVIDEND_STATUS_LABEL,
} from "@/lib/domain/case-tenant-records";
import {
  distributionStatusLabel,
  getExpectedDividendFromDocuments,
  tenantRecordNameTone,
} from "@/lib/domain/tenant-dividend-display";
import type { AuctionCase, CaseTenantRecord } from "@/lib/types/domain";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function won(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("ko-KR")}원`;
}

function dateLabel(raw: string): string {
  const v = raw.trim().slice(0, 10);
  return v || "—";
}

function toneStyle(tone: ReturnType<typeof tenantRecordNameTone>): string {
  if (tone === "success") return "color:#047857;font-weight:700;";
  if (tone === "warning") return "color:#b45309;font-weight:700;";
  if (tone === "risk") return "color:#be123c;font-weight:700;";
  return "font-weight:600;";
}

function statusBadge(record: CaseTenantRecord): string {
  const label =
    record.dividendStatus === "unknown"
      ? distributionStatusLabel(
          record.dividendRequestDate
            ? "unknown"
            : (record.deposit ?? 0) > 0
              ? "no_request"
              : "unknown",
        )
      : TENANT_DIVIDEND_STATUS_LABEL[record.dividendStatus];
  const bg =
    record.dividendStatus === "full"
      ? "#d1fae5"
      : record.dividendStatus === "partial"
        ? "#fef3c7"
        : record.dividendStatus === "none"
          ? "#ffe4e6"
          : "#f3f4f6";
  const color =
    record.dividendStatus === "full"
      ? "#047857"
      : record.dividendStatus === "partial"
        ? "#b45309"
        : record.dividendStatus === "none"
          ? "#be123c"
          : "#4b5563";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:600;">${escapeHtml(label)}</span>`;
}

function summarizeRecords(records: CaseTenantRecord[]) {
  return {
    full: records.filter((r) => r.dividendStatus === "full").length,
    partial: records.filter((r) => r.dividendStatus === "partial").length,
    none: records.filter((r) => r.dividendStatus === "none").length,
    unknown: records.filter((r) => r.dividendStatus === "unknown").length,
  };
}

function evictionPriorityList(records: CaseTenantRecord[]): CaseTenantRecord[] {
  const rank = (r: CaseTenantRecord) => {
    if (r.dividendStatus === "none") return 0;
    if (r.dividendStatus === "partial") return 1;
    if (r.dividendStatus === "unknown" && (r.deposit ?? 0) > 0) return 2;
    return 3;
  };
  return [...records]
    .filter((r) => r.occupantName.trim() || (r.deposit ?? 0) > 0)
    .sort((a, b) => rank(a) - rank(b) || a.unit.localeCompare(b.unit, "ko"));
}

export function buildTenantRecordsPrintHtml(c: AuctionCase): string {
  const records = refreshTenantRecordsFromCase(c);
  const expected = getExpectedDividendFromDocuments(c.sourceDocuments);
  const bidPrice = expected?.bid_price ?? c.expectedBidPrice ?? c.minPrice;
  const summary = summarizeRecords(records);
  const priority = evictionPriorityList(records);
  const generatedAt = new Date().toLocaleString("ko-KR");

  const tableRows = records
    .map((r) => {
      const tone = tenantRecordNameTone(r);
      const rowBg =
        r.hasOpposingPower === true
          ? "background:#fff1f2;"
          : tone === "success"
            ? "background:#f0fdf4;"
            : tone === "warning"
              ? "background:#fffbeb;"
              : tone === "risk"
                ? "background:#fff1f2;"
                : "";
      return `<tr style="${rowBg}">
        <td>${escapeHtml(r.unit || "—")}</td>
        <td style="${toneStyle(tone)}">${escapeHtml(r.occupantName || "—")}</td>
        <td style="text-align:right;">${won(r.deposit)}</td>
        <td style="text-align:right;">${won(r.monthlyRent)}</td>
        <td>${dateLabel(r.moveInDate)}</td>
        <td>${dateLabel(r.confirmedDate)}</td>
        <td>${dateLabel(r.dividendRequestDate)}</td>
        <td>${r.hasOpposingPower === true ? "있음" : r.hasOpposingPower === false ? "없음" : "미확인"}</td>
        <td style="text-align:right;">${won(r.dividendAmount)}</td>
        <td style="text-align:right;">${won(r.undividedAmount)}</td>
        <td>${statusBadge(r)}</td>
        <td>${escapeHtml((r.inquiryNotes || r.memo || "").slice(0, 80))}</td>
      </tr>`;
    })
    .join("");

  const priorityList = priority
    .slice(0, 12)
    .map((r, i) => {
      const label = TENANT_DIVIDEND_STATUS_LABEL[r.dividendStatus] || "미확인";
      return `<li>${i + 1}. <strong>${escapeHtml(r.unit || "호실")}</strong> ${escapeHtml(r.occupantName || "—")} — ${escapeHtml(label)} · 보증금 ${won(r.deposit)} · 배당 ${won(r.dividendAmount)}</li>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(c.caseNumber)} 임차인 현황표</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none; } }
    body { font-family: "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .meta { font-size: 13px; color: #444; margin-bottom: 16px; line-height: 1.6; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 18px; }
    .chip { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .chip-full { background: #d1fae5; color: #047857; }
    .chip-partial { background: #fef3c7; color: #b45309; }
    .chip-none { background: #ffe4e6; color: #be123c; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; }
    h2 { font-size: 15px; margin: 24px 0 8px; }
    ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.7; }
    .note { font-size: 12px; color: #6b7280; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>임차인 현황표 (명도 참고)</h1>
  <div class="meta">
    <div><strong>사건번호</strong> ${escapeHtml(c.caseNumber || "—")}</div>
    <div><strong>소재지</strong> ${escapeHtml(c.address || expected?.address || "—")}</div>
    <div><strong>배당 기준 입찰가</strong> ${bidPrice != null ? escapeHtml(formatWonWithUnit(bidPrice)) : "—"}</div>
    <div><strong>출력</strong> ${escapeHtml(generatedAt)}</div>
  </div>
  <div class="chips">
    <span class="chip chip-full">전액 배당 ${summary.full}명</span>
    <span class="chip chip-partial">일부 배당 ${summary.partial}명</span>
    <span class="chip chip-none">미배당 ${summary.none}명</span>
    <span class="chip">미확인 ${summary.unknown}명</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>호실</th>
        <th>권리자</th>
        <th>보증금</th>
        <th>월세</th>
        <th>전입</th>
        <th>확정</th>
        <th>배당요구</th>
        <th>대항력</th>
        <th>배당액</th>
        <th>미배당액</th>
        <th>상태</th>
        <th>비고</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="12">임차인 데이터가 없습니다.</td></tr>`}
    </tbody>
  </table>
  <h2>명도 협의 우선순위 (참고)</h2>
  <p style="font-size:13px;color:#444;margin:0 0 8px;">미배당 → 일부 배당 → 기타 순으로 현장 접촉 우선순위를 정리했습니다.</p>
  <ul>${priorityList || "<li>표시할 임차인이 없습니다.</li>"}</ul>
  <p class="note">예상배당표·매각물건명세서·임장 메모를 함께 확인하세요. 본 문서는 참고용이며 법원 배당표와 다를 수 있습니다.</p>
</body>
</html>`;
}

export function printTenantRecords(c: AuctionCase) {
  const html = buildTenantRecordsPrintHtml(c);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
