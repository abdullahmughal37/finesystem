const { ValidationError } = require('./records');
const timezone = process.env.LIBRARY_TIMEZONE || 'Asia/Karachi';
function today(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function addDays(date, days) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function daysLate(due, date = today()) { return Math.max(0, Math.round((Date.parse(date) - Date.parse(String(due).slice(0, 10))) / 86400000)); }
function policyFromRows(rows) {
  const values = Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value]));
  const policy = { maxBooks: Number(values.maxBooks ?? 3), issueDays: Number(values.issueDays ?? 15), finePerDay: Number(values.finePerDay ?? 10) };
  if (!Number.isInteger(policy.maxBooks) || policy.maxBooks < 1 || policy.maxBooks > 100 || !Number.isInteger(policy.issueDays) || policy.issueDays < 1 || policy.issueDays > 365 || !Number.isFinite(policy.finePerDay) || policy.finePerDay < 0 || policy.finePerDay > 100000 || Math.abs(policy.finePerDay * 100 - Math.round(policy.finePerDay * 100)) > 1e-6) throw new ValidationError('Invalid library policy. Review Max Books, Issue Days, and Fine Per Day in Settings.');
  return policy;
}
async function getPolicy(connection) { const [rows] = await connection.query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('maxBooks','issueDays','finePerDay')"); return policyFromRows(rows); }
const fineAmount = (days, rate) => Math.round(days * rate * 100) / 100;
module.exports = { today, addDays, daysLate, getPolicy, fineAmount, policyFromRows };
