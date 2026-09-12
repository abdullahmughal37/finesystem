const { transaction } = require('./database');
const { ValidationError, definitions, classify } = require('./records');
const { getLayout, checkRevision } = require('./layouts');
const { validateRecord, customValues } = require('./fieldSchema');
async function writeRecord(connection, kind, data, id) {
  const { key } = definitions[kind]; const fields = [...definitions[kind].fields,'custom_data'];
  const [existing] = await connection.query(`SELECT * FROM ${kind} WHERE ${key}=? FOR UPDATE`, [data[key]]);
  if (existing.length && existing[0].id !== id) {
    let status = classify(kind, existing[0], data);
    if (kind==='books' && status==='duplicate') {
      const before=customValues(existing[0]),after=customValues(data);
      if(Object.keys(after).some(key=>String(before[key]??'')!==String(after[key]??'')))status='conflict';
    }
    throw new ValidationError(status === 'duplicate' ? 'This record already exists. It has not been added again.' : `${key === 'registration_no' ? 'Registration' : 'Accession'} number already exists with different details. Review and edit the existing record.`, 409, status);
  }
  if (id) {
    const [rows] = await connection.query(`SELECT id FROM ${kind} WHERE id=? FOR UPDATE`, [id]);
    if (!rows.length) throw new ValidationError('Record not found.', 404);
    await connection.query(`UPDATE ${kind} SET ${fields.map(f => `${f}=?`).join(',')} WHERE id=?`, [...fields.map(f => data[f]), id]); return id;
  }
  const [result] = await connection.query(`INSERT INTO ${kind} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, fields.map(f => data[f]));
  return result.insertId;
}
async function save(kind, input, id) {
  if (id !== undefined && (!Number.isSafeInteger(id) || id < 1)) throw new ValidationError('Invalid record ID.');
  return transaction(async connection => {
    const layout = await getLayout(kind,connection,true); checkRevision(layout,input.layoutRevision);
    let existing;
    if (id) { const [rows] = await connection.query(`SELECT * FROM ${kind} WHERE id=? FOR UPDATE`,[id]); existing=rows[0]; if(!existing) throw new ValidationError('Record not found.',404); }
    const data = validateRecord(kind,input,layout,existing);
    return writeRecord(connection,kind,data,id);
  });
}
async function importRecords(kind, parsed, preview, revision) {
  return transaction(async connection => {
    const layout = await getLayout(kind,connection,true); checkRevision(layout,revision);
    const { key } = definitions[kind]; const fields=[...definitions[kind].fields,'custom_data'];
    const [existing] = await connection.query(`SELECT * FROM ${kind} FOR UPDATE`);
    const known = new Map(existing.map(row => [String(row[key]).trim().toUpperCase(), row]));
    const results = []; const counts = { total: parsed.length, added: 0, ready: 0, duplicate: 0, conflict: 0, invalid: 0 };
    for (const row of parsed) {
      let status = row.status || classify(kind, known.get(row.data[key]), row.data); let message = row.message;
      if (kind === 'books' && status === 'duplicate') {
        const before=customValues(known.get(row.data[key])), after=customValues(row.data);
        if (layout.fields.some(f=>!f.core && !f.archived && String(before[f.key] ?? '') !== String(after[f.key] ?? ''))) status='conflict';
      }
      if (status === 'new') {
        known.set(row.data[key], row.data);
        if (!preview) await connection.query(`INSERT INTO ${kind} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, fields.map(f => row.data[f]));
        status = preview ? 'ready' : 'added'; message = preview ? 'Ready to import.' : 'Added successfully.';
      } else if (status === 'duplicate') message = 'Matching identity already exists in the database or this file. Skipped; existing details preserved.';
      else if (status === 'conflict') message = 'Identifier already exists with different details. Review the existing record; nothing overwritten.';
      counts[status]++;
      results.push({ row: row.row, identifier: row.data[key] || '', name: row.data.name || row.data.title || '', status, message });
    }
    return { success: true, preview, counts, rows: results, layoutRevision:layout.revision };
  });
}
async function remove(kind, id) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ValidationError('Invalid record ID.');
  return transaction(async connection => {
    const [rows] = await connection.query(`SELECT id FROM ${kind} WHERE id=? FOR UPDATE`, [id]);
    if (!rows.length) throw new ValidationError('Record not found.', 404);
    const field = kind === 'students' ? 'student_id' : 'book_id';
    const checks = [connection.query(`SELECT id FROM issues WHERE ${field}=? LIMIT 1`, [id]), connection.query(`SELECT id FROM fines WHERE ${field}=? LIMIT 1`, [id])];
    if (kind === 'students') checks.push(connection.query('SELECT id FROM clearance_letters WHERE student_id=? LIMIT 1', [id]));
    const histories = await Promise.all(checks);
    if (histories.some(([history]) => history.length)) throw new ValidationError('This record has loan, fine, or clearance history and cannot be deleted.', 409, 'has_history');
    await connection.query(`DELETE FROM ${kind} WHERE id=?`, [id]);
  });
}
function pageOptions(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1); const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit, search: String(query.search || '').trim().slice(0, 255) };
}
module.exports = { save, importRecords, remove, pageOptions };
