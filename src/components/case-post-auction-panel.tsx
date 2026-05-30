"use client";

import { useState } from "react";
import type { AuctionCase, PostAuctionWorkflow } from "@/lib/types/domain";
import {
  buildPostAuctionPackageHtml,
  POST_AUCTION_PACKAGES,
  type PostAuctionPackageId,
} from "@/lib/domain/case-workflow";
import { AutoGrowTextarea } from "@/components/auto-grow-textarea";

type Props = {
  caseData: AuctionCase;
  activePackageId?: PostAuctionPackageId | null;
  onSave: (patch: { postAuction: PostAuctionWorkflow }) => void;
};

export function CasePostAuctionPanel({
  caseData,
  activePackageId,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(caseData.postAuction);
  const [section, setSection] = useState<PostAuctionPackageId>(
    activePackageId ?? "loan",
  );

  const save = () => {
    onSave({ postAuction: draft });
  };

  const exportHtml = (packageId: PostAuctionPackageId) => {
    const html = buildPostAuctionPackageHtml(
      { ...caseData, postAuction: draft },
      packageId,
    );
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const pkgMeta = POST_AUCTION_PACKAGES.find((p) => p.id === section)!;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div>
        <h2 className="text-lg font-semibold">후반부 패키지</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          낙찰 후 대출·명도·임대·리모델링(선택) 실행 자료를 묶어 관리합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {POST_AUCTION_PACKAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSection(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              section === p.id
                ? "bg-violet-700 text-white"
                : "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.remodelingEnabled}
          onChange={(e) =>
            setDraft((d) => ({ ...d, remodelingEnabled: e.target.checked }))
          }
        />
        리모델링 패키지 사용 (선택)
      </label>

      <p className="text-xs text-neutral-500">{pkgMeta.summary}</p>

      {section === "loan" && (
        <PackageFields
          fields={[
            {
              label: "사전 한도·한도 조회",
              value: draft.loanPackage.preApprovalNotes,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  loanPackage: { ...d.loanPackage, preApprovalNotes: v },
                })),
            },
            {
              label: "실행 대출 (낙찰 후)",
              value: draft.loanPackage.executionNotes,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  loanPackage: { ...d.loanPackage, executionNotes: v },
                })),
            },
            {
              label: "메모",
              value: draft.loanPackage.memo,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  loanPackage: { ...d.loanPackage, memo: v },
                })),
            },
          ]}
        />
      )}

      {section === "eviction" && (
        <PackageFields
          fields={[
            {
              label: "세입자·점유 현황 요약",
              value: draft.evictionPackage.tenantSummary,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  evictionPackage: { ...d.evictionPackage, tenantSummary: v },
                })),
            },
            {
              label: "명도 계획·일정",
              value: draft.evictionPackage.planNotes,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  evictionPackage: { ...d.evictionPackage, planNotes: v },
                })),
            },
            {
              label: "메모",
              value: draft.evictionPackage.memo,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  evictionPackage: { ...d.evictionPackage, memo: v },
                })),
            },
          ]}
        />
      )}

      {section === "leasing" && (
        <PackageFields
          fields={[
            {
              label: "목표 임대·호실별 계획",
              value: draft.leasingPackage.targetRentNotes,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  leasingPackage: { ...d.leasingPackage, targetRentNotes: v },
                })),
            },
            {
              label: "마케팅·공실 대응",
              value: draft.leasingPackage.marketingNotes,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  leasingPackage: { ...d.leasingPackage, marketingNotes: v },
                })),
            },
            {
              label: "메모",
              value: draft.leasingPackage.memo,
              onChange: (v) =>
                setDraft((d) => ({
                  ...d,
                  leasingPackage: { ...d.leasingPackage, memo: v },
                })),
            },
          ]}
        />
      )}

      {section === "remodeling" && (
        <>
          {!draft.remodelingEnabled && (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              리모델링 패키지가 비활성화되어 있습니다. 위 체크박스로 켜세요.
            </p>
          )}
          <PackageFields
            fields={[
              {
                label: "공사 범위",
                value: draft.remodelingPackage.scopeNotes,
                onChange: (v) =>
                  setDraft((d) => ({
                    ...d,
                    remodelingPackage: { ...d.remodelingPackage, scopeNotes: v },
                  })),
              },
              {
                label: "예산·일정",
                value: draft.remodelingPackage.budgetNotes,
                onChange: (v) =>
                  setDraft((d) => ({
                    ...d,
                    remodelingPackage: {
                      ...d.remodelingPackage,
                      budgetNotes: v,
                    },
                  })),
              },
              {
                label: "메모",
                value: draft.remodelingPackage.memo,
                onChange: (v) =>
                  setDraft((d) => ({
                    ...d,
                    remodelingPackage: { ...d.remodelingPackage, memo: v },
                  })),
              },
            ]}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          패키지 저장
        </button>
        <button
          type="button"
          onClick={() => exportHtml(section)}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          {pkgMeta.label} HTML/PDF
        </button>
      </div>
    </section>
  );
}

function PackageFields({
  fields,
}: {
  fields: { label: string; value: string; onChange: (v: string) => void }[];
}) {
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <label key={f.label} className="block text-xs font-medium text-neutral-500">
          {f.label}
          <AutoGrowTextarea
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
