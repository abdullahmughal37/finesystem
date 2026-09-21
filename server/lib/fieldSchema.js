const { ValidationError, clean, definitions, aliases, headerKey } = require('./records');
const labels = { name:'Name', father_name:'Father Name', registration_no:'Registration No.', department:'Department', contact_no:'Contact No.', email:'Email', semester:'Semester', status:'Status', remarks:'Remarks', accession_no:'Accession No.', title:'Title', total_copies:'Total Copies', author_name:'Author Name', publisher:'Publisher', publish_year:'Publish Year', pages:'Pages', call_no:'Call No.', binding:'Binding', source:'Source', cost:'Cost', isbn:'ISBN' };
const types = ['text','textarea','email','tel','number','date','select'];
function defaults(kind) {
  const keys = kind === 'students' ? ['name','father_name','registration_no','department','contact_no','semester','status','remarks','email'] : ['accession_no','title','total_copies','author_name','publisher','publish_year','pages','call_no','binding','source','cost','isbn','remarks'];
  return keys.map(key => ({key, label:labels[key], core:true, type:key === 'status' ? 'select' : key === 'remarks' ? 'textarea' : key === 'email' ? 'email' : key === 'contact_no' ? 'tel' : ['pages','cost','total_copies'].includes(key) ? 'number' : 'text', required:definitions[kind].required.includes(key), showInForm:true, showInTable:kind === 'students' || ['accession_no','title','total_copies','author_name','publisher','isbn','call_no'].includes(key), width:key === 'remarks' ? 'full' : 'half', archived:false, options:key === 'status' ? ['Active','Inactive','Graduated','Suspended'] : [], aliases:[] }));
}
function headerMap(fields, kind) {
  const map = Object.create(null);
  for (const [alias,key] of Object.entries(aliases)) if (definitions[kind].fields.includes(key)) map[alias] = key;
  for (const f of fields) for (const label of [f.key, f.label, ...(f.aliases || [])]) {
    const key = headerKey(label);
    if (!key || ['sr','srno','serialno','id','customdata','layoutrevision'].includes(key)) throw new ValidationError('Choose a descriptive field label other than reserved headings such as Sr # or ID.');
    if (map[key] && map[key] !== f.key) throw new ValidationError(`The label “${label}” is already used by another field or CSV heading.`);
    map[key] = f.key;
  }
  return map;
}
function normalizeLayout(kind, input, previous) {
  if (!Array.isArray(input) || input.length > 50) throw new ValidationError('A layout can contain at most 50 fields.');
  const base = defaults(kind); const known = new Map(previous.map(f => [f.key,f])); const seen = new Set();
  const fields = input.map(raw => {
    if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string' || seen.has(raw.key)) throw new ValidationError('Each field needs a unique internal ID.');
    seen.add(raw.key); const core = base.find(f => f.key === raw.key); const old = known.get(raw.key);
    if (!core && !/^custom_[a-z0-9]{8,40}$/.test(raw.key)) throw new ValidationError('Invalid custom field ID.');
    const label = clean(raw.label);
    if (!label || label.length > 80) throw new ValidationError('Field labels must contain 1–80 characters.');
    const type = core ? core.type : raw.type;
    if (!types.includes(type)) throw new ValidationError('Choose a supported field type.');
    const required = core?.required || raw.required === true;
    const archived = !core && raw.archived === true;
    const showInForm = core?.required || raw.showInForm === true;
    if (required && !archived && !showInForm) throw new ValidationError(`Required field “${label}” must appear in forms.`);
    const options = core ? core.options : type === 'select' && Array.isArray(raw.options) ? raw.options.map(clean).filter(Boolean) : [];
    if (type === 'select' && (!options.length || options.length > 50 || options.some(o => o.length > 80) || new Set(options.map(o=>o.toLowerCase())).size !== options.length)) throw new ValidationError(`“${label}” needs 1–50 distinct dropdown options (up to 80 characters each).`);
    return {key:raw.key,label,core:!!core,type,required,archived,showInForm,showInTable:raw.showInTable === true,width:raw.width === 'full' ? 'full' : 'half',options,aliases:[...new Set([...(old?.aliases || []), ...(old && old.label !== label ? [old.label] : [])])]};
  });
  if (base.some(f=>!seen.has(f.key))) throw new ValidationError('Keep all built-in fields in the layout.');
  if (!fields.some(f=>!f.archived && f.showInTable)) throw new ValidationError('Show at least one field in the table.');
  headerMap(fields,kind); return fields;
}
function customValues(row) {
  if (!row?.custom_data) return {};
  try { const data = typeof row.custom_data === 'string' ? JSON.parse(row.custom_data) : row.custom_data; return data && typeof data === 'object' && !Array.isArray(data) ? data : {}; } catch { return {}; }
}
function validateValue(field, value, required = field.required) {
  const v = clean(value);
  if (!v) { if (required) throw new ValidationError(`${field.label} is required.`); return ''; }
  if (v.length > (field.type === 'textarea' ? 5000 : 255)) throw new ValidationError(`${field.label} is too long.`);
  if (field.type === 'email' && !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v)) throw new ValidationError(`${field.label} must be a valid email address.`);
  if (field.type === 'number' && (!/^-?\d+(\.\d+)?$/.test(v) || !Number.isFinite(Number(v)) || Math.abs(Number(v)) > Number.MAX_SAFE_INTEGER)) throw new ValidationError(`${field.label} must be a valid number.`);
  if (field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v)) throw new ValidationError(`${field.label} must be a valid date (YYYY-MM-DD).`);
  if (field.type === 'select' && !field.options.includes(v)) throw new ValidationError(`${field.label} must match one of its dropdown options.`);
  return field.type === 'number' ? Number(v) : field.type === 'email' ? v.toLowerCase() : v;
}
function validateRecord(kind, input, layout, existing) {
  const merged = {...existing,...input}; const data = definitions[kind].validate(merged); const custom = {...customValues(existing)};
  for (const f of layout.fields.filter(f=>!f.archived)) {
    if (f.core) { if (f.required && !clean(data[f.key])) throw new ValidationError(`${f.label} is required.`); }
    else if (f.showInForm || Object.hasOwn(input,f.key)) custom[f.key] = validateValue(f, Object.hasOwn(input,f.key) ? input[f.key] : custom[f.key]);
  }
  data.custom_data = JSON.stringify(custom); return data;
}
module.exports = {defaults, normalizeLayout, headerMap, customValues, validateValue, validateRecord};
