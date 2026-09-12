const db = require('../db');
const { ValidationError } = require('./records');
const { transaction } = require('./database');
const { normalizeLayout, customValues, validateValue } = require('./fieldSchema');
function checkKind(kind) { if (!['students','books'].includes(kind)) throw new ValidationError('Unknown catalog.',404); }
async function getLayout(kind, connection, lock = false) {
  checkKind(kind);
  const [rows] = await (connection || db.promise()).query(`SELECT * FROM catalog_layouts WHERE kind=?${lock ? ' FOR UPDATE' : ''}`,[kind]);
  if (!rows.length) throw new ValidationError('Layout is not initialized.',503);
  return {kind,revision:rows[0].revision,fields:JSON.parse(rows[0].fields)};
}
function checkRevision(layout, revision) {
  if (revision !== undefined && Number(revision) !== layout.revision) throw new ValidationError('The field layout changed. Reload the layout or reopen the form and preview the CSV again.',409,'layout_changed');
}
async function updateLayout(kind, input) {
  checkKind(kind);
  return transaction(async connection => {
    const current = await getLayout(kind,connection,true);
    if (!Number.isSafeInteger(input.revision)) throw new ValidationError('The layout revision is required.');
    checkRevision(current,input.revision);
    const fields = normalizeLayout(kind,input.fields,current.fields);
    const changed = fields.filter(f=>!f.core && !f.archived && current.fields.some(old=>old.key===f.key && (old.archived || old.type!==f.type || JSON.stringify(old.options)!==JSON.stringify(f.options))));
    if (changed.length) {
      const [rows] = await connection.query(`SELECT custom_data FROM ${kind}`);
      for (const row of rows) for (const field of changed) {
        try { validateValue(field,customValues(row)[field.key],false); }
        catch { throw new ValidationError(`Saved values do not fit the new type or options for “${field.label}”. Update those records first, or create a new field.`); }
      }
    }
    await connection.query('UPDATE catalog_layouts SET fields=?,revision=revision+1 WHERE kind=?',[JSON.stringify(fields),kind]);
    return {kind,revision:current.revision+1,fields};
  });
}
module.exports = {getLayout,updateLayout,checkRevision};
