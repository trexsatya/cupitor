// public/music-practice.js
// Pure helpers for the weekly practice log. The UI (music.html) owns the DOM and persistence; this
// module owns the data shape and the week math so both can be unit-tested. No DOM, no storage.
//
// Data model:
//   entry  { id, week, pieceId, pieceTitle, goal, status, notes, custom:[{name,value,status}], updatedAt }
//   custom fields are user-defined; their NAMES come from a global registry (a growable string list)
//   so a name typed once is offered in the combobox forever after.

export const PRACTICE_STATUSES = [
  { value: 'planned', label: 'Planned', color: '#6b7280' },
  { value: 'in-progress', label: 'In progress', color: '#1565c0' },
  { value: 'done', label: 'Done', color: '#2e7d32' },
];

export function statusMeta(value) {
  return PRACTICE_STATUSES.find((s) => s.value === value) || PRACTICE_STATUSES[0];
}
function validStatus(v) { return PRACTICE_STATUSES.some((s) => s.value === v) ? v : 'planned'; }

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// The Monday of the week containing `date`, as 'YYYY-MM-DD' (local time). Sunday belongs to the week
// that began the preceding Monday. Pure: the caller passes the Date (new Date() or a fixed test date).
export function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (d.getDay() + 6) % 7;   // Mon=0 … Sun=6
  d.setDate(d.getDate() - daysSinceMonday);
  return ymd(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function weekLabel(weekStartStr) {
  const [y, m, d] = String(weekStartStr || '').split('-').map(Number);
  return (y && m && d) ? `Week of ${MONTHS[m - 1]} ${d}, ${y}` : '';
}

// Normalise a custom field to { name, value, status }.
export function makeField(raw = {}) {
  return { name: String(raw.name || '').trim(), value: String(raw.value == null ? '' : raw.value), status: validStatus(raw.status) };
}

// A log entry with every field defaulted. Nameless custom fields are dropped.
export function makeEntry(raw = {}) {
  return {
    id: raw.id || '',
    week: raw.week || '',
    pieceId: raw.pieceId || null,
    pieceTitle: raw.pieceTitle || '',
    goal: raw.goal || '',
    status: validStatus(raw.status),
    notes: raw.notes || '',
    custom: Array.isArray(raw.custom) ? raw.custom.map(makeField).filter((f) => f.name) : [],
    updatedAt: raw.updatedAt || '',
  };
}

// Insert or replace by id; returns a new array (inputs untouched).
export function upsertEntry(entries, entry) {
  const list = (entries || []).slice();
  const i = list.findIndex((e) => e.id === entry.id);
  if (i >= 0) list[i] = entry; else list.push(entry);
  return list;
}

export function removeEntry(entries, id) {
  return (entries || []).filter((e) => e.id !== id);
}

// Newest week first, then most-recently-updated first.
export function sortEntries(entries) {
  return (entries || []).slice().sort((a, b) =>
    String(b.week || '').localeCompare(String(a.week || '')) ||
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

// Add a field name to the global registry unless a case-insensitive match already exists.
// Returns { fields, added, name } with the trimmed name.
export function mergeFieldName(fields, name) {
  const clean = String(name || '').trim();
  const list = (fields || []).slice();
  if (!clean) return { fields: list, added: false, name: '' };
  const exists = list.some((f) => f.toLowerCase() === clean.toLowerCase());
  if (!exists) list.push(clean);
  return { fields: list, added: !exists, name: clean };
}
