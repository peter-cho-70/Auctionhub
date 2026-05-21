import type { CaseAddressMeta } from "@/lib/types/domain";
import { emptyCaseAddressMeta } from "@/lib/types/domain";
import { buildPnuFromParcel } from "@/lib/address/pnu";
import { inferGuFromAddressText, DAEJEON_GU_LAWD_CODES } from "@/lib/address/lawd-code";

export type JusoApiRow = {
  roadAddr?: string;
  jibunAddr?: string;
  admCd?: string;
  zipNo?: string;
  siNm?: string;
  sggNm?: string;
  emdNm?: string;
  lnbrMnnm?: string;
  lnbrSlno?: string;
  mtYn?: string;
  entX?: string;
  entY?: string;
};

function parseLotNumber(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = parseInt(String(value).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function displayAddressFromJuso(row: JusoApiRow): string {
  const jibun = (row.jibunAddr ?? "").trim();
  const road = (row.roadAddr ?? "").trim();
  if (jibun && road && jibun !== road) return `${jibun} (${road})`;
  return jibun || road;
}

export function caseAddressMetaFromJuso(row: JusoApiRow): CaseAddressMeta {
  const base = emptyCaseAddressMeta();
  const roadAddress = (row.roadAddr ?? "").trim() || null;
  const jibunAddress = (row.jibunAddr ?? "").trim() || null;
  const legalDongCode = (row.admCd ?? "").replace(/\D/g, "").slice(0, 10) || null;
  const bonbun = parseLotNumber(row.lnbrMnnm);
  const bubun = parseLotNumber(row.lnbrSlno) ?? 0;
  const isMountain = row.mtYn === "1";
  const pnu =
    legalDongCode && bonbun != null
      ? buildPnuFromParcel(legalDongCode, bonbun, bubun, isMountain)
      : null;

  const guText = `${row.siNm ?? ""} ${row.sggNm ?? ""} ${roadAddress ?? ""} ${jibunAddress ?? ""}`;
  const gu = inferGuFromAddressText(guText);
  const molitLawdCode = gu ? (DAEJEON_GU_LAWD_CODES[gu] ?? null) : null;

  return {
    ...base,
    roadAddress,
    jibunAddress,
    legalDongCode,
    siNm: (row.siNm ?? "").trim() || null,
    sggNm: (row.sggNm ?? "").trim() || null,
    emdNm: (row.emdNm ?? "").trim() || null,
    zipNo: (row.zipNo ?? "").trim() || null,
    bonbun,
    bubun,
    pnu,
    molitLawdCode,
    entX: (row.entX ?? "").trim() || null,
    entY: (row.entY ?? "").trim() || null,
    resolvedAt: new Date().toISOString(),
  };
}

export function normalizeCaseAddressMeta(raw: unknown): CaseAddressMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const legalDongCode =
    typeof o.legalDongCode === "string"
      ? o.legalDongCode.replace(/\D/g, "").slice(0, 10) || null
      : null;
  const bonbun =
    typeof o.bonbun === "number" && Number.isFinite(o.bonbun)
      ? Math.max(0, Math.floor(o.bonbun))
      : null;
  const bubun =
    typeof o.bubun === "number" && Number.isFinite(o.bubun)
      ? Math.max(0, Math.floor(o.bubun))
      : null;
  const pnuRaw = typeof o.pnu === "string" ? o.pnu.replace(/\D/g, "") : "";
  const pnu =
    pnuRaw.length === 19
      ? pnuRaw
      : legalDongCode && bonbun != null
        ? buildPnuFromParcel(legalDongCode, bonbun, bubun ?? 0, false)
        : null;

  const meta: CaseAddressMeta = {
    roadAddress: typeof o.roadAddress === "string" ? o.roadAddress.trim() || null : null,
    jibunAddress: typeof o.jibunAddress === "string" ? o.jibunAddress.trim() || null : null,
    legalDongCode,
    siNm: typeof o.siNm === "string" ? o.siNm.trim() || null : null,
    sggNm: typeof o.sggNm === "string" ? o.sggNm.trim() || null : null,
    emdNm: typeof o.emdNm === "string" ? o.emdNm.trim() || null : null,
    zipNo: typeof o.zipNo === "string" ? o.zipNo.trim() || null : null,
    bonbun,
    bubun,
    pnu,
    molitLawdCode:
      typeof o.molitLawdCode === "string" && /^\d{5}$/.test(o.molitLawdCode.trim())
        ? o.molitLawdCode.trim()
        : null,
    entX: typeof o.entX === "string" ? o.entX.trim() || null : null,
    entY: typeof o.entY === "string" ? o.entY.trim() || null : null,
    resolvedAt: typeof o.resolvedAt === "string" ? o.resolvedAt : null,
  };

  if (
    !meta.roadAddress &&
    !meta.jibunAddress &&
    !meta.legalDongCode &&
    !meta.resolvedAt
  ) {
    return null;
  }

  if (!meta.molitLawdCode) {
    const gu = inferGuFromAddressText(
      `${meta.siNm ?? ""} ${meta.sggNm ?? ""} ${meta.roadAddress ?? ""} ${meta.jibunAddress ?? ""}`,
    );
    meta.molitLawdCode = gu ? (DAEJEON_GU_LAWD_CODES[gu] ?? null) : null;
  }

  return meta;
}
