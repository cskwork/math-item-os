"use client";

import { memo, useCallback } from "react";
import { MathFieldEditor } from "../math-field-editor";
import { Button } from "@/components/ui/button";
import type { AuthoringBlock, TableData } from "../types";

interface TableBlockProps {
  readonly block: AuthoringBlock;
  readonly editorMode: "visual" | "latex";
  readonly onUpdate: (blockId: string, patch: Partial<AuthoringBlock>) => void;
}

const TableBlock = memo(function TableBlock({ block, editorMode, onUpdate }: TableBlockProps) {
  const table = block.table ?? { rows: 2, cols: 2, cells: [["", ""], ["", ""]], hasHeader: true };

  const updateCell = useCallback(
    (row: number, col: number, value: string) => {
      const newCells = table.cells.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r,
      );
      onUpdate(block.id, { table: { ...table, cells: newCells } });
    },
    [block.id, table, onUpdate],
  );

  const addRow = useCallback(() => {
    const newRow = Array(table.cols).fill("");
    const newCells = [...table.cells, newRow];
    onUpdate(block.id, { table: { ...table, rows: table.rows + 1, cells: newCells } });
  }, [block.id, table, onUpdate]);

  const addCol = useCallback(() => {
    const newCells = table.cells.map((row) => [...row, ""]);
    onUpdate(block.id, { table: { ...table, cols: table.cols + 1, cells: newCells } });
  }, [block.id, table, onUpdate]);

  const removeRow = useCallback(() => {
    if (table.rows <= 1) return;
    const newCells = table.cells.slice(0, -1);
    onUpdate(block.id, { table: { ...table, rows: table.rows - 1, cells: newCells } });
  }, [block.id, table, onUpdate]);

  const removeCol = useCallback(() => {
    if (table.cols <= 1) return;
    const newCells = table.cells.map((row) => row.slice(0, -1));
    onUpdate(block.id, { table: { ...table, cols: table.cols - 1, cells: newCells } });
  }, [block.id, table, onUpdate]);

  const toggleHeader = useCallback(() => {
    onUpdate(block.id, { table: { ...table, hasHeader: !table.hasHeader } });
  }, [block.id, table, onUpdate]);

  return (
    <div className="flex flex-col gap-2">
      {/* 테이블 컨트롤 */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">{table.rows} x {table.cols}</span>
        <Button type="button" variant="ghost" size="sm" onClick={addRow} className="h-6 px-2 text-xs">+ 행</Button>
        <Button type="button" variant="ghost" size="sm" onClick={addCol} className="h-6 px-2 text-xs">+ 열</Button>
        <Button type="button" variant="ghost" size="sm" onClick={removeRow} className="h-6 px-2 text-xs" disabled={table.rows <= 1}>- 행</Button>
        <Button type="button" variant="ghost" size="sm" onClick={removeCol} className="h-6 px-2 text-xs" disabled={table.cols <= 1}>- 열</Button>
        <label className="ml-2 flex items-center gap-1 text-xs text-slate-500">
          <input type="checkbox" checked={table.hasHeader} onChange={toggleHeader} className="h-3 w-3" />
          헤더 행
        </label>
      </div>

      {/* 테이블 그리드 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {table.cells.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`border border-slate-200 p-0.5 dark:border-slate-700 ${
                      ri === 0 && table.hasHeader ? "bg-slate-50 font-medium dark:bg-slate-800" : ""
                    }`}
                  >
                    {editorMode === "visual" ? (
                      <MathFieldEditor
                        value={cell}
                        onChange={(v) => updateCell(ri, ci, v)}
                        placeholder="..."
                        className="!min-h-[32px] !border-0 !ring-0 text-sm"
                      />
                    ) : (
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        placeholder="..."
                        spellCheck={false}
                        className="h-8 w-full border-0 bg-transparent px-2 font-mono text-xs focus:outline-none"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export { TableBlock };
