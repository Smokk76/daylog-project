import { ProjectSettings, QuantitySource, Room, RoomComputed, RoomWorkSelection, WorkCategory, WorkItem } from "../types";

const round2 = (n: number): number => Math.round(n * 100) / 100;
export const PROJECT_SCOPE_ROOM_ID = "__project__";

const nonNeg = (n?: number): number => {
  if (n === undefined || Number.isNaN(n)) return 0;
  return Math.max(0, n);
};

export const computeRoom = (room: Room, settings: ProjectSettings): RoomComputed => {
  const length = nonNeg(room.lengthM);
  const width = nonNeg(room.widthM);
  const hasDimensions = length > 0 && width > 0;

  const perimeter = hasDimensions ? 2 * (length + width) : 0;

  const floorArea = room.manualFloorAreaM2 !== undefined ? nonNeg(room.manualFloorAreaM2) : hasDimensions ? length * width : 0;
  const ceilingArea = room.manualCeilingAreaM2 !== undefined ? nonNeg(room.manualCeilingAreaM2) : floorArea;
  const wallArea = room.manualWallAreaM2 !== undefined ? nonNeg(room.manualWallAreaM2) : perimeter * nonNeg(settings.ceilingHeightM);
  const skirtingLM = room.manualSkirtingLM !== undefined ? nonNeg(room.manualSkirtingLM) : perimeter;
  const architraveLM = room.manualArchitraveLM !== undefined ? nonNeg(room.manualArchitraveLM) : nonNeg(room.doorCount) * 5;

  return {
    floorAreaM2: round2(floorArea),
    ceilingAreaM2: round2(ceilingArea),
    wallAreaM2: round2(wallArea),
    skirtingLM: round2(skirtingLM),
    architraveLM: round2(architraveLM),
    perimeterM: round2(perimeter)
  };
};

export const baseQtyFromSource = (source: QuantitySource, computed: RoomComputed, doorCount: number): number => {
  switch (source) {
    case "floorArea":
      return computed.floorAreaM2;
    case "ceilingArea":
      return computed.ceilingAreaM2;
    case "wallArea":
      return computed.wallAreaM2;
    case "skirtingLM":
      return computed.skirtingLM;
    case "architraveLM":
      return computed.architraveLM;
    case "doorCount":
      return nonNeg(doorCount);
    case "manual":
      return 0;
    default:
      return 0;
  }
};

export const getRateForWork = (work: WorkItem, settings: ProjectSettings, selection?: RoomWorkSelection): number => {
  if (selection?.rateOverride !== undefined) return nonNeg(selection.rateOverride);
  if (work.defaultRateKey === "custom") return nonNeg(work.customRate);
  return nonNeg(settings.unitRatesGBP[work.defaultRateKey]);
};

export const getQtyForWork = (room: Room, work: WorkItem, computed: RoomComputed, selection?: RoomWorkSelection): number => {
  if (selection?.qtyOverride !== undefined && work.allowManualQty) {
    return round2(nonNeg(selection.qtyOverride));
  }

  const qty = baseQtyFromSource(work.quantitySource, computed, room.doorCount);
  return round2(qty);
};

export interface LineItemTotal {
  workItemId: string;
  roomId: string;
  category: WorkCategory;
  workName: string;
  unit: string;
  qty: number;
  rate: number;
  lineTotal: number;
  done: boolean;
  notes: string;
  excluded: boolean;
}

export const buildLineItems = (
  rooms: Room[],
  workItems: WorkItem[],
  selections: RoomWorkSelection[],
  settings: ProjectSettings
): LineItemTotal[] => {
  const selectionMap = new Map<string, RoomWorkSelection>();
  for (const s of selections) {
    selectionMap.set(`${s.roomId}:${s.workItemId}`, s);
  }

  const items: LineItemTotal[] = [];

  const roomScopeItems = workItems.filter((work) => (work.scope ?? "room") === "room");
  const projectScopeItems = workItems.filter((work) => work.scope === "project");
  const projectScopeRoom: Room = {
    id: PROJECT_SCOPE_ROOM_ID,
    name: "Project-wide",
    level: "Ground Floor",
    doorCount: 0,
    excludeFromTotals: false
  };
  const projectComputed = computeRoom(projectScopeRoom, settings);

  for (const room of rooms) {
    const computed = computeRoom(room, settings);

    for (const work of roomScopeItems) {
      const selection = selectionMap.get(`${room.id}:${work.id}`);
      if (!selection?.isSelected) continue;

      const qty = getQtyForWork(room, work, computed, selection);
      const rate = getRateForWork(work, settings, selection);
      const lineTotal = round2(qty * rate);

      items.push({
        workItemId: work.id,
        roomId: room.id,
        category: work.category,
        workName: selection.titleOverride?.trim() || work.name,
        unit: work.unitType,
        qty,
        rate,
        lineTotal,
        done: selection.isDone,
        notes: selection.notes,
        excluded: room.excludeFromTotals
      });
    }
  }

  for (const work of projectScopeItems) {
    const selection = selectionMap.get(`${PROJECT_SCOPE_ROOM_ID}:${work.id}`);
    if (!selection?.isSelected) continue;

    const qty = getQtyForWork(projectScopeRoom, work, projectComputed, selection);
    const rate = getRateForWork(work, settings, selection);
    const lineTotal = round2(qty * rate);

    items.push({
      workItemId: work.id,
      roomId: PROJECT_SCOPE_ROOM_ID,
      category: work.category,
      workName: selection.titleOverride?.trim() || work.name,
      unit: work.unitType,
      qty,
      rate,
      lineTotal,
      done: selection.isDone,
      notes: selection.notes,
      excluded: false
    });
  }

  return items;
};

export const roomTotals = (
  roomId: string,
  lineItems: LineItemTotal[],
  dayRate: number
): { total: number; manDays: number; selectedCount: number; doneCount: number } => {
  const roomItems = lineItems.filter((i) => i.roomId === roomId);
  const total = round2(roomItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const selectedCount = roomItems.length;
  const doneCount = roomItems.filter((i) => i.done).length;
  const manDays = dayRate > 0 ? round2(total / dayRate) : 0;

  return { total, manDays, selectedCount, doneCount };
};

export const summaryTotals = (lineItems: LineItemTotal[], dayRate: number) => {
  const included = lineItems.filter((i) => !i.excluded);
  const grandTotal = round2(included.reduce((sum, item) => sum + item.lineTotal, 0));
  const manDays = dayRate > 0 ? round2(grandTotal / dayRate) : 0;

  const byCategory = new Map<WorkCategory, number>();
  for (const i of included) {
    byCategory.set(i.category, round2((byCategory.get(i.category) ?? 0) + i.lineTotal));
  }

  return {
    grandTotal,
    manDays,
    byCategory
  };
};
