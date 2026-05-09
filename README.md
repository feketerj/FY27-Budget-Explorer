# FY27 Defense Budget Explorer

A local, queryable database and web interface built from the official FY27 President's Budget Request workbook. Search by program name, PE number, or keyword — or write SQL queries directly.

**What's in here:** 18,209 rows of defense budget data across Research (R-1), Procurement (P-1), and Service RDTE detail — every program element, every line item, every service branch.

---

## For Non-Technical Users (Read This First)

This tool runs on your own computer. No cloud, no accounts, no subscriptions. You need to install two things (Python and one library), then double-click a file. If you're working with an AI assistant (Claude, ChatGPT, etc.), give it this entire README and it can walk you through every step.

### What You Need to Install (One-Time Setup)

#### Step 1: Install Python

1. Open your web browser and go to **https://www.python.org/downloads/**
2. Click the big yellow **"Download Python 3.x.x"** button
3. **IMPORTANT:** When the installer opens, check the box that says **"Add Python to PATH"** at the bottom of the first screen
4. Click **"Install Now"**
5. Wait for it to finish. Click Close.

**To verify it worked:** Open a terminal (press `Win+R`, type `cmd`, press Enter) and type:
```
python --version
```
You should see something like `Python 3.12.x`. If you get an error, restart your computer and try again.

#### Step 2: Install the Required Library

Open a terminal (same as above) and run this one command:
```
pip install openpyxl
```
Wait for it to finish. That's it — you're done with setup.

### Step 3: Download This Repository

If you received this as a ZIP file, extract it to a folder on your computer (e.g., your Desktop).

If you received a GitHub link, either:
- Click the green **"Code"** button on GitHub → **"Download ZIP"** → extract it
- Or if you have Git installed: `git clone <the-url-you-were-given>`

### Step 4: Build the Database

Open a terminal, navigate to the folder, and run:
```
cd path\to\FY27_BUDGET
python load_budget.py
```

You should see output listing all 11 sheets being loaded, ending with:
```
DONE — 18209 total rows across 3 tables
  r1_research:      1163 rows
  p1_procurement:   1137 rows
  service_rdte:    15909 rows
```

This creates `FY27_budget.sqlite` — that's your database.

### Step 5: Launch the Explorer

**On Windows:** Double-click `start.bat`. Your browser will open automatically.

**Or manually from any OS:**
```
python frontend/serve.py
```
Then open http://127.0.0.1:8427 in your browser.

**To stop:** Double-click `stop.bat`, or press `Ctrl+C` in the terminal.

---

## How to Use the Explorer

### Quick Search (Easiest)

The search bar at the top is the fastest way to find anything:

| What you want | What to type |
|---|---|
| A specific program | Type its PE number: `0601102A` |
| Programs by topic | Type a keyword: `hypersonics`, `AI`, `missile defense` |
| A weapon system | Type its name: `F-47`, `B-21`, `DDG` |
| Everything for a service | Type: `Air Force`, `Navy`, `Army` |

Hit **Enter** and results appear instantly. Use the dropdown to limit to R-1 (Research), P-1 (Procurement), or Service RDTE (Detail).

### Preset Queries (One Click)

The sidebar on the left has **10 preset queries** for common questions:

- 🏆 Top 25 FY27 programs by funding
- 📈 Biggest year-over-year increases
- 📉 Biggest cuts
- 🆕 Brand new programs (no prior funding)
- 🛒 Top procurement items
- 🤖 AI/ML programs
- 🚀 Hypersonics programs
- 🔒 Classified rollup rows
- And more

Just click one and results appear.

### SQL Queries (Advanced)

If you know SQL (or your AI assistant does), type any query in the SQL Editor box and press **Ctrl+Enter**:

```sql
-- What's the FY27 request for a specific PE?
SELECT * FROM r1_research WHERE pe_bli = '0601102A';

-- All Navy RDTE programs over $500M
SELECT * FROM service_rdte
WHERE sheet_name = 'FY27 USN RDTE'
  AND row_type = 'PE'
  AND fy2027_total > 500000;

-- Year-over-year change for space programs
SELECT pe_bli, pe_bli_title, fy2026_total, fy2027_total,
       fy2027_total - fy2026_total AS delta
FROM r1_research
WHERE pe_bli_title LIKE '%Space%'
  AND row_kind = 'line_item'
ORDER BY delta DESC;
```

### Export

Click the **⬇ CSV** button after any query to download the results as a spreadsheet-compatible file.

---

## Database Reference

### Tables

| Table | Rows | What's In It |
|---|---|---|
| `r1_research` | 1,163 | R-1 summary — every RDT&E program element with FY25/26/27 funding levels |
| `p1_procurement` | 1,137 | P-1 summary — procurement line items with quantities and dollar amounts |
| `service_rdte` | 15,909 | Detailed RDTE by service — PE/Project/narrative rows for USSF, USAF, USA, USN, MDA, OSW, TJS, DARPA, SOCOM |

### Key Columns to Know

| Column | Table | What It Means |
|---|---|---|
| `pe_bli` | r1_research | Program Element number (e.g., `0601102A`) — unique ID for each R&D program |
| `pe_bli_title` | r1_research | Program name in plain English |
| `fy2027_total` | all tables | The FY27 budget request amount (in thousands of dollars) |
| `fy2026_total` | r1_research | Last year's enacted amount — compare with FY27 to see changes |
| `changes_notes` | r1_research | Dollar amount of the FY26→FY27 change |
| `row_kind` | r1_research | `line_item` = real program, `classified_rollup` = classified aggregation |
| `row_type` | service_rdte | `PE` = program element summary, `Project` = project detail, `A/PP` = accomplishments |
| `sheet_name` | service_rdte | Which service branch (e.g., `FY27 USAF RDTE`) |
| `add_non_add` | p1_procurement | `Add` = actual line item, `Non-Add` = subtotal (filter these out) |
| `bli_title` | p1_procurement | Procurement program name |

### Pre-Built Views (Shortcuts)

These are pre-filtered views you can query directly:

| View | What It Shows |
|---|---|
| `v_fy27_request_by_pe` | All R-1 programs ranked by FY27 request |
| `v_fy27_delta` | Programs with FY26→FY27 changes, sorted by biggest increase |
| `v_service_rdte_pe_summary` | Service RDTE PE-level summaries with percent change |
| `v_procurement_by_program` | Procurement line items (excludes subtotals) |

---

## For AI Assistants

If you're an AI assistant helping someone use this tool:

1. **The database file is `FY27_budget.sqlite`** — standard SQLite, no special extensions
2. **All dollar amounts are in thousands** — multiply by 1,000 for actual dollars
3. **Filter out subtotals:** Use `WHERE row_kind = 'line_item'` on r1_research, `WHERE add_non_add = 'Add'` on p1_procurement, and `WHERE row_type = 'PE'` on service_rdte for summary-level data
4. **The web API is at** `http://127.0.0.1:8427/api/query` — POST with `{"sql": "SELECT ..."}`, returns JSON with `columns` and `rows`
5. **Read-only enforced** — only SELECT/WITH queries are accepted by the API
6. **Result cap:** Server returns max 5,000 rows per query. Add LIMIT clauses for large tables.

---

## Files in This Repository

| File | Purpose |
|---|---|
| `FY27 Budget .xlsx` | Source workbook from DoD Comptroller (11 sheets) |
| `load_budget.py` | Builds the SQLite database from the workbook |
| `FY27_budget.sqlite` | The queryable database (built by load_budget.py) |
| `frontend/serve.py` | Local web server + SQL API |
| `frontend/index.html` | Web interface |
| `frontend/app.js` | Frontend application logic |
| `frontend/style.css` | Design/styling |
| `start.bat` | Windows: start the server + open browser |
| `stop.bat` | Windows: stop the server |
| `README.md` | This file |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `python` not recognized | Reinstall Python and check **"Add to PATH"**. Restart your terminal. |
| `pip` not recognized | Try `python -m pip install openpyxl` instead |
| `openpyxl` not found | Run `pip install openpyxl` |
| Database not found | Run `python load_budget.py` first |
| Port already in use | Run `stop.bat` first, or change the port: `python frontend/serve.py --port 9000` |
| Page won't load | Make sure `serve.py` is still running in the terminal |
| No data in sidebar | Check the terminal for errors — the database might not exist yet |
