import { LineItemTotal } from "./calculations";

const escapeCsv = (value: string | number | boolean): string => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
    return `"${str.split("\"").join("\"\"")}"`;
  }
  return str;
};

export const lineItemsToCsv = (
  rows: Array<LineItemTotal & { roomName: string }>
): string => {
  const headers = ["room", "work", "unit", "qty", "rate", "line total", "done", "notes"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.roomName),
        escapeCsv(row.workName),
        escapeCsv(row.unit),
        escapeCsv(row.qty),
        escapeCsv(row.rate),
        escapeCsv(row.lineTotal),
        escapeCsv(row.done),
        escapeCsv(row.notes)
      ].join(",")
    );
  }

  return lines.join("\n");
};

export const downloadTextFile = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
