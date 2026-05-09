/* ============================================================
   FY27 Budget Explorer — Application Logic
   ============================================================ */

const API = '';  // same origin

// ---- State ----
let schema = null;
let sortCol = -1;
let sortDir = 'asc';
let lastResult = null;

// ---- Preset Queries ----
const PRESETS = [
  {
    label: 'Top 25 FY27 Programs (R-1)',
    icon: '🏆',
    sql: `SELECT pe_bli, pe_bli_title, account_title,
       fy2027_total, fy2026_total, changes_notes AS delta
FROM r1_research
WHERE include_in_toa = 'Y' AND row_kind = 'line_item'
  AND fy2027_total IS NOT NULL
ORDER BY fy2027_total DESC
LIMIT 25;`
  },
  {
    label: 'Biggest FY26→FY27 Increases',
    icon: '📈',
    sql: `SELECT pe_bli, pe_bli_title, account_title,
       fy2026_total, fy2027_total, changes_notes AS delta,
       ROUND((fy2027_total - fy2026_total) * 100.0 / fy2026_total, 1) AS pct
FROM r1_research
WHERE include_in_toa = 'Y' AND row_kind = 'line_item'
  AND changes_notes IS NOT NULL AND fy2026_total > 0
ORDER BY changes_notes DESC
LIMIT 25;`
  },
  {
    label: 'Biggest FY26→FY27 Cuts',
    icon: '📉',
    sql: `SELECT pe_bli, pe_bli_title, account_title,
       fy2026_total, fy2027_total, changes_notes AS delta,
       ROUND((fy2027_total - fy2026_total) * 100.0 / fy2026_total, 1) AS pct
FROM r1_research
WHERE include_in_toa = 'Y' AND row_kind = 'line_item'
  AND changes_notes IS NOT NULL AND fy2026_total > 0
ORDER BY changes_notes ASC
LIMIT 25;`
  },
  {
    label: 'R-1 by Budget Activity',
    icon: '📊',
    sql: `SELECT budget_activity, budget_activity_title,
       COUNT(*) AS programs,
       ROUND(SUM(fy2027_total)) AS fy27_total,
       ROUND(SUM(fy2026_total)) AS fy26_total,
       ROUND(SUM(changes_notes)) AS net_delta
FROM r1_research
WHERE include_in_toa = 'Y' AND row_kind = 'line_item'
GROUP BY budget_activity, budget_activity_title
ORDER BY fy27_total DESC;`
  },
  {
    label: 'New Programs (FY27 only)',
    icon: '🆕',
    sql: `SELECT pe_bli, pe_bli_title, account_title, fy2027_total
FROM r1_research
WHERE include_in_toa = 'Y' AND row_kind = 'line_item'
  AND (fy2025_total IS NULL OR fy2025_total = 0)
  AND (fy2026_total IS NULL OR fy2026_total = 0)
  AND fy2027_total IS NOT NULL AND fy2027_total > 0
ORDER BY fy2027_total DESC;`
  },
  {
    label: 'Procurement — Top 25 by FY27 Amount',
    icon: '🛒',
    sql: `SELECT bli_title, account_title, cost_type_title,
       fy2027_total_qty AS qty, fy2027_total_amt AS amt,
       fy2026_total_amt AS fy26_amt
FROM p1_procurement
WHERE add_non_add = 'Add' AND fy2027_total_amt IS NOT NULL
ORDER BY fy2027_total_amt DESC
LIMIT 25;`
  },
  {
    label: 'Service RDTE — PE Summary by Service',
    icon: '⭐',
    sql: `SELECT sheet_name, pe_number, title,
       fy2025, fy2026, fy2027_total, fy2028,
       CASE WHEN fy2026 > 0
            THEN ROUND((fy2027_total - fy2026) * 100.0 / fy2026, 1)
            ELSE NULL END AS pct_chg
FROM service_rdte
WHERE row_type = 'PE' AND fy2027_total IS NOT NULL
ORDER BY fy2027_total DESC
LIMIT 40;`
  },
  {
    label: 'AI/ML Programs Across R-1',
    icon: '🤖',
    sql: `SELECT pe_bli, pe_bli_title, account_title,
       fy2026_total, fy2027_total, changes_notes AS delta
FROM r1_research
WHERE (pe_bli_title LIKE '%Artificial Intelligence%'
    OR pe_bli_title LIKE '%Machine Learning%'
    OR pe_bli_title LIKE '%AI/ML%')
  AND row_kind = 'line_item'
ORDER BY fy2027_total DESC NULLS LAST;`
  },
  {
    label: 'Hypersonics Programs',
    icon: '🚀',
    sql: `SELECT pe_bli, pe_bli_title, account_title,
       fy2026_total, fy2027_total, changes_notes AS delta
FROM r1_research
WHERE pe_bli_title LIKE '%Hypersonic%'
  AND row_kind = 'line_item'
ORDER BY fy2027_total DESC NULLS LAST;`
  },
  {
    label: 'Classified Rollup Rows',
    icon: '🔒',
    sql: `SELECT account_title, budget_activity, budget_activity_title,
       fy2025_total, fy2026_total, fy2027_total
FROM r1_research
WHERE row_kind = 'classified_rollup'
ORDER BY fy2027_total DESC NULLS LAST;`
  },
  {
    label: 'SATCOM & Ground Stations',
    icon: '📡',
    sql: `SELECT 'R-1' AS source, pe_bli AS id, pe_bli_title AS title,
       account_title AS org, fy2026_total, fy2027_total, changes_notes AS delta
FROM r1_research
WHERE row_kind = 'line_item'
  AND (pe_bli_title LIKE '%SATCOM%' OR pe_bli_title LIKE '%Satellite Comm%'
       OR pe_bli_title LIKE '%Ground Station%' OR pe_bli_title LIKE '%Ground Terminal%'
       OR pe_bli_title LIKE '%Space Ground%' OR pe_bli_title LIKE '%Wideband%'
       OR pe_bli_title LIKE '%MILSATCOM%' OR pe_bli_title LIKE '%Protected Comm%'
       OR pe_bli_title LIKE '%AEHF%' OR pe_bli_title LIKE '%WGS%'
       OR pe_bli_title LIKE '%Narrowband%' OR pe_bli_title LIKE '%FAB-T%'
       OR pe_bli_title LIKE '%Satellite Terminal%' OR pe_bli_title LIKE '%GPS%')
UNION ALL
SELECT sheet_name AS source, pe_number AS id, title,
       budget_activity AS org, fy2026 AS fy2026_total, fy2027_total, NULL AS delta
FROM service_rdte
WHERE row_type IN ('PE', 'Project')
  AND (title LIKE '%SATCOM%' OR title LIKE '%Satellite Comm%'
       OR title LIKE '%Ground Station%' OR title LIKE '%Ground Terminal%'
       OR title LIKE '%Space Ground%' OR title LIKE '%Wideband%'
       OR title LIKE '%MILSATCOM%' OR title LIKE '%Protected Comm%'
       OR title LIKE '%AEHF%' OR title LIKE '%WGS%'
       OR title LIKE '%Narrowband%' OR title LIKE '%FAB-T%'
       OR title LIKE '%Satellite Terminal%' OR title LIKE '%GPS%'
       OR description LIKE '%SATCOM%' OR description LIKE '%satellite communication%'
       OR description LIKE '%ground station%' OR description LIKE '%ground terminal%')
UNION ALL
SELECT 'P-1' AS source, budget_line_item AS id, bli_title AS title,
       account_title AS org, fy2026_total_amt AS fy2026_total, fy2027_total_amt AS fy2027_total, NULL AS delta
FROM p1_procurement
WHERE add_non_add = 'Add'
  AND (bli_title LIKE '%SATCOM%' OR bli_title LIKE '%Satellite Comm%'
       OR bli_title LIKE '%Ground Station%' OR bli_title LIKE '%Ground Terminal%'
       OR bli_title LIKE '%Wideband%' OR bli_title LIKE '%MILSATCOM%'
       OR bli_title LIKE '%AEHF%' OR bli_title LIKE '%WGS%'
       OR bli_title LIKE '%Satellite Terminal%' OR bli_title LIKE '%GPS%')
ORDER BY fy2027_total DESC NULLS LAST;`
  }
];

// ---- DOM ----
const $  = (s, p) => (p || document).querySelector(s);
const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

const dom = {};

function cacheDom() {
  dom.sqlInput      = $('#sql-input');
  dom.runBtn        = $('#btn-run');
  dom.clearBtn      = $('#btn-clear');
  dom.spinner       = $('#spinner');
  dom.resultsBar    = $('#results-bar');
  dom.resultsWrap   = $('#results-wrap');
  dom.schemaTables  = $('#schema-tables');
  dom.schemaViews   = $('#schema-views');
  dom.presetList    = $('#preset-list');
  dom.schemaDetail  = $('#schema-detail');
  dom.statRows      = $('#stat-rows');
  dom.statTables    = $('#stat-tables');
  dom.statViews     = $('#stat-views');
  dom.quickSearch   = $('#quick-search-input');
  dom.quickScope    = $('#quick-search-scope');
}

// ---- API ----

async function fetchSchema() {
  try {
    const res = await fetch(`${API}/api/schema`);
    schema = await res.json();
    renderSidebar();
    updateHeaderStats();
  } catch (err) {
    console.error('Failed to load schema:', err);
    dom.resultsWrap.innerHTML = `
      <div class="state-message">
        <div class="state-message-icon">⚠️</div>
        <div class="state-message-text">Could not connect to database</div>
        <div class="state-message-sub">Make sure serve.py is running and the database exists.</div>
      </div>`;
  }
}

async function runQuery(sql) {
  if (!sql.trim()) return;
  dom.spinner.classList.add('active');
  dom.runBtn.disabled = true;
  dom.resultsBar.innerHTML = '';

  try {
    const res = await fetch(`${API}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    const data = await res.json();

    if (data.error) {
      showError(data.error);
      return;
    }

    lastResult = data;
    sortCol = -1;
    sortDir = 'asc';
    renderResultsBar(data);
    renderTable(data.columns, data.rows);

  } catch (err) {
    showError(`Network error: ${err.message}`);
  } finally {
    dom.spinner.classList.remove('active');
    dom.runBtn.disabled = false;
  }
}

// ---- Rendering ----

function renderSidebar() {
  if (!schema) return;

  // Tables
  let tablesHtml = '';
  for (const [name, info] of Object.entries(schema.tables)) {
    tablesHtml += `
      <div class="schema-item" data-table="${name}">
        <div class="schema-item-name">${name}</div>
        <div class="schema-item-meta">
          ${info.columns.length} cols
          <span class="schema-item-badge">${info.row_count.toLocaleString()} rows</span>
        </div>
      </div>`;
  }
  dom.schemaTables.innerHTML = tablesHtml;

  // Views
  let viewsHtml = '';
  for (const [name, info] of Object.entries(schema.views)) {
    viewsHtml += `
      <div class="schema-item" data-view="${name}">
        <div class="schema-item-name">${name}</div>
        <div class="schema-item-meta">
          <span class="schema-item-badge">${info.row_count.toLocaleString()} rows</span>
        </div>
      </div>`;
  }
  dom.schemaViews.innerHTML = viewsHtml;

  // Presets
  let presetsHtml = '';
  for (let i = 0; i < PRESETS.length; i++) {
    const p = PRESETS[i];
    presetsHtml += `
      <button class="preset-btn" data-preset="${i}">
        <span class="preset-icon">${p.icon}</span>${p.label}
      </button>`;
  }
  dom.presetList.innerHTML = presetsHtml;

  // Event listeners
  $$('.schema-item[data-table]', dom.schemaTables).forEach(el => {
    el.addEventListener('click', () => showTableSchema(el.dataset.table));
  });

  $$('.schema-item[data-view]', dom.schemaViews).forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.view;
      dom.sqlInput.value = `SELECT * FROM ${name} LIMIT 100;`;
      runQuery(dom.sqlInput.value);
    });
  });

  $$('.preset-btn', dom.presetList).forEach(el => {
    el.addEventListener('click', () => {
      const p = PRESETS[parseInt(el.dataset.preset)];
      dom.sqlInput.value = p.sql;
      runQuery(p.sql);
    });
  });
}

function showTableSchema(tableName) {
  const info = schema.tables[tableName];
  if (!info) return;

  // Highlight active
  $$('.schema-item', dom.schemaTables).forEach(el =>
    el.classList.toggle('active', el.dataset.table === tableName)
  );

  let colsHtml = '';
  for (const col of info.columns) {
    colsHtml += `
      <div class="schema-col">
        <span class="schema-col-name">${col.pk ? '🔑 ' : ''}${col.name}</span>
        <span class="schema-col-type">${col.type || 'any'}</span>
      </div>`;
  }

  dom.schemaDetail.innerHTML = `
    <h3>${tableName}</h3>
    <div class="schema-cols">${colsHtml}</div>`;
  dom.schemaDetail.classList.add('visible');

  // Also load a preview
  dom.sqlInput.value = `SELECT * FROM ${tableName} LIMIT 50;`;
  runQuery(dom.sqlInput.value);
}

function updateHeaderStats() {
  if (!schema) return;
  let totalRows = 0;
  for (const info of Object.values(schema.tables)) totalRows += info.row_count;
  dom.statRows.textContent = totalRows.toLocaleString();
  dom.statTables.textContent = Object.keys(schema.tables).length;
  dom.statViews.textContent = Object.keys(schema.views).length;
}

function renderResultsBar(data) {
  let barHtml = `
    <div class="results-bar-left">
      <span class="badge badge-success">✓ ${data.row_count.toLocaleString()} rows</span>
      <span class="badge badge-time">⏱ ${data.elapsed_ms}ms</span>
      ${data.warning ? `<span class="badge badge-error" style="background:rgba(245,158,11,.12);color:var(--warning)">⚠ ${data.warning}</span>` : ''}
    </div>
    <div>
      <button class="btn btn-secondary" id="btn-export-csv" title="Download CSV">⬇ CSV</button>
    </div>`;
  dom.resultsBar.innerHTML = barHtml;

  $('#btn-export-csv').addEventListener('click', () => exportCsv(data));
}

function renderTable(columns, rows) {
  if (!columns.length) {
    dom.resultsWrap.innerHTML = `
      <div class="state-message">
        <div class="state-message-icon">📭</div>
        <div class="state-message-text">Query returned no columns</div>
      </div>`;
    return;
  }

  if (!rows.length) {
    dom.resultsWrap.innerHTML = `
      <div class="state-message">
        <div class="state-message-icon">🔍</div>
        <div class="state-message-text">No rows matched</div>
        <div class="state-message-sub">Try broadening your WHERE clause or checking table names.</div>
      </div>`;
    return;
  }

  // Detect numeric columns
  const numCols = new Set();
  for (let ci = 0; ci < columns.length; ci++) {
    let isNum = true;
    for (let ri = 0; ri < Math.min(rows.length, 20); ri++) {
      const v = rows[ri][ci];
      if (v !== null && typeof v !== 'number') { isNum = false; break; }
    }
    if (isNum) numCols.add(ci);
  }

  let thead = '<tr>';
  for (let ci = 0; ci < columns.length; ci++) {
    const cls = ci === sortCol ? (sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';
    thead += `<th class="${cls}" data-col="${ci}">${escapeHtml(columns[ci])}</th>`;
  }
  thead += '</tr>';

  let tbody = '';
  for (const row of rows) {
    tbody += '<tr>';
    for (let ci = 0; ci < row.length; ci++) {
      const v = row[ci];
      if (v === null || v === undefined) {
        tbody += '<td style="color:var(--text-muted)">—</td>';
      } else if (numCols.has(ci)) {
        tbody += `<td class="num">${formatNum(v)}</td>`;
      } else {
        const s = String(v);
        const display = s.length > 120 ? s.slice(0, 117) + '…' : s;
        tbody += `<td title="${escapeAttr(s)}">${escapeHtml(display)}</td>`;
      }
    }
    tbody += '</tr>';
  }

  dom.resultsWrap.innerHTML = `
    <div class="results-table-scroll">
      <table class="results-table">
        <thead>${thead}</thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  // Column sort click handlers
  $$('.results-table th').forEach(th => {
    th.addEventListener('click', () => {
      const ci = parseInt(th.dataset.col);
      if (sortCol === ci) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = ci;
        sortDir = 'asc';
      }
      const sorted = [...lastResult.rows].sort((a, b) => {
        let va = a[ci], vb = b[ci];
        if (va === null) return 1;
        if (vb === null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDir === 'asc' ? va - vb : vb - va;
        }
        va = String(va); vb = String(vb);
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
      renderTable(lastResult.columns, sorted);
    });
  });
}

function showError(msg) {
  dom.resultsBar.innerHTML = `
    <div class="results-bar-left">
      <span class="badge badge-error">✗ Error</span>
    </div>`;
  dom.resultsWrap.innerHTML = `<div class="error-box">${escapeHtml(msg)}</div>`;
}

// ---- Export ----

function exportCsv(data) {
  if (!data || !data.columns.length) return;
  const lines = [data.columns.map(csvEscape).join(',')];
  for (const row of data.rows) {
    lines.push(row.map(v => csvEscape(v === null ? '' : v)).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fy27_budget_query.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(val) {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ---- Utilities ----

function formatNum(n) {
  if (typeof n !== 'number') return String(n);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// ---- Quick Search ----

function quickSearch(term) {
  if (!term.trim()) return;
  const escaped = term.replace(/'/g, "''");
  const like = `'%${escaped}%'`;
  const scope = dom.quickScope.value;

  const queries = [];

  if (scope === 'all' || scope === 'r1') {
    queries.push(`SELECT 'R-1' AS source, pe_bli AS id, pe_bli_title AS title,
       account_title AS org, budget_activity_title AS category,
       fy2026_total, fy2027_total, changes_notes AS delta, classification
FROM r1_research
WHERE row_kind = 'line_item'
  AND (pe_bli LIKE ${like} OR pe_bli_title LIKE ${like}
       OR account_title LIKE ${like} OR budget_activity_title LIKE ${like})`);
  }

  if (scope === 'all' || scope === 'p1') {
    queries.push(`SELECT 'P-1' AS source, budget_line_item AS id, bli_title AS title,
       account_title AS org, budget_activity_title AS category,
       fy2026_total_amt AS fy2026_total, fy2027_total_amt AS fy2027_total,
       NULL AS delta, classification
FROM p1_procurement
WHERE add_non_add = 'Add'
  AND (budget_line_item LIKE ${like} OR bli_title LIKE ${like}
       OR account_title LIKE ${like} OR cost_type_title LIKE ${like})`);
  }

  if (scope === 'all' || scope === 'rdte') {
    queries.push(`SELECT sheet_name AS source, pe_number AS id, title,
       budget_activity AS org, row_type AS category,
       fy2026 AS fy2026_total, fy2027_total,
       NULL AS delta, NULL AS classification
FROM service_rdte
WHERE row_type IN ('PE', 'Project')
  AND (pe_number LIKE ${like} OR title LIKE ${like}
       OR project_number LIKE ${like} OR description LIKE ${like})`);
  }

  if (!queries.length) return;

  const sql = queries.join('\nUNION ALL\n') + '\nORDER BY fy2027_total DESC NULLS LAST\nLIMIT 200;';
  dom.sqlInput.value = sql;
  runQuery(sql);
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();

  dom.runBtn.addEventListener('click', () => runQuery(dom.sqlInput.value));

  dom.clearBtn.addEventListener('click', () => {
    dom.sqlInput.value = '';
    dom.resultsBar.innerHTML = '';
    dom.resultsWrap.innerHTML = `
      <div class="state-message">
        <div class="state-message-icon">⚡</div>
        <div class="state-message-text">Write a query or pick a preset</div>
        <div class="state-message-sub">Use the sidebar to explore tables, views, and preset queries.</div>
      </div>`;
    dom.schemaDetail.classList.remove('visible');
    $$('.schema-item').forEach(el => el.classList.remove('active'));
    lastResult = null;
  });

  // Ctrl+Enter to run
  dom.sqlInput.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery(dom.sqlInput.value);
    }
  });

  // Quick search on Enter
  dom.quickSearch.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      quickSearch(dom.quickSearch.value);
    }
  });

  fetchSchema();
});
