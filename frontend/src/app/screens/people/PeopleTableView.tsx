import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Columns3, Download, FileSpreadsheet } from 'lucide-react';
import { Badge, Button, DataTable, type DataTableColumn } from '@vera/ui';
import { peopleService } from '@vera/services';
import { PERSON_ROLE_LABELS, type PeopleTableParams, type PersonTableRow } from '@vera/types';
import { usePeopleFacets, usePeopleTable } from '@app/hooks/usePeople';
import { PeopleFilters } from './PeopleFilters';

const PAGE_SIZE = 25;
const COLS_KEY = 'vera:people:columns';

const relativeContact = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return d.toLocaleDateString('es-AR');
};

const money = (v?: number | null, currency?: string | null): string =>
  v == null ? '—' : `${currency || 'USD'} ${Number(v).toLocaleString('es-AR')}`;

/** Renderizadores de celda por columna de conocimiento. */
const renderCell = (key: string, row: PersonTableRow) => {
  switch (key) {
    case 'fullName':
      return <span className="vera-dt__name">{row.fullName || '—'}</span>;
    case 'roles':
      return (
        <span className="vera-dt__roles">
          {(row.roles || []).slice(0, 3).map((r) => (
            <Badge key={r} tone="muted">{PERSON_ROLE_LABELS[r] ?? r}</Badge>
          ))}
        </span>
      );
    case 'interests':
      return (row.interests || []).join(', ') || '—';
    case 'budget':
      return money(row.budget, row.budgetCurrency);
    case 'confidenceLabel': {
      if (row.confidenceLabel === '—') return '—';
      const mod = row.confidenceLabel === 'Alta' ? 'alta' : row.confidenceLabel === 'Media' ? 'media' : 'baja';
      return <span className={`vera-conf vera-conf--${mod}`}>{row.confidenceLabel}</span>;
    }
    case 'lastContact':
      return <span className="vera-dt__muted">{relativeContact(row.lastContact)}</span>;
    case 'status':
      return (
        <span>
          <span className={`vera-dot vera-dot--${row.status === 'active' ? 'published' : 'none'}`} />
          {row.status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
      );
    default: {
      const v = (row as Record<string, unknown>)[key];
      return v == null || v === '' ? '—' : String(v);
    }
  }
};

const RIGHT_ALIGN = new Set(['conversationsCount', 'budget']);

export interface PeopleTableViewProps {
  query: string;
}

/** Vista Tabla configurable de Personas. Filtros de negocio (AND), columnas
 * elegibles, selección y exportación CSV/Excel. Base reutilizable (Audiencias). */
export const PeopleTableView = ({ query }: PeopleTableViewProps) => {
  const navigate = useNavigate();
  const { data: facets } = usePeopleFacets();

  const [factValues, setFactValues] = useState<Record<string, string>>({});
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [confidenceMin, setConfidenceMin] = useState('');
  const [contactedWithin, setContactedWithin] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<string[] | null>(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const params: PeopleTableParams = useMemo(() => {
    const facts = Object.entries(factValues)
      .filter(([, v]) => v)
      .map(([type, value]) => ({ type, value }));
    return {
      query: query.trim() || undefined,
      facts,
      budgetMin: budgetMin ? Number(budgetMin) : undefined,
      budgetMax: budgetMax ? Number(budgetMax) : undefined,
      confidenceMin: confidenceMin ? Number(confidenceMin) : undefined,
      contactedWithin: contactedWithin ? Number(contactedWithin) : undefined,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    };
  }, [query, factValues, budgetMin, budgetMax, confidenceMin, contactedWithin, sortBy, sortDir, page]);

  const { data, isLoading } = usePeopleTable(params);

  // Al llegar el catálogo, fijar columnas visibles por defecto la primera vez.
  useEffect(() => {
    if (data?.defaultColumns && visibleCols === null) setVisibleCols(data.defaultColumns);
  }, [data, visibleCols]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [query, factValues, budgetMin, budgetMax, confidenceMin, contactedWithin]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const catalog = data?.columns ?? {};
  const cols = visibleCols ?? data?.defaultColumns ?? [];
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const activeCount =
    Object.values(factValues).filter(Boolean).length +
    (budgetMin ? 1 : 0) + (budgetMax ? 1 : 0) + (confidenceMin ? 1 : 0) + (contactedWithin ? 1 : 0);

  const persistCols = (next: string[]) => {
    setVisibleCols(next);
    localStorage.setItem(COLS_KEY, JSON.stringify(next));
  };

  const toggleCol = (key: string) => {
    const next = cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key];
    if (next.length === 0) return; // al menos una columna
    persistCols(next);
  };

  const onSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const toggleRow = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });

  const doExport = (format: 'csv' | 'xlsx') => {
    const ids = selected.size > 0 ? Array.from(selected) : undefined;
    const url = peopleService.exportUrl(format, params, cols, ids);
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const clearFilters = () => {
    setFactValues({});
    setBudgetMin('');
    setBudgetMax('');
    setConfidenceMin('');
    setContactedWithin('');
  };

  const tableColumns: DataTableColumn<PersonTableRow>[] = cols
    .filter((k) => catalog[k])
    .map((k) => ({
      key: k,
      label: catalog[k],
      align: RIGHT_ALIGN.has(k) ? 'right' : 'left',
      sortable: true,
      render: (row) => renderCell(k, row),
    }));

  return (
    <div data-testid="people-table-view">
      <PeopleFilters
        facets={facets}
        factValues={factValues}
        onFactChange={(type, value) => setFactValues((f) => ({ ...f, [type]: value }))}
        budgetMin={budgetMin}
        budgetMax={budgetMax}
        onBudget={(w, v) => (w === 'min' ? setBudgetMin(v) : setBudgetMax(v))}
        confidenceMin={confidenceMin}
        onConfidence={setConfidenceMin}
        contactedWithin={contactedWithin}
        onContacted={setContactedWithin}
        onClear={clearFilters}
        activeCount={activeCount}
      />

      <div className="vera-ptable__bar">
        <span className="vera-ptable__count" data-testid="table-count">
          {total} {total === 1 ? 'persona' : 'personas'}
          {selected.size > 0 && ` · ${selected.size} seleccionadas`}
        </span>
        <div className="vera-ptable__actions">
          <div className="vera-ptable__colmenu" ref={colMenuRef}>
            <Button variant="ghost" size="sm" onClick={() => setColMenuOpen((o) => !o)} data-testid="columns-config-trigger">
              <Columns3 size={15} /> Columnas
            </Button>
            {colMenuOpen && (
              <div className="vera-ptable__coldrop" data-testid="columns-config-menu">
                {Object.entries(catalog).map(([key, label]) => (
                  <label key={key} className="vera-ptable__colitem" data-testid={`column-toggle-${key}`}>
                    <input
                      type="checkbox"
                      checked={cols.includes(key)}
                      onChange={() => toggleCol(key)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => doExport('csv')} data-testid="export-csv">
            <Download size={15} /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => doExport('xlsx')} data-testid="export-excel">
            <FileSpreadsheet size={15} /> Excel
          </Button>
        </div>
      </div>

      <DataTable
        columns={tableColumns}
        rows={rows}
        getRowId={(r) => r.id}
        selectable
        selectedIds={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        allSelected={allSelected}
        onRowClick={(r) => navigate(`/personas/${r.id}`)}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        loading={isLoading}
        emptyLabel="No hay personas que coincidan con estos filtros."
        testId="people-datatable"
      />

      {totalPages > 1 && (
        <div className="vera-ptable__pager" data-testid="table-pager">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="page-prev">
            Anterior
          </Button>
          <span className="vera-ptable__pageinfo">Página {page} de {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="page-next">
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
};
