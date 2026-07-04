/**
 * Maps rows from **Kuldeep Ops Work Sheet.xlsx** and **Master Data - movEAZY.xlsx**
 * into `createCrmLeadData`-compatible payloads plus `extraFields` for lossless imports.
 */

/** @param {unknown} h */
export function normalizeSheetHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {unknown} raw
 * @returns {{ min: number | null, max: number | null }}
 */
export function parseIndianBudgetK(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "");
  if (!s) return { min: null, max: null };
  const mult = (n) => (Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null);
  const m = s.match(/^([\d.]+)\s*-\s*([\d.]+)\s*k?$/);
  if (m) {
    const a = mult(parseFloat(m[1]));
    const b = mult(parseFloat(m[2]));
    if (a == null && b == null) return { min: null, max: null };
    if (a != null && b != null) return { min: Math.min(a, b), max: Math.max(a, b) };
    return { min: a ?? b, max: b ?? a };
  }
  const m2 = s.match(/^([\d.]+)\s*k?$/);
  if (m2) {
    const v = mult(parseFloat(m2[1]));
    return { min: v, max: v };
  }
  return { min: null, max: null };
}

/** @param {unknown} n */
export function excelSerialToIsoDate(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 1) return null;
  const utc = Math.round((x - 25569) * 86400 * 1000);
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** @param {unknown} v */
function cellToString(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/**
 * @param {unknown} raw
 */
export function mapSheetStatusToCrmStatus(raw) {
  const t = cellToString(raw).toLowerCase();
  if (!t) return "new";
  if (t.includes("valid") && !t.includes("in")) return "contacted";
  if (t.includes("duplicate")) return "on_hold";
  if (t.includes("rnr") || t.includes("dead")) return "lost";
  if (t.includes("active")) return "new";
  if (t.includes("won")) return "won";
  if (t.includes("lost")) return "lost";
  if (t.includes("follow")) return "follow_up";
  return "new";
}

/**
 * Normalized header keys folded into first-class CRM fields or into synthesized `requirements`
 * (not duplicated in `extraFields`).
 */
const ABSORBED_INTO_LEAD = new Set([
  "name",
  "",
  " ",
  "contact number",
  "email",
  "location",
  "office location",
  "budget",
  "flate type",
  "flat type",
  "move in date",
  "assigned interns",
  "status",
  "owner",
  "unique id",
  "time stamp",
  "ops poc",
  "ops leader",
  "dead lead",
  "sheets copy",
  "area",
  "company placed",
  "college name",
  "question 1",
  "question 2",
  "question 3",
  "rent/room",
  "1st calling date",
  "properties send",
  "properties send 2",
  "properties send 3",
  "properties send 4",
  "follow up 1",
  "follow up 2",
  "follow up 3",
  "follow up 4",
  "visit schedule date",
  "visit schedule date 2",
  "visit schedule date 3",
  "visit schedule date 4",
  "post visit followup",
  "post visit followup 2",
  "post visit followup 3",
  "post visit followup 4",
  "visit schedule",
]);

/**
 * Absorbed columns we already fold into first-class CRM fields — do not duplicate
 * into the long `requirements` text (ops / follow-up columns still go there).
 */
const ABSORBED_SKIP_IN_REQUIREMENTS = new Set([
  "name",
  "",
  " ",
  "contact number",
  "email",
  "location",
  "office location",
  "budget",
  "flate type",
  "flat type",
  "move in date",
  "assigned interns",
  "status",
  "owner",
  "unique id",
  "time stamp",
  "ops poc",
  "ops leader",
  "dead lead",
  "sheets copy",
  "area",
  "company placed",
  "college name",
  "question 1",
  "question 2",
  "question 3",
  "rent/room",
]);

/**
 * @param {string[]} headers
 * @param {unknown[]} values
 * @param {{ sheetName?: string, sourceFile?: string }} [options]
 */
export function mapHeadersRowToCrmLead(headers, values, options = {}) {
  const sheetName = options.sheetName ? String(options.sheetName).slice(0, 120) : "";
  const sourceFile = options.sourceFile ? String(options.sourceFile).slice(0, 200) : "";
  const len = Math.min(headers.length, values.length);

  /** @type {{ raw: string, norm: string, i: number, val: string }[]} */
  const pairs = [];
  for (let i = 0; i < len; i++) {
    pairs.push({
      raw: String(headers[i] ?? "").trim(),
      norm: normalizeSheetHeader(headers[i]),
      i,
      val: cellToString(values[i]),
    });
  }

  const pickFirst = (norm) => pairs.find((p) => p.norm === norm)?.val ?? "";

  let customerName = pickFirst("name") || pickFirst("") || pickFirst(" ");
  if (!customerName && pairs[0]) {
    const h0 = pairs[0].norm;
    if (h0 === "" || h0 === " ") customerName = pairs[0].val;
  }

  const customerPhone = pickFirst("contact number");
  const customerEmail = pickFirst("email");
  const preferredAreas = pickFirst("location");
  const budgetRaw = pickFirst("budget");
  const { min: budgetMin, max: budgetMax } = parseIndianBudgetK(budgetRaw);

  const moveRaw = pickFirst("move in date");
  let moveTimeline = moveRaw;
  const moveNum = Number(moveRaw);
  if (Number.isFinite(moveNum) && moveNum > 20000) {
    const iso = excelSerialToIsoDate(moveNum);
    if (iso) moveTimeline = iso;
  }

  const assignedInterns = pickFirst("assigned interns");
  const sheetStatusRaw = pickFirst("status");
  const uniqueId = pickFirst("unique id");

  const reqLines = [];
  for (const p of pairs) {
    if (!p.val || !ABSORBED_INTO_LEAD.has(p.norm)) continue;
    if (ABSORBED_SKIP_IN_REQUIREMENTS.has(p.norm)) continue;
    const label = p.raw ? `${p.raw} [col ${p.i}]` : `[col ${p.i}]`;
    reqLines.push(`${label}: ${p.val}`);
  }

  /** @type {Record<string, string>} */
  const extraFields = {};
  for (const p of pairs) {
    if (!p.val) continue;
    if (ABSORBED_INTO_LEAD.has(p.norm)) continue;
    const storageKey = p.raw ? `${p.raw} [${p.i}]` : `__col_${p.i}`;
    extraFields[storageKey.slice(0, 200)] = p.val.slice(0, 4000);
  }

  if (sheetName) extraFields.__importSheet = sheetName;
  if (sourceFile) extraFields.__importFile = sourceFile;

  const status = mapSheetStatusToCrmStatus(sheetStatusRaw);

  return {
    customerName,
    customerEmail: customerEmail || (uniqueId && /@/.test(uniqueId) ? uniqueId : ""),
    customerPhone,
    assigneeEmail: "",
    assigneeName: assignedInterns || pickFirst("ops poc") || "",
    status,
    visitStatus: "not_visited",
    requirements: reqLines.join("\n").slice(0, 8000),
    budgetMin: budgetMin ?? undefined,
    budgetMax: budgetMax ?? undefined,
    preferredAreas: preferredAreas.slice(0, 2000),
    moveTimeline: moveTimeline.slice(0, 200),
    sourceChannel: [sheetName, sourceFile].filter(Boolean).join(" · ").slice(0, 120) || "sheet-import",
    externalRef: (uniqueId || customerPhone).slice(0, 200),
    customerCompany: (pickFirst("company placed") || pickFirst("college name")).slice(0, 200),
    extraFields,
    importSheetName: sheetName || undefined,
    importSourceFile: sourceFile || undefined,
  };
}

/**
 * @param {unknown[][]} rows
 * @param {{ sheetName?: string, sourceFile?: string, maxRows?: number }} [options]
 */
export function mapSheetMatrixToCrmLeads(rows, options = {}) {
  if (!rows?.length) return [];
  const headers = rows[0].map((h) => String(h ?? ""));
  const cap = options.maxRows ?? 500;
  /** @type {Record<string, unknown>[]} */
  const out = [];
  for (let r = 1; r < rows.length && out.length < cap; r++) {
    const values = rows[r] || [];
    if (!values.some((c) => cellToString(c))) continue;
    out.push(mapHeadersRowToCrmLead(headers, values, options));
  }
  return out;
}

/**
 * Split pasted grid text into rows (Excel copy is often TSV).
 * @param {string} text
 * @returns {string[][]}
 */
export function parsePastedGrid(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (!lines.length) return [];
  const tab0 = (lines[0].match(/\t/g) || []).length;
  const comma0 = (lines[0].match(/,/g) || []).length;
  const delim = tab0 >= comma0 ? "\t" : ",";
  return lines.map((line) => {
    if (delim === "\t") return line.split("\t").map((c) => c.trim());
    return line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
  });
}
