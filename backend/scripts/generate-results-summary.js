'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

function parseArgs(argv) {
	const args = {};
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--in' || a === '--input') {
			args.input = argv[++i];
		} else if (a === '--out' || a === '--output') {
			args.output = argv[++i];
		}
	}
	return args;
}

function normalizeKey(key) {
	return String(key || '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

function buildHeaderMap(row) {
	const map = {};
	Object.keys(row).forEach((k) => {
		map[normalizeKey(k)] = k;
	});
	return map;
}

function getFirstValue(row, headerMap, candidates) {
	for (const c of candidates) {
		const foundKey = headerMap[normalizeKey(c)];
		if (foundKey && row[foundKey] != null && String(row[foundKey]).trim() !== '') {
			return row[foundKey];
		}
		// Try partial matches (e.g., "Overall Total" should match "total")
		for (const hk of Object.keys(headerMap)) {
			if (hk.includes(normalizeKey(c))) {
				const original = headerMap[hk];
				const v = row[original];
				if (v != null && String(v).trim() !== '') return v;
			}
		}
	}
	return undefined;
}

function looksLikeDisability(value) {
	if (value == null) return false;
	const s = String(value).toLowerCase();
	return /\bdisab/.test(s) || /\bdmd\b/.test(s) || /\btrd\b/.test(s);
}

function detectDisabilityFromRow(row) {
	for (const v of Object.values(row)) {
		if (typeof v === 'string' && looksLikeDisability(v)) return true;
	}
	return false;
}

function deriveAgeGroup(row, headerMap) {
	const gender = getFirstValue(row, headerMap, ['Gender', 'Sex']);
	const ageGroup = getFirstValue(row, headerMap, ['Age Group', 'AgeGroup', 'Age group', 'Age']);
	const category = getFirstValue(row, headerMap, ['Category', 'Event', 'Level', 'Class', 'Group']);

	// Prefer explicit age group + gender if present
	if (ageGroup && gender) return `${String(gender).trim()} ${String(ageGroup).trim()}`.trim();
	if (ageGroup) return String(ageGroup).trim();

	// Try to extract from category-like strings
	if (category) {
		const s = String(category);
		const genderMatch = s.match(/\b(Women|Woman|Men|Man|Girls?|Boys?)\b/i);
		const ageMatch = s.match(/\b(\d{1,2}\+\b|\d{1,2}\s*-\s*\d{1,2}\b|\bUnder\s*\d{1,2}\b|\bU\d{1,2}\b|\b\d{1,2}\b)/i);
		if (genderMatch && ageMatch) return `${genderMatch[0]} ${ageMatch[0]}`.replace(/\s+/g, ' ').trim();
		if (genderMatch) return genderMatch[0];
		if (ageMatch) return ageMatch[0];
	}

	// Fallback: combine any hints
	if (gender) return String(gender).trim();
	return 'Unknown';
}

function toNumberOrString(value) {
	if (value == null) return '';
	const num = Number(String(value).replace(/[^\d.-]/g, ''));
	if (Number.isFinite(num)) return num;
	return String(value).trim();
}

function formatScore(value) {
	const v = toNumberOrString(value);
	if (typeof v === 'number') return v.toFixed(3);
	return v;
}

function shouldIncludeSheet(sheetName) {
	const s = String(sheetName).toLowerCase();
	// Only include the primary result sheets, not DD/Teams/Region/etc.
	return s === 'dmt' || s === 'tra';
}

function determineDisciplineBase(sheetName) {
	const s = String(sheetName).toLowerCase();
	if (s.includes('dmt')) return 'DMT';
	return 'Trampoline TRA';
}

function determineDiscipline(sheetName, row, headerMap) {
	const base = determineDisciplineBase(sheetName);
	const disability =
		looksLikeDisability(getFirstValue(row, headerMap, ['Disability', 'Category', 'Class', 'Event'])) ||
		detectDisabilityFromRow(row);
	if (base === 'DMT') return disability ? 'DMT Disability - DMD' : 'DMT';
	return disability ? 'Trampoline Disability TRD' : 'Trampoline TRA';
}

function extractRow(row, sheetName) {
	const headerMap = buildHeaderMap(row);

	const position = getFirstValue(row, headerMap, ['Position', 'Pos', 'Rank', 'Place', 'Overall Position']);
	const name = getFirstValue(row, headerMap, ['Name', 'Competitor', 'Gymnast', 'Athlete']);
	const club = getFirstValue(row, headerMap, ['Club', 'Team', 'Organisation', 'Organization']);
	const total = getFirstValue(row, headerMap, ['Total', 'Overall', 'Final', 'Score', 'Total Score', 'Overall Total']);
	const discipline = determineDiscipline(sheetName, row, headerMap);
	const ageGroup = deriveAgeGroup(row, headerMap);

	const clean = (v) => (v == null ? '' : String(v).toString().trim());

	return {
		position: clean(position),
		name: clean(name),
		club: clean(club),
		totalScore: formatScore(total),
		discipline,
		ageGroup: clean(ageGroup),
	};
}

function loadWorkbook(filePath) {
	return XLSX.readFile(filePath, { cellDates: false });
}

function toJsonFromSheets(wb) {
	const results = [];
	for (const sheetName of wb.SheetNames) {
		if (!shouldIncludeSheet(sheetName)) continue;
		const ws = wb.Sheets[sheetName];
		results.push(...extractFromStructuredSheet(ws, sheetName));
	}
	return results;
}

function uniqueSorted(values) {
	return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

function buildHtml(data, customCss) {
	const disciplines = uniqueSorted(data.map((d) => d.discipline));
	const categories = uniqueSorted(data.map((d) => d.categoryPart));
	const ageGroups = uniqueSorted(data.map((d) => d.ageGroup));
	const clubs = uniqueSorted(data.map((d) => d.club));
	const json = JSON.stringify(data);

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Competition Results Summary</title>
	<style>
		body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #111; }
		h1 { font-size: 20px; margin: 0 0 16px; }
		.controls { display: grid; grid-template-columns: repeat(5, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
		.controls label { display: flex; flex-direction: column; font-size: 12px; color: #444; gap: 6px; }
		.filters-header { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 8px; max-width: 90%}
		.filters-toggle { appearance: none; border: 1px solid #d1d5db; background: #fff; color: #111; padding: 6px 10px; border-radius: 8px; font-size: 13px; cursor: pointer; }
		.filters-toggle:hover { background: #f9fafb; }
		.filters-collapsible[hidden] { display: none !important; }
		input[type="text"], select { padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; }
		.table-container { width: 100%; max-width: 90%; }
		table { width: 100%; border-collapse: collapse; min-width: 720px; }
		th, td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; text-align: left; }
		th { position: sticky; top: 0; background: #fafafa; z-index: 1; }
		tbody tr:hover { background: #f8fbff; }
		.meta { font-size: 12px; color: #666; margin-bottom: 10px; }
		.badge { display: inline-block; background: #eef2ff; color: #3730a3; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
		.count { margin-left: 8px; font-size: 12px; color: #666; }
		.group-header { background: #f3f4f6; font-weight: 600; }
		.group-header td { padding-top: 16px; }
		.green-row { background: #e8fbe8 !important; }
		/* Desktop/tablet: hide condensed meta line */
		td.meta-line-cell, td.summary-line-cell { display: none; }
		@media (max-width: 640px) {
			body { margin: 16px; }
			.controls { grid-template-columns: 1fr; max-width: 90%; }
			input[type="text"], select { font-size: 12px; }
			.table-container { overflow: visible; }
			table { min-width: 0; max-width: 100%;}
			table, thead, tbody, th, td, tr { display: block; }
			thead { display: none; }
			tbody tr { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 10px 12px; margin: 0 0 12px 0; box-shadow: 0 1px 1px rgba(0,0,0,0.02); width: 100%; box-sizing: border-box; }
			th, td { padding: 6px 0; font-size: 13px; border-bottom: none; text-align: center; }
			td { display: block; word-break: break-word; overflow-wrap: anywhere; }
			td::before { content: attr(data-label); display: block; font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .02em; margin-bottom: 2px; }
			td[data-key="name"] { font-size: 16px; font-weight: 700; margin-top: 2px; line-height: 1.2; }
			td[data-key="position"] .pos-badge { background: #111; color: #fff; border-radius: 999px; padding: 2px 8px; font-size: 12px; display: inline-block; }
			td[data-key="total"] { font-size: 16px; font-weight: 600; }
			/* Hide verbose columns and show condensed summary/meta lines */
			td[data-key="position"], td[data-key="name"], td[data-key="total"],
			td[data-key="club"], td[data-key="discipline"], td[data-key="category"], td[data-key="age"] { display: none; }

			td.summary-line-cell { display: block; margin-bottom: 6px; padding: 0; width: 100%; box-sizing: border-box; }
			td.summary-line-cell .sum-grid { display: grid; grid-template-columns: 28px 1fr; column-gap: 10px; align-items: stretch; }
			td.summary-line-cell .sum-pos { background:rgb(193, 197, 199); color:white; border-radius: 90px; display: flex; align-items: center; justify-content: center; }
			td.summary-line-cell .sum-pos .pos-badge { font-size: 24px; padding: 4px 12px; line-height: 1; }
			td.summary-line-cell .sum-top { display: grid; grid-template-columns: 1fr max-content; align-items: center; column-gap: 8px; }
			td.summary-line-cell .sum-name { font-weight: 700; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; min-width: 0; }
			td.summary-line-cell .sum-score { font-weight: 600; font-size: 13px; text-align: center; white-space: nowrap; line-height: 1; justify-self: center; }
			td.summary-line-cell .sum-bottom { margin-top: 4px; font-size: 12px; color: #6b7280; text-align: left; }
			td.meta-line-cell { display: none; }

			td[data-key="discipline"] .badge { font-size: 11px; }
			.group-header td { display: block !important; padding: 6px 0; border: none; }
			.badge { font-size: 11px; }
		}
	</style>
	${customCss ? `<style data-preserved-user-css>\n${customCss}\n</style>` : ''}
</head>
<body>
	<h1>Competition Results Summary</h1>
	<div class="meta">Generated from DMT and TRA sheets</div>
	<div class="filters-header">
		<button id="filtersToggle" class="filters-toggle" type="button" aria-expanded="true" aria-controls="filtersSection">Hide filters</button>
	</div>
	<div id="filtersSection" class="controls filters-collapsible">
		<label>
			Search (name)
			<input id="searchInput" type="text" placeholder="Type a name..." />
		</label>
		<label>
			Discipline
			<select id="disciplineFilter">
				<option value="">All</option>
				${disciplines.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('')}
			</select>
		</label>
		<label>
			Category
			<select id="categoryFilter">
				<option value="">All</option>
				${categories.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('')}
			</select>
		</label>
		<label>
			Age group
			<select id="ageFilter">
				<option value="">All</option>
				${ageGroups.map((a) => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('')}
			</select>
		</label>
		<label>
			Club
			<select id="clubFilter">
				<option value="">All</option>
				${clubs.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
			</select>
		</label>
	</div>
	<div class="count"><span id="count"></span></div>
	<div class="table-container">
	<table>
		<thead>
			<tr>
				<th>Position</th>
				<th>Competitor</th>
				<th>Club</th>
				<th>Total Score</th>
				<th>Discipline</th>
				<th>Category</th>
				<th>Age Group</th>
			</tr>
		</thead>
		<tbody id="resultsBody"></tbody>
	</table>
	</div>
	<script>
		const DATA = ${json};

		function escapeHtml(s) {
			return String(s)
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#039;');
		}

		// Collapsible filters
		const filtersToggleBtn = document.getElementById('filtersToggle');
		const filtersSection = document.getElementById('filtersSection');
		function setFiltersCollapsed(collapsed) {
			filtersSection.hidden = collapsed;
			filtersToggleBtn.setAttribute('aria-expanded', String(!collapsed));
			filtersToggleBtn.textContent = collapsed ? 'Show filters' : 'Hide filters';
		}
		(function initFiltersCollapse() {
			try {
				const isMobile = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
				setFiltersCollapsed(!!isMobile);
			} catch (_) {
				setFiltersCollapsed(false);
			}
		})();
		filtersToggleBtn.addEventListener('click', () => {
			const collapsed = filtersSection.hidden === true;
			setFiltersCollapsed(!collapsed);
		});

		function getGroupKey(row) {
			return [row.discipline, row.categoryPart, row.ageGroup].filter(Boolean).join(' - ');
		}

		function renderRows(rows) {
			const tbody = document.getElementById('resultsBody');
			let html = '';
			let currentGroup = null;
			for (const r of rows) {
				const rk = getGroupKey(r) || 'Unknown';
				if (rk !== currentGroup) {
					currentGroup = rk;
					html += \`<tr class="group-header"><td colspan="7">\${escapeHtml(currentGroup)}</td></tr>\`;
				}
				const trClass = r.isGreen ? ' class="green-row"' : '';
				html += \`
				<tr\${trClass}>
					<td class="summary-line-cell" data-key="summary">
						<div class="sum-grid">
							<div class="sum-pos"><span class="pos-badge">\${escapeHtml(r.position)}</span></div>
							<div class="sum-main">
								<div class="sum-top">
									<span class="sum-name">\${escapeHtml(r.name)}</span>
									<span class="sum-score">\${escapeHtml(r.totalScore)}</span>
								</div>
								<div class="sum-bottom">\${escapeHtml(r.club)} <span class="dot">•</span> \${escapeHtml(r.discipline)} <span class="dot">•</span> \${escapeHtml(r.categoryPart)} <span class="dot">•</span> \${escapeHtml(r.ageGroup)}</div>
							</div>
						</div>
					</td>
					<td data-label="Position" data-key="position"><span class="pos-badge">\${escapeHtml(r.position)}</span></td>
					<td data-label="Competitor" data-key="name">\${escapeHtml(r.name)}</td>
					<td data-label="Club" data-key="club">\${escapeHtml(r.club)}</td>
					<td data-label="Total Score" data-key="total">\${escapeHtml(r.totalScore)}</td>
					<td data-label="Discipline" data-key="discipline"><span class="badge">\${escapeHtml(r.discipline)}</span></td>
					<td data-label="Category" data-key="category">\${escapeHtml(r.categoryPart)}</td>
					<td data-label="Age Group" data-key="age">\${escapeHtml(r.ageGroup)}</td>
					<td class="meta-line-cell" data-key="meta">\${escapeHtml(r.club)} <span class="dot">•</span> \${escapeHtml(r.discipline)} <span class="dot">•</span> \${escapeHtml(r.categoryPart)} <span class="dot">•</span> \${escapeHtml(r.ageGroup)}</td>
				</tr>\`;
			}
			tbody.innerHTML = html;
			document.getElementById('count').textContent = rows.length + ' of ' + DATA.length + ' shown';
		}

		function applyFilters() {
			const q = document.getElementById('searchInput').value.trim().toLowerCase();
			const d = document.getElementById('disciplineFilter').value;
			const cat = document.getElementById('categoryFilter').value;
			const a = document.getElementById('ageFilter').value;
			const c = document.getElementById('clubFilter').value;
			const filtered = DATA.filter(row => {
				if (d && row.discipline !== d) return false;
				if (cat && row.categoryPart !== cat) return false;
				if (a && row.ageGroup !== a) return false;
				if (c && row.club !== c) return false;
				if (q) {
					const nameHay = String(row.name || '').toLowerCase();
					if (!nameHay.includes(q)) return false;
				}
				return true;
			});
			// Sort by group header (discipline+category+age), then position ASC within group (1 first)
			filtered.sort((x, y) => {
				const gx = getGroupKey(x);
				const gy = getGroupKey(y);
				const gcmp = String(gx).localeCompare(String(gy));
				if (gcmp !== 0) return gcmp;
				const xi = parseInt(String(x.position || '').replace(/[^\\d-]/g, ''), 10);
				const yi = parseInt(String(y.position || '').replace(/[^\\d-]/g, ''), 10);
				const xHas = Number.isFinite(xi);
				const yHas = Number.isFinite(yi);
				if (xHas && yHas) {
					if (xi !== yi) return xi - yi; // ASC: 1st place first
					return String(x.name).localeCompare(String(y.name));
				}
				if (xHas && !yHas) return -1; // numeric positions before non-numeric
				if (!xHas && yHas) return 1;  // non-numeric after numeric
				return String(x.name).localeCompare(String(y.name));
			});
			renderRows(filtered);
		}

		document.getElementById('searchInput').addEventListener('input', applyFilters);
		document.getElementById('disciplineFilter').addEventListener('change', applyFilters);
		document.getElementById('categoryFilter').addEventListener('change', applyFilters);
		document.getElementById('ageFilter').addEventListener('change', applyFilters);
		document.getElementById('clubFilter').addEventListener('change', applyFilters);
		applyFilters();
	</script>
</body>
</html>`;
}

function escapeHtml(s) {
	return String(s)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function main() {
	const args = parseArgs(process.argv);
	const projectRoot = path.resolve(__dirname, '..', '..');
	const defaultInput = path.join(projectRoot, 'resources', 'results', '2026-01-18-Results-NoBG.xlsx');
	const defaultOutput = path.join(projectRoot, 'frontend', 'public', 'results', '2026', 'regional', 'q1', 'index.html');

	const inputPath = path.resolve(args.input || defaultInput);
	const outputPath = path.resolve(args.output || defaultOutput);

	if (!fs.existsSync(inputPath)) {
		console.error('Input file not found:', inputPath);
		process.exit(1);
	}

	const wb = loadWorkbook(inputPath);
	let data = toJsonFromSheets(wb);
	// Enhance: detect green highlighted rows via ExcelJS and annotate
	collectGreenRows(inputPath, data)
		.then((annotated) => {
			data = annotated;
			let preservedCss = '';
			if (fs.existsSync(outputPath)) {
				try {
					const existing = fs.readFileSync(outputPath, 'utf8');
					// Prefer explicitly marked preserved CSS if available
					const marked = existing.match(/<style[^>]*data-preserved-user-css[^>]*>([\s\S]*?)<\/style>/i);
					if (marked && marked[1]) {
						preservedCss = marked[1].trim();
					} else {
						// Fallback: capture the last <style> block in the head as user CSS
						const styles = Array.from(existing.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1]);
						if (styles.length > 0) {
							// Exclude our base CSS by heuristic: if it contains '.controls' and 'group-header', treat as base
							const userBlocks = styles.filter(s => !/\.group-header/.test(s) || !/\.controls/.test(s));
							preservedCss = (userBlocks[userBlocks.length - 1] || '').trim();
						}
					}
				} catch (e) {
					// ignore
				}
			}
			const html = buildHtml(data, preservedCss);
			fs.mkdirSync(path.dirname(outputPath), { recursive: true });
			fs.writeFileSync(outputPath, html, 'utf8');
			console.log('Summary written to', outputPath, 'with', data.length, 'rows');
		})
		.catch((err) => {
			console.warn('Warning: failed to detect green rows, continuing without highlight.', err && err.message ? err.message : err);
			const html = buildHtml(data, '');
			fs.mkdirSync(path.dirname(outputPath), { recursive: true });
			fs.writeFileSync(outputPath, html, 'utf8');
			console.log('Summary written to', outputPath, 'with', data.length, 'rows');
		});
}

if (require.main === module) {
	main();
}

// Structured (header-scanning) extraction for sheets that contain repeated tables
function extractFromStructuredSheet(ws, sheetName) {
	const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
	const out = [];
	const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
	const baseRow = range.s.r; // zero-based
	const baseCol = range.s.c; // zero-based

	function colLetterToIndex(col) {
		let n = 0;
		for (let i = 0; i < col.length; i++) {
			n = n * 26 + (col.charCodeAt(i) - 64);
		}
		return n - 1; // zero-based
	}
	function getWsCell(wsLocal, colLetter, rowNumber) {
		const addr = `${colLetter}${rowNumber}`;
		const cell = wsLocal[addr];
		if (!cell) return '';
		// Prefer formatted text if present, else raw value
		if (cell.w != null && cell.w !== '') return String(cell.w);
		if (cell.v != null) return String(cell.v);
		return '';
	}

	const posHeaders = ['pos', 'position', 'rank', 'place'];
	const nameHeaders = ['name', 'competitor', 'gymnast', 'athlete'];
	const clubHeaders = ['club', 'team', 'organisation', 'organization'];
	const totalHeaders = ['total', 'overall', 'final', 'score', 'total score', 'overall total'];
	const ageHeaders = ['age group', 'age', 'group', 'category', 'class', 'event', 'level', 'division'];
	const genderHeaders = ['gender', 'sex'];
	const forenameHeaders = ['forename', 'first name', 'firstname', 'first'];
	const surnameHeaders = ['surname', 'last name', 'lastname', 'last'];

	function norm(s) {
		return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
	}
	function findColIndex(headerRow, candidates) {
		const idx1 = headerRow.findIndex((h) => candidates.includes(norm(h)));
		if (idx1 !== -1) return idx1;
		// partial contains
		for (let i = 0; i < headerRow.length; i++) {
			const h = norm(headerRow[i]);
			if (!h) continue;
			for (const c of candidates) {
				if (h.includes(c)) return i;
			}
		}
		return -1;
	}
	function isLikelyHeader(rowArr) {
		if (!rowArr) return false;
		const hasName = findColIndex(rowArr, nameHeaders) !== -1;
		const hasFore = findColIndex(rowArr, forenameHeaders) !== -1;
		const hasSur = findColIndex(rowArr, surnameHeaders) !== -1;
		const hasTotalOrScore = findColIndex(rowArr, totalHeaders) !== -1;
		const hasClubOrTeam = findColIndex(rowArr, clubHeaders) !== -1;
		return (hasName || (hasFore && hasSur)) && (hasTotalOrScore || hasClubOrTeam);
	}
	function getVal(rowArr, idx) {
		if (idx < 0) return '';
		return rowArr[idx] == null ? '' : String(rowArr[idx]).trim();
	}
	function determineDisc(sheetNameLocal, rowLike) {
		// If sheet name contains 'DD' treat as disability
		const s = String(sheetNameLocal).toLowerCase();
		const base = determineDisciplineBase(sheetNameLocal);
		const isDis = s.includes(' dd') || s.endsWith('dd') || s.includes('with deductions') || detectDisabilityFromRow(rowLike);
		if (base === 'DMT') return isDis ? 'DMT Disability - DMD' : 'DMT';
		return isDis ? 'Trampoline Disability TRD' : 'Trampoline TRA';
	}
	function determineDiscCode(sheetNameLocal, rowLike) {
		const disc = determineDisc(sheetNameLocal, rowLike);
		if (disc.startsWith('Trampoline Disability')) return 'TPD';
		if (disc.startsWith('Trampoline')) return 'TRA';
		if (disc.startsWith('DMT Disability')) return 'DMD';
		return 'DMT';
	}
	function findGroupTitle(rowsArr, idx) {
		// Scan up to 5 rows above for a single non-empty text that looks like a title
		for (let k = idx - 1; k >= Math.max(0, idx - 5); k--) {
			const r = rowsArr[k];
			if (!r) continue;
			// Join first few cells as text
			const joined = r.map((x) => (x == null ? '' : String(x))).join(' ').replace(/\s+/g, ' ').trim();
			if (joined && / - /.test(joined)) {
				return joined;
			}
			// Sometimes title is just in first cell
			if (r[0] && / - /.test(String(r[0]))) return String(r[0]).trim();
		}
		return '';
	}
	function parseTitleForParts(title, sheetNameLocal, rowLike) {
		const m = title.match(/^(TRA|TPD|DMT|DMD)\s+(.+?)\s*-\s*(.+)$/i);
		if (m) {
			return {
				disciplineCode: m[1].toUpperCase(),
				categoryPart: m[2].trim(),
				aggregateAge: m[3].trim(),
			};
		}
		// Fallbacks
		const disciplineCode = determineDiscCode(sheetNameLocal, rowLike);
		const derivedAge = deriveAgeGroup({}, buildHeaderMap({})); // not helpful; set to Unknown and replace later
		return {
			disciplineCode,
			categoryPart: '',
			aggregateAge: '',
		};
	}

	let i = 0;
	while (i < rows.length) {
		const row = rows[i];
		if (!row || row.every((c) => c == null || String(c).trim() === '')) {
			i++;
			continue;
		}
		// Identify header
		if (!isLikelyHeader(row)) {
			i++;
			continue;
		}
		const tableTitle = findGroupTitle(rows, i);
		const posIdx = findColIndex(row, posHeaders);
		const nameIdx = findColIndex(row, nameHeaders);
		const clubIdx = findColIndex(row, clubHeaders);
		const totalIdx = findColIndex(row, totalHeaders);
		const ageIdx = findColIndex(row, ageHeaders);
		const genderIdx = findColIndex(row, genderHeaders);
		const foreIdx = findColIndex(row, forenameHeaders);
		const surIdx = findColIndex(row, surnameHeaders);

		// Advance into data rows following this header until a blank line or a new header
		i++;
		while (i < rows.length) {
			const r = rows[i];
			// skip empty rows; continue scanning same table
			if (!r || r.every((c) => c == null || String(c).trim() === '')) { i++; continue; }
			if (isLikelyHeader(r)) break;

			let name = getVal(r, nameIdx);
			if (!name && foreIdx !== -1 && surIdx !== -1) {
				const fore = getVal(r, foreIdx);
				const sur = getVal(r, surIdx);
				if (fore || sur) name = [fore, sur].filter(Boolean).join(' ').trim();
			}
			const club = getVal(r, clubIdx);
			let position = getVal(r, posIdx);
			let total = getVal(r, totalIdx);
			const gender = getVal(r, genderIdx);
			let ageGroup = getVal(r, ageIdx);
			if (!ageGroup) {
				ageGroup = gender ? gender : '';
			} else if (gender && !/women|men|girls?|boys?/i.test(ageGroup)) {
				ageGroup = `${gender} ${ageGroup}`.trim();
			}
			const parts = parseTitleForParts(tableTitle, sheetName, { name, club, position, total });
			// If aggregateAge not in title, fallback to derived from row
			if (!parts.aggregateAge) parts.aggregateAge = ageGroup || 'Unknown';
			// Fallback: sometimes the ageGroup cell contains "CODE Category - Age"
			let displayAge = parts.aggregateAge;
			if (!parts.categoryPart && typeof displayAge === 'string' && / - /.test(displayAge)) {
				const m2 = displayAge.match(/^(TRA|TPD|DMT|DMD)\s+(.+?)\s*-\s*(.+)$/i);
				if (m2) {
					parts.disciplineCode = (m2[1] || parts.disciplineCode || '').toUpperCase();
					parts.categoryPart = (m2[2] || '').trim();
					displayAge = (m2[3] || '').trim();
				}
			}
			if (!displayAge) displayAge = ageGroup || 'Unknown';

			if (name) {
				const excelRow = baseRow + i + 1; // excel rows are 1-based
				// Override position and total from fixed columns if available
				const lowerSheet = String(sheetName).toLowerCase();
				if (lowerSheet.includes('dmt')) {
					// Position: AZ, Total: AY
					const posCell = getWsCell(ws, 'AZ', excelRow);
					const totalCell = getWsCell(ws, 'AY', excelRow);
					if (posCell) position = posCell;
					if (totalCell) total = totalCell;
				} else if (lowerSheet.includes('tra')) {
					// Position: AO, Total: AN
					const posCell = getWsCell(ws, 'AO', excelRow);
					const totalCell = getWsCell(ws, 'AN', excelRow);
					if (posCell) position = posCell;
					if (totalCell) total = totalCell;
				}
				// Parse column A for code/category/age; simplify discipline
				const colA = getWsCell(ws, 'A', excelRow).trim();
				let disciplineCode = parts.disciplineCode || '';
				let categoryPart = parts.categoryPart || '';
				let finalAge = displayAge;
				const mA = colA.match(/^([A-Za-z]{3})\s*(.*?)\s*-\s*(.+)$/);
				if (mA) {
					disciplineCode = (mA[1] || disciplineCode || '').toUpperCase();
					categoryPart = (mA[2] || categoryPart || '').trim();
					finalAge = (mA[3] || finalAge || '').trim();
				}
				let simplifiedDiscipline;
				if (disciplineCode === 'TPD' || disciplineCode === 'TRA') simplifiedDiscipline = 'Trampoline';
				else if (disciplineCode === 'DMD' || disciplineCode === 'DMT') simplifiedDiscipline = 'DMT';
				else simplifiedDiscipline = lowerSheet.includes('dmt') ? 'DMT' : 'Trampoline';
				out.push({
					position,
					name,
					club,
					totalScore: formatScore(total),
					discipline: simplifiedDiscipline,
					ageGroup: finalAge || 'Unknown',
					disciplineCode,
					categoryPart,
					aggregateAge: parts.aggregateAge || (ageGroup || 'Unknown'),
					sourceSheet: sheetName,
					sourceRow: excelRow,
				});
			}
			i++;
		}
	}
	return out;
}

async function collectGreenRows(inputPath, data) {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.readFile(inputPath);
	// Build quick lookup keys
	const greenKeys = new Set();
	function isGreenish(argb) {
		if (!argb || typeof argb !== 'string') return false;
		// argb like 'FF00FF00'
		const hex = argb.replace(/^#/, '');
		if (hex.length !== 8) return false;
		const r = parseInt(hex.slice(2, 4), 16);
		const g = parseInt(hex.slice(4, 6), 16);
		const b = parseInt(hex.slice(6, 8), 16);
		return g >= 150 && g > r + 20 && g > b + 20;
	}
	wb.worksheets.forEach((ws) => {
		const sName = ws.name;
		if (!shouldIncludeSheet(sName)) return;
		ws.eachRow((row, rowNumber) => {
			let greenCount = 0;
			row.eachCell((cell) => {
				const fill = cell.fill;
				if (fill && fill.fgColor && isGreenish(fill.fgColor.argb || fill.fgColor.rgb)) {
					greenCount++;
				}
			});
			if (greenCount >= 1) {
				greenKeys.add(`${sName}|${rowNumber}`);
			}
		});
	});
	// Annotate data
	for (const rec of data) {
		const key = `${rec.sourceSheet}|${rec.sourceRow}`;
		rec.isGreen = greenKeys.has(key);
	}
	return data;
}


