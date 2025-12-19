import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash, Check } from 'lucide-react';
import { predictValues } from '../utils';
import ConfirmModal from './ConfirmModal';

export interface GridColumn {
  field: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select';
  options?: {label: string, value: string}[];
  width?: string;
  editable?: boolean;
}

interface Props {
  data: any[];
  columns: GridColumn[];
  onUpdate: (id: string, field: string, value: any) => void;
  onDelete?: (id: string) => void;
  onDeleteRows?: (ids: string[]) => void;
  onAddRow?: () => void;
}

const DataGrid: React.FC<Props> = ({ data, columns, onUpdate, onDeleteRows, onAddRow }) => {
  const [selection, setSelection] = useState<{ startR: number; startC: number; endR: number; endC: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isRowSelecting, setIsRowSelecting] = useState(false); 
  const [isFilling, setIsFilling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [openMultiSelect, setOpenMultiSelect] = useState<{rowId: string, field: string} | null>(null);

  // Custom Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, count: number, ids: string[]} | null>(null);

  const getValue = (rowIdx: number, col: GridColumn) => {
    if (!data[rowIdx]) return '';
    return data[rowIdx][col.field];
  };

  const handleMouseDownCell = (r: number, c: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsSelecting(true);
    setIsRowSelecting(false);
    setSelection({ startR: r, startC: c, endR: r, endC: c });
  };

  const handleMouseDownRowIndex = (r: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsSelecting(true);
    setIsRowSelecting(true);
    setSelection({ startR: r, startC: 0, endR: r, endC: columns.length - 1 });
  };

  const handleMouseEnterCell = (r: number, c: number) => {
    if (isSelecting && selection) {
      if (isRowSelecting) {
          setSelection({ ...selection, endR: r, endC: columns.length - 1 });
      } else {
          setSelection({ ...selection, endR: r, endC: c });
      }
    } else if (isFilling && selection) {
      setSelection({ ...selection, endR: r, endC: c });
    }
  };

  const handleMouseEnterRowIndex = (r: number) => {
      if (isSelecting && selection && isRowSelecting) {
          setSelection({ ...selection, endR: r, endC: columns.length - 1 });
      }
  }

  const handleMouseDownHandle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsFilling(true);
  };

  const handleMouseUp = () => {
    if (isFilling && selection) {
        const r1 = Math.min(selection.startR, selection.endR); 
        const r2 = Math.max(selection.startR, selection.endR); 
        const c1 = Math.min(selection.startC, selection.endC);
        const c2 = Math.max(selection.startC, selection.endC);

        for (let c = c1; c <= c2; c++) {
            const colDef = columns[c];
            if (colDef.editable === false) continue;

            const val1 = getValue(r1, colDef);
            if (r2 > r1) {
                const sourceVals = [];
                sourceVals.push(val1);
                if (r2 - r1 >= 1) {
                     const v2 = data[r1+1] ? data[r1+1][colDef.field] : null;
                     if (v2 !== undefined && v2 !== null) sourceVals.push(v2);
                }
                const countNeeded = r2 - r1 + 1;
                const predicted = predictValues(sourceVals, countNeeded);
                for (let i = 0; i < countNeeded; i++) {
                    if (data[r1 + i]) onUpdate(data[r1 + i].id, colDef.field, predicted[i]);
                }
            }
        }
    }
    setIsSelecting(false);
    setIsRowSelecting(false);
    setIsFilling(false);
  };

  const handleDeleteSelected = () => {
      if (!selection || !onDeleteRows) return;
      const r1 = Math.min(selection.startR, selection.endR);
      const r2 = Math.max(selection.startR, selection.endR);
      
      const idsToDelete = [];
      for (let i = r1; i <= r2; i++) {
          if (data[i]) idsToDelete.push(data[i].id);
      }
      
      if (idsToDelete.length > 0) {
          // Open Custom Modal
          setConfirmConfig({ isOpen: true, count: idsToDelete.length, ids: idsToDelete });
      }
  };

  const handleConfirmDelete = () => {
    if (confirmConfig && onDeleteRows) {
        onDeleteRows(confirmConfig.ids);
        setSelection(null);
    }
    setConfirmConfig(null);
  };

  const handleDeleteButtonClick = () => {
      if (!selection) {
          // Keep simple alert for info, but could be replaced too. 
          // Native alert is less likely to break app logic than confirm, but let's assume it might be blocked.
          // For simplicity in this fix, we just focus on the critical delete confirmation.
          // If this doesn't show in C#, it's fine, nothing bad happens.
          alert("Please click the row number(s) on the left to select rows to delete.");
          return;
      }
      handleDeleteSelected();
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isFilling, isSelecting, selection, data, columns]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && selection && onDeleteRows) {
              const activeTag = document.activeElement?.tagName;
              if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
              handleDeleteSelected();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, onDeleteRows, data]);

  return (
    <>
        <div className="flex flex-col h-full bg-white border rounded-lg">
        <div className="overflow-auto relative select-none flex-1" ref={containerRef}>
            <table className="w-full text-sm border-collapse table-fixed">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                <th className="p-2 border border-slate-200 w-12 text-center text-slate-500 bg-slate-100 font-semibold cursor-default select-none">#</th>
                {columns.map((col, idx) => (
                    <th key={idx} className="p-2 border border-slate-200 font-semibold text-slate-700 text-left overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: col.width }}>
                    {col.header}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody>
                {data.map((row, rIdx) => {
                const isRowSelected = selection && 
                    rIdx >= Math.min(selection.startR, selection.endR) && 
                    rIdx <= Math.max(selection.startR, selection.endR) &&
                    selection.startC === 0 && selection.endC === columns.length - 1;

                return (
                <tr key={row.id} className={`group ${isRowSelected ? 'bg-blue-50' : ''}`}>
                    <td 
                        className={`p-2 border border-slate-200 text-center text-xs select-none font-mono cursor-pointer transition-colors
                            ${isRowSelected ? 'bg-blue-200 text-blue-800 font-bold border-blue-300' : 'bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}
                        `}
                        onMouseDown={(e) => handleMouseDownRowIndex(rIdx, e)}
                        onMouseEnter={() => handleMouseEnterRowIndex(rIdx)}
                    >
                    {rIdx + 1}
                    </td>
                    {columns.map((col, cIdx) => {
                    const isSelected = selection && 
                        rIdx >= Math.min(selection.startR, selection.endR) && 
                        rIdx <= Math.max(selection.startR, selection.endR) &&
                        cIdx >= Math.min(selection.startC, selection.endC) &&
                        cIdx <= Math.max(selection.startC, selection.endC);
                    
                    const isHandle = selection && 
                        rIdx === Math.max(selection.startR, selection.endR) && 
                        cIdx === Math.max(selection.startC, selection.endC);
                    
                    const cellValue = row[col.field];

                    return (
                        <td 
                        key={`${rIdx}-${cIdx}`}
                        className={`border border-slate-200 p-0 relative ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-400 z-10' : ''}`}
                        onMouseDown={(e) => {
                            if (col.editable !== false) handleMouseDownCell(rIdx, cIdx, e);
                        }}
                        onMouseEnter={() => handleMouseEnterCell(rIdx, cIdx)}
                        >
                        {col.editable !== false ? (
                            col.type === 'select' ? (
                                <div className="relative w-full h-full">
                                    <select 
                                        className="w-full h-full p-2 bg-transparent appearance-none outline-none cursor-pointer text-slate-700"
                                        value={cellValue || ''}
                                        onChange={(e) => onUpdate(row.id, col.field, e.target.value)}
                                    >
                                        <option value="">-</option>
                                        {col.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-3 text-slate-400 pointer-events-none"/>
                                </div>
                            ) : col.type === 'multi-select' ? (
                                <div className="relative w-full h-full">
                                    <div 
                                        className="w-full h-full p-2 truncate cursor-pointer hover:bg-slate-50 flex items-center"
                                        onClick={() => setOpenMultiSelect(openMultiSelect?.rowId === row.id && openMultiSelect?.field === col.field ? null : {rowId: row.id, field: col.field})}
                                    >
                                        <span className="text-xs">{Array.isArray(cellValue) && cellValue.length > 0 ? `${cellValue.length} selected` : 'Select...'}</span>
                                        <ChevronDown size={12} className="ml-auto text-slate-400"/>
                                    </div>
                                    {openMultiSelect?.rowId === row.id && openMultiSelect?.field === col.field && (
                                        <div className="absolute top-full left-0 bg-white border shadow-xl rounded z-50 min-w-[200px] max-h-48 overflow-y-auto p-1">
                                            {col.options?.map(opt => {
                                                const rawVal = cellValue || [];
                                                const valArray = Array.isArray(rawVal) ? rawVal : [rawVal];
                                                const selected = valArray.includes(opt.value);
                                                return (
                                                    <div 
                                                        key={opt.value} 
                                                        className={`flex items-center gap-2 p-2 hover:bg-blue-50 cursor-pointer rounded text-sm ${selected ? 'text-blue-600 font-medium' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const current = Array.isArray(cellValue) ? cellValue : (cellValue ? [cellValue] : []);
                                                            const next = selected ? current.filter((x:any) => x !== opt.value) : [...current, opt.value];
                                                            onUpdate(row.id, col.field, next);
                                                        }}
                                                    >
                                                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                            {selected && <Check size={10} className="text-white"/>}
                                                        </div>
                                                        {opt.label}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input 
                                    type={col.type} 
                                    className="w-full h-full p-2 outline-none bg-transparent"
                                    value={cellValue || ''}
                                    onChange={(e) => onUpdate(row.id, col.field, e.target.value)}
                                />
                            )
                        ) : (
                            <div className="p-2 text-slate-500 bg-slate-50 h-full truncate">{cellValue}</div>
                        )}
                        
                        {isHandle && isSelected && !isRowSelecting && (
                            <div 
                            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-600 border border-white cursor-crosshair z-20 shadow-sm"
                            onMouseDown={handleMouseDownHandle}
                            />
                        )}
                        </td>
                    );
                    })}
                </tr>
                )})}
            </tbody>
            </table>
        </div>
        
        <div className="p-2 border-t bg-slate-50 flex gap-2 text-xs text-slate-500 items-center justify-between h-10">
            <div className="flex gap-2">
                {onAddRow && (
                    <button onClick={onAddRow} className="flex items-center gap-1 hover:text-blue-600 px-2 py-1 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                        <Plus size={14}/> Add Row
                    </button>
                )}
                {onDeleteRows && (
                    <button 
                    onMouseDown={(e) => e.preventDefault()} 
                    onClick={handleDeleteButtonClick} 
                    className={`flex items-center gap-1 font-medium px-2 py-1 rounded border transition-all ${selection ? 'text-red-600 hover:text-red-700 hover:bg-red-50 border-transparent hover:border-red-100' : 'text-slate-300 border-transparent cursor-default'}`}
                    >
                        <Trash size={14}/> Delete Selected Rows (Del)
                    </button>
                )}
            </div>
            <div className="text-slate-400">
                Click row number to select line. Shift+Click to select range.
            </div>
        </div>
        </div>
        
        <ConfirmModal 
            isOpen={!!confirmConfig}
            title="Delete Rows?"
            message={`Are you sure you want to delete ${confirmConfig?.count} rows? This action cannot be undone.`}
            confirmText="Delete"
            isDanger={true}
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmConfig(null)}
        />
    </>
  );
};

export default DataGrid;