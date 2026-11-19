import type { Database, QueryExecResult, SqlJsStatic } from 'sql.js';

type InitSqlJs = (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
const globalInit = () => (window as unknown as { initSqlJs?: InitSqlJs }).initSqlJs;

let enginePromise: Promise<SqlJsStatic> | null = null;

/** Lazily load sql.js (SQLite compiled to WebAssembly) from /sqljs. */
export function loadSqlEngine(): Promise<SqlJsStatic> {
  if (!enginePromise) {
    enginePromise = new Promise<void>((resolve, reject) => {
      if (globalInit()) return resolve();
      const script = document.createElement('script');
      script.src = 'sqljs/sql-wasm-browser.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load sql.js'));
      document.head.appendChild(script);
    })
      .then(() => globalInit()!({ locateFile: (f) => `sqljs/${f}` }))
      .catch((e) => {
        enginePromise = null;
        throw e;
      });
  }
  return enginePromise;
}

export interface RunResult {
  columns: string[];
  rows: unknown[][];
}

/** Run SQL against a fresh database built from `schema`; returns the last result set. */
export function runOnFreshDb(SQL: SqlJsStatic, schema: string, query: string): RunResult | null {
  let db: Database | null = null;
  try {
    db = new SQL.Database();
    db.exec(schema);
    const results: QueryExecResult[] = db.exec(query);
    const last = results.at(-1);
    return last ? { columns: last.columns, rows: last.values } : null;
  } finally {
    db?.close();
  }
}

function norm(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

export type CheckOutcome =
  | { ok: true }
  | { ok: false; reason: 'cols' | 'rows' | 'values' | 'order'; expected?: number; got?: number };

/** Compare a user's result with the solution's. Column names are ignored; values are normalized. */
export function compareResults(
  user: RunResult | null,
  expected: RunResult | null,
  ordered: boolean,
): CheckOutcome {
  const u = user ?? { columns: [], rows: [] };
  const e = expected ?? { columns: [], rows: [] };
  if (u.columns.length !== e.columns.length)
    return { ok: false, reason: 'cols', expected: e.columns.length, got: u.columns.length };
  if (u.rows.length !== e.rows.length)
    return { ok: false, reason: 'rows', expected: e.rows.length, got: u.rows.length };

  const ur = u.rows.map((r) => r.map(norm).join('␟'));
  const er = e.rows.map((r) => r.map(norm).join('␟'));
  const sameSet = [...ur].sort().join('\n') === [...er].sort().join('\n');
  if (!sameSet) return { ok: false, reason: 'values' };
  if (ordered && ur.join('\n') !== er.join('\n')) return { ok: false, reason: 'order' };
  return { ok: true };
}
