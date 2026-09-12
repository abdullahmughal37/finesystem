const { Readable } = require('stream');
const csv = require('csv-parser');
class ValidationError extends Error {
  constructor(message, status = 400, code = 'invalid') { super(message); this.status = status; this.code = code; }
}
const clean = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
const identity = value => clean(value).toLowerCase();
const studentFields = ['name', 'father_name', 'registration_no', 'department', 'contact_no', 'email', 'semester', 'status', 'remarks'];
const bookFields = ['accession_no', 'author_name', 'title', 'publisher', 'publish_year', 'pages', 'call_no', 'binding', 'source', 'cost', 'isbn', 'remarks'];
const statuses = ['Active', 'Inactive', 'Graduated', 'Suspended'];
function textFields(input, fields, limits) {
  const out = {};
  for (const field of fields) {
    out[field] = clean(input[field]);
    if (out[field].length > (limits[field] || 255)) throw new ValidationError(`${field.replaceAll('_', ' ')} is too long.`);
  }
  return out;
}
function student(input) {
  const out = textFields(input, studentFields, { registration_no: 100, department: 150, contact_no: 100, semester: 50, status: 50, remarks: 5000 });
  if (!out.name || !out.registration_no) throw new ValidationError('Name and Registration No. are required.');
  out.registration_no = out.registration_no.toUpperCase(); out.email = out.email.toLowerCase();
  if (out.email && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(out.email)) throw new ValidationError('Enter a valid email address, or leave Email blank.');
  out.status = statuses.find(s => identity(s) === identity(out.status || 'Active'));
  if (!out.status) throw new ValidationError('Status must be Active, Inactive, Graduated, or Suspended.');
  return out;
}
function book(input) {
  const out = textFields(input, bookFields, { accession_no: 100, publish_year: 20, call_no: 100, binding: 100, source: 100, isbn: 100, remarks: 5000 });
  if (!out.accession_no || !out.title) throw new ValidationError('Accession No. and Title are required.');
  out.accession_no = out.accession_no.toUpperCase();
  for (const field of ['pages', 'cost']) {
    if (out[field] && !/^\d+(\.\d+)?$/.test(out[field])) throw new ValidationError(`${field} must be a non-negative number.`);
    out[field] = Number(out[field] || 0);
  }
  if (!Number.isInteger(out.pages) || out.pages > 2147483647) throw new ValidationError('Pages must be a non-negative whole number.');
  if (out.cost > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(clean(input.cost) || '0')) throw new ValidationError('Cost must have at most two decimal places and be below 100,000,000.');
  return out;
}
const headerKey = value => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const aliases = {
  name: 'name', fullname: 'name', studentname: 'name', fathername: 'father_name', fathersname: 'father_name',
  registrationno: 'registration_no', registrationnumber: 'registration_no', rollno: 'registration_no', rollnumber: 'registration_no',
  department: 'department', contactno: 'contact_no', contactnumber: 'contact_no', phone: 'contact_no', phonenumber: 'contact_no',
  email: 'email', emailaddress: 'email', semester: 'semester', status: 'status', remarks: 'remarks',
  accessionno: 'accession_no', accessionnumber: 'accession_no', author: 'author_name', authorname: 'author_name', title: 'title', booktitle: 'title',
  publisher: 'publisher', publishyear: 'publish_year', publicationyear: 'publish_year', year: 'publish_year', pages: 'pages',
  callno: 'call_no', callnumber: 'call_no', binding: 'binding', source: 'source', cost: 'cost', isbn: 'isbn',
};
const definitions = {
  students: { fields: studentFields, validate: student, key: 'registration_no', required: ['name', 'registration_no'] },
  books: { fields: bookFields, validate: book, key: 'accession_no', required: ['title', 'accession_no'] },
};
async function parseImport(buffer, kind, layout) {
  if (buffer.includes(0)) throw new ValidationError('Use a UTF-8 CSV file, not an Excel workbook. Save the workbook as CSV UTF-8 first.');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
  catch { throw new ValidationError('CSV must use UTF-8 encoding. Save it as CSV UTF-8.'); }
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    if (quoted && text[i + 1] === '"') { i++; continue; }
    quoted = !quoted;
  }
  if (quoted) throw new ValidationError('CSV has an unclosed quoted value. Check the file before importing.');
  const def = definitions[kind]; const parsed = []; let headers; let record = 0; let headerWidth = 0;
  const schema = layout ? require('./fieldSchema') : null;
  const mapping = layout ? schema.headerMap(layout.fields, kind) : aliases;
  const allowed = layout ? layout.fields.filter(f=>!f.archived).map(f=>f.key) : def.fields;
  try {
    const stream = Readable.from(text.replace(/^\uFEFF/, '')).pipe(csv({ headers: false, maxRowBytes: 128 * 1024 }));
    for await (const values of stream) {
      record++; const cells = Object.values(values);
      if (cells.every(v => !clean(v))) continue;
      if (!headers) {
        const mapped = cells.map(v => mapping[headerKey(v)] || null);
        if (!def.required.every(k => mapped.includes(k))) {
          if (record > 20) throw new ValidationError('Required CSV headers were not found in the first 20 rows.');
          continue;
        }
        if (layout) {
          const unknown = cells.filter((v,i)=>!mapped[i] && !['sr','srno','serialno','serialnumber','id'].includes(headerKey(v)));
          if (unknown.length) throw new ValidationError(`Unrecognized CSV columns: ${unknown.join(', ')}. Add these fields in Settings or use the current template.`);
          const missing = layout.fields.filter(f=>!f.archived && f.required && !mapped.includes(f.key));
          if (missing.length) throw new ValidationError(`CSV is missing required columns: ${missing.map(f=>f.label).join(', ')}. Download the current template.`);
          if (mapped.some(k=>k && !allowed.includes(k))) throw new ValidationError('CSV contains archived fields. Restore them in Settings before importing.');
        }
        headers = mapped.map(k => allowed.includes(k) ? k : null); headerWidth = cells.length;
        const used = headers.filter(Boolean);
        if (new Set(used).size !== used.length) throw new ValidationError('CSV contains duplicate column headings.');
        continue;
      }
      if (parsed.length >= 10000) throw new ValidationError('Import at most 10,000 records at a time.');
      const input = {}; headers.forEach((key, i) => { if (key) input[key] = cells[i] ?? ''; });
      if (headers.every((key, i) => !key || !clean(cells[i]))) continue;
      try {
        if (cells.length !== headerWidth) throw new ValidationError('Column count does not match the header. Check commas and quoted values.');
        parsed.push({ row: record, data: layout ? schema.validateRecord(kind,input,layout) : def.validate(input) });
      } catch (error) { parsed.push({ row: record, data: input, status: 'invalid', message: error.message }); }
    }
  } catch (error) { throw new ValidationError(error instanceof ValidationError ? error.message : 'Cannot parse CSV. Check the file encoding, quoting, and row size.'); }
  if (!headers) throw new ValidationError(`CSV requires ${def.required.join(' and ')} columns. Use the downloadable template.`);
  if (!parsed.length) throw new ValidationError('No data rows found. Add students or books below the column headings.');
  return parsed;
}
function classify(kind, existing, incoming) {
  if (!existing) return 'new';
  const keys = kind === 'students' ? ['name', 'registration_no', 'email'] : bookFields;
  return keys.every(key => kind === 'books' && ['pages', 'cost'].includes(key) ? Number(existing[key] || 0) === Number(incoming[key] || 0) : identity(existing[key]) === identity(incoming[key])) ? 'duplicate' : 'conflict';
}
function csvText(headers, rows) {
  const cell = value => {
    let text = String(value ?? ''); if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}
module.exports = { ValidationError, clean, identity, definitions, studentFields, bookFields, student, book, parseImport, classify, csvText, aliases, headerKey };
