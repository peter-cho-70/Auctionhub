"use client";

import {
  parseMarkdownBlocks,
  textHasMarkdownTable,
} from "@/lib/format/markdown-table-preview";

type Props = {
  text: string;
  className?: string;
};

/** 붙여넣은 마크다운 표를 HTML table로 미리보기 */
export function MarkdownTablePreview({ text, className = "" }: Props) {
  if (!text.trim() || !textHasMarkdownTable(text)) return null;

  const blocks = parseMarkdownBlocks(text);

  return (
    <div
      className={`ai-qa-markdown-preview mt-2 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50/80 p-2 dark:border-neutral-800 dark:bg-neutral-900/50 ${className}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        표 미리보기
      </p>
      {blocks.map((block, i) => {
        if (block.type === "text") {
          const trimmed = block.content.trim();
          if (!trimmed) return null;
          return (
            <pre
              key={`t-${i}`}
              className="whitespace-pre-wrap font-mono text-xs text-neutral-700 dark:text-neutral-300"
            >
              {block.content}
            </pre>
          );
        }
        return (
          <div key={`tbl-${i}`} className="overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-left text-xs">
              <thead>
                <tr>
                  {block.headers.map((h, hi) => (
                    <th
                      key={hi}
                      className="border border-neutral-200 bg-neutral-100/90 px-2 py-1.5 font-medium dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {block.headers.map((_, ci) => (
                      <td
                        key={ci}
                        className="border border-neutral-200 px-2 py-1.5 align-top dark:border-neutral-700"
                      >
                        {row[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
