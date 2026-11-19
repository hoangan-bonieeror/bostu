import { loadSqlEngine, runOnFreshDb } from './sql-engine';

export interface SqlRunnerDeps {
  /** Loads public/content/sql/<name>.sql */
  loadDb: (name: string) => Promise<string>;
  t: (
    key:
      | 'sql.run'
      | 'sql.reset'
      | 'sql.setup'
      | 'sql.rows'
      | 'sql.noResult'
      | 'sql.loading'
      | 'sql.hint',
  ) => string;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Turns every `<div class="sql-runner">` produced by the Markdown renderer (```sql-run blocks)
 * into an editable SQL box backed by SQLite (WebAssembly). Each run starts from a fresh database.
 */
export function mountSqlRunners(root: HTMLElement, deps: SqlRunnerDeps) {
  const boxes = Array.from(root.querySelectorAll<HTMLElement>('.sql-runner:not(.ready)'));
  for (const box of boxes) mountOne(box, deps);
}

function mountOne(box: HTMLElement, { loadDb, t }: SqlRunnerDeps) {
  box.classList.add('ready');
  const db = box.dataset['db'] ?? 'shop';
  const setup = box.dataset['setup'] ?? '';
  const original = box.dataset['query'] ?? '';
  box.innerHTML = '';

  const head = el('div', 'sqlr-head');
  head.append(el('span', 'sqlr-label', `SQL · SQLite${db !== 'none' ? ` · ${db}` : ''}`));
  const setupBtn = el('button', 'sqlr-link', `🗂 ${t('sql.setup')}`);
  setupBtn.type = 'button';
  head.append(setupBtn);

  const setupPre = el('pre', 'sqlr-setup');
  setupPre.hidden = true;

  const editor = el('textarea', 'sqlr-editor');
  editor.value = original;
  editor.spellcheck = false;
  editor.rows = Math.min(14, Math.max(3, original.split('\n').length + 1));
  editor.setAttribute('aria-label', 'SQL');

  const actions = el('div', 'sqlr-actions');
  const runBtn = el('button', 'btn sqlr-run', `▶ ${t('sql.run')}`);
  runBtn.type = 'button';
  const resetBtn = el('button', 'btn ghost', `↺ ${t('sql.reset')}`);
  resetBtn.type = 'button';
  actions.append(runBtn, resetBtn, el('span', 'sqlr-hint', t('sql.hint')));

  const out = el('div', 'sqlr-out');
  box.append(head, setupPre, editor, actions, out);

  let schema: Promise<string> | null = null;
  const getSchema = () =>
    (schema ??= (db === 'none' ? Promise.resolve('') : loadDb(db)).then(
      (base) => `${base}\n${setup}`,
    ));

  setupBtn.addEventListener('click', async () => {
    setupPre.hidden = !setupPre.hidden;
    if (!setupPre.hidden && !setupPre.textContent)
      setupPre.textContent = (await getSchema()).trim();
  });

  async function run() {
    out.replaceChildren(el('p', 'muted small', t('sql.loading')));
    try {
      const [SQL, sch] = await Promise.all([loadSqlEngine(), getSchema()]);
      const res = runOnFreshDb(SQL, sch, editor.value);
      if (!res) {
        out.replaceChildren(el('p', 'muted small', t('sql.noResult')));
        return;
      }
      const wrap = el('div', 'table-wrap');
      const table = el('table');
      const thead = el('thead');
      const hr = el('tr');
      for (const c of res.columns) hr.append(el('th', undefined, c));
      thead.append(hr);
      const tbody = el('tbody');
      for (const row of res.rows.slice(0, 200)) {
        const tr = el('tr');
        for (const v of row)
          tr.append(el('td', v === null ? 'null' : undefined, v === null ? 'NULL' : String(v)));
        tbody.append(tr);
      }
      table.append(thead, tbody);
      wrap.append(table);
      out.replaceChildren(el('div', 'muted small', `${res.rows.length} ${t('sql.rows')}`), wrap);
    } catch (e) {
      out.replaceChildren(el('pre', 'sql-error', e instanceof Error ? e.message : String(e)));
    }
  }

  runBtn.addEventListener('click', run);
  resetBtn.addEventListener('click', () => {
    editor.value = original;
    run();
  });
  editor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: end, value } = editor;
      editor.value = value.slice(0, s) + '  ' + value.slice(end);
      editor.setSelectionRange(s + 2, s + 2);
    }
  });

  // Show the result right away so the article reads naturally.
  run();
}
