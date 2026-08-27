import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  emptyMessage = "No records yet.",
  keyField = "id",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  keyField?: keyof T;
}) {
  return (
    <div className="panel overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="text-center text-slate-500 py-8">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={String(row[keyField] ?? idx)}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""} ${c.className ?? ""}`}
                >
                  {c.render ? c.render(row) : String((row as any)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
