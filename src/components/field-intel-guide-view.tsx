"use client";

import { TABLE_COMPACT, TC_MONEY, TC_TD, TC_TH } from "@/lib/ui/compact-table";
import type {
  FieldIntelAuctionRow,
  FieldIntelGuide,
  FieldIntelRentRow,
  FieldIntelSection,
} from "@/lib/domain/field-intel";

function isRentTable(
  table: FieldIntelRentRow[] | FieldIntelAuctionRow[],
): table is FieldIntelRentRow[] {
  return table.length === 0 || "unitType" in table[0]!;
}

function SectionBlock({ section }: { section: FieldIntelSection }) {
  return (
    <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="font-semibold">{section.title}</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
        {section.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {section.table && section.table.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          {isRentTable(section.table) ? (
            <table className={TABLE_COMPACT}>
              <thead>
                <tr className="border-b text-neutral-500">
                  <th className={`${TC_TH} w-20`}>유형</th>
                  <th className={`${TC_TH} ${TC_MONEY}`}>보증금</th>
                  <th className={`${TC_TH} w-[4.5rem]`}>월세</th>
                  <th className={TC_TH}>비고</th>
                </tr>
              </thead>
              <tbody>
                {section.table.map((row) => (
                  <tr
                    key={row.unitType}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className={`${TC_TD} w-20 font-medium`}>{row.unitType}</td>
                    <td className={`${TC_TD} ${TC_MONEY}`}>{row.deposit}</td>
                    <td className={`${TC_TD} w-[4.5rem]`}>{row.monthlyRent}</td>
                    <td className={`${TC_TD} text-neutral-600 dark:text-neutral-400`}>
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={TABLE_COMPACT}>
              <thead>
                <tr className="border-b text-neutral-500">
                  <th className={`${TC_TH} w-24`}>구분</th>
                  <th className={`${TC_TH} ${TC_MONEY}`}>금액</th>
                  <th className={TC_TH}>사장 의견</th>
                </tr>
              </thead>
              <tbody>
                {section.table.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-neutral-100 dark:border-neutral-800"
                  >
                    <td className={`${TC_TD} w-24 font-medium`}>{row.label}</td>
                    <td className={`${TC_TD} ${TC_MONEY}`}>{row.amount}</td>
                    <td className={`${TC_TD} text-neutral-600 dark:text-neutral-400`}>
                      {row.opinion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

export function FieldIntelGuideView({ guide }: { guide: FieldIntelGuide }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs text-neutral-500">
          {guide.exploredAt} · {guide.duration} · {guide.participants}
        </p>
        <h2 className="text-xl font-semibold">{guide.title}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {guide.subtitle}
        </p>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          한눈에 보기
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950 dark:text-amber-100">
          {guide.summaryBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {guide.sections.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}
    </div>
  );
}
