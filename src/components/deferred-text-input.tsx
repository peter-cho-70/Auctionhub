"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import {
  AutoGrowTextarea,
  type AutoGrowTextareaProps,
} from "@/components/auto-grow-textarea";

type CommitProps = {
  value: string;
  onCommit: (value: string) => void;
};

function useDeferredText(value: string, onCommit: (value: string) => void) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(draft);
  const valueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  draftRef.current = draft;
  valueRef.current = value;
  onCommitRef.current = onCommit;

  /* eslint-disable react-hooks/set-state-in-effect -- 외부 저장값과 로컬 초안을 blur/Enter 후 동기화 */
  useEffect(() => {
    setDraft(value);
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    return () => {
      if (draftRef.current !== valueRef.current) {
        onCommitRef.current(draftRef.current);
      }
    };
  }, []);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return { draft, setDraft, commit };
}

export function DeferredInput({
  value,
  onCommit,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> &
  CommitProps) {
  const { draft, setDraft, commit } = useDeferredText(value, onCommit);

  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function DeferredTextarea({
  value,
  onCommit,
  ...rest
}: Omit<AutoGrowTextareaProps, "value" | "onChange"> & CommitProps) {
  const { draft, setDraft, commit } = useDeferredText(value, onCommit);

  return (
    <AutoGrowTextarea
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}
