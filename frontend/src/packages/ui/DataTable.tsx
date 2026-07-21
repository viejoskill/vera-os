import { type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

/** Definición de columna genérica. Reutilizable (Personas, Audiencias, …). */
export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyLabel?: string;
  testId?: string;
}

/** Grilla de datos genérica y desacoplada del dominio. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  allSelected = false,
  onRowClick,
  sortBy,
  sortDir,
  onSort,
  loading = false,
  emptyLabel = 'Sin resultados.',
  testId = 'data-table',
}: DataTableProps<T>) {
  return (
    <div className="vera-dt" role="table" data-testid={testId}>
      <div className="vera-dt__head" role="row">
        {selectable && (
          <span className="vera-dt__cell vera-dt__cell--check" role="columnheader">
            <input
              type="checkbox"
              checked={allSelected && rows.length > 0}
              onChange={onToggleAll}
              aria-label="Seleccionar todo"
              data-testid="dt-select-all"
            />
          </span>
        )}
        {columns.map((c) => (
          <button
            key={c.key}
            type="button"
            role="columnheader"
            className={`vera-dt__cell vera-dt__th ${c.align === 'right' ? 'vera-dt__cell--right' : ''} ${
              c.sortable ? 'vera-dt__th--sortable' : ''
            }`.trim()}
            onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
            data-testid={`dt-col-${c.key}`}
          >
            {c.label}
            {c.sortable && sortBy === c.key && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="vera-dt__empty">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="vera-dt__empty" data-testid="dt-empty">{emptyLabel}</p>
      ) : (
        rows.map((row) => {
          const id = getRowId(row);
          const isSel = selectedIds?.has(id) ?? false;
          return (
            <div
              key={id}
              role="row"
              className={`vera-dt__row ${isSel ? 'vera-dt__row--selected' : ''} ${onRowClick ? 'vera-dt__row--clickable' : ''}`.trim()}
              data-testid={`dt-row-${id}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {selectable && (
                <span
                  className="vera-dt__cell vera-dt__cell--check"
                  role="cell"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => onToggleRow?.(id)}
                    aria-label="Seleccionar fila"
                    data-testid={`dt-select-${id}`}
                  />
                </span>
              )}
              {columns.map((c) => (
                <span
                  key={c.key}
                  role="cell"
                  className={`vera-dt__cell ${c.align === 'right' ? 'vera-dt__cell--right' : ''}`.trim()}
                >
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                </span>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
