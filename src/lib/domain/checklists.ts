import type {
  AppData,
  AuctionCase,
  CaseChecklist,
  ChecklistItemInstance,
  ChecklistTemplateItem,
} from "@/lib/types/domain";
import { STATUS_LABELS } from "@/lib/domain/status-labels";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function instantiateItems(
  items: ChecklistTemplateItem[],
): ChecklistItemInstance[] {
  return items.map((t) => ({
    ...t,
    done: false,
    doneAt: null,
    note: "",
  }));
}

export function buildCaseChecklistsFromTemplates(data: AppData): CaseChecklist[] {
  const order = data.processStepOrder;
  const out: CaseChecklist[] = [];
  for (const stepKey of order) {
    const tmpl = data.checklistTemplates[stepKey];
    if (!tmpl?.length) continue;
    out.push({
      id: newId(),
      stepKey,
      title: STATUS_LABELS[stepKey],
      items: instantiateItems(tmpl),
    });
  }
  return out;
}

export function reapplyChecklistsToCase(
  data: AppData,
  c: AuctionCase,
): AuctionCase {
  return {
    ...c,
    checklists: buildCaseChecklistsFromTemplates(data),
    updatedAt: new Date().toISOString(),
  };
}
