const { transaction } = require('./database');
const crypto = require('crypto');
const { ValidationError, definitions, classify, bookIdentity } = require('./records');
const { getLayout, checkRevision } = require('./layouts');
const { validateRecord, customValues } = require('./fieldSchema');
async function writeRecord(connection, kind, data, id) {
  const { key } = definitions[kind]; const fields = [...definitions[kind].fields,'custom_data'];
  if (kind === 'books') { data.catalog_identity=crypto.createHash('sha256').update(bookIdentity(data)).digest('hex'); fields.push('catalog_identity'); }
  const [existing] = await connection.query(`SELECT * FROM ${kind} WHERE ${key}=? FOR UPDATE`, [data[key]]);
  if (existing.length && existing[0].id !== id) {
    if(existing[0].deleted_at)throw new ValidationError(`This ${kind==='students'?'registration':'accession'} number is currently in Trash. Restore the existing record instead of creating another one.`,409,'in_trash');
    let status = classify(kind, existing[0], data);
    if (kind==='books' && status==='duplicate') {
      const before=customValues(existing[0]),after=customValues(data);
      if(Object.keys(after).some(key=>String(before[key]??'')!==String(after[key]??'')))status='conflict';
    }
    throw new ValidationError(status === 'duplicate' ? 'This record already exists. It has not been added again.' : `${key === 'registration_no' ? 'Registration' : 'Accession'} number already exists with different details. Review and edit the existing record.`, 409, status);
  }
  if (kind === 'books') {
    const identity = bookIdentity(data); let candidates;
    if (identity.startsWith('isbn:')) [candidates] = await connection.query('SELECT * FROM books WHERE isbn<>? AND id<>? FOR UPDATE',['',id || 0]);
    else [candidates] = await connection.query('SELECT * FROM books WHERE title=? AND id<>? FOR UPDATE',[data.title,id || 0]);
    const duplicate = candidates.find(row=>bookIdentity(row)===identity);
    if (duplicate) throw new ValidationError(duplicate.deleted_at?`A matching book is currently in Trash under accession ${duplicate.accession_no}. Restore it instead of adding another record.`:`A matching book already exists under accession ${duplicate.accession_no}. Increase its Total Copies instead of adding a duplicate record.`,409,duplicate.deleted_at?'in_trash':'duplicate');
    if (id) {
      const [active] = await connection.query('SELECT COUNT(*) total FROM issues WHERE book_id=? AND returned=0',[id]);
      if (Number(active[0].total)>data.total_copies) throw new ValidationError(`Total Copies cannot be lower than the ${active[0].total} copies currently issued. Return books first.`,409,'copies_in_use');
    }
  }
  if (id) {
    const [rows] = await connection.query(`SELECT id FROM ${kind} WHERE id=? AND deleted_at IS NULL FOR UPDATE`, [id]);
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
    if (id) { const [rows] = await connection.query(`SELECT * FROM ${kind} WHERE id=? AND deleted_at IS NULL FOR UPDATE`,[id]); existing=rows[0]; if(!existing) throw new ValidationError('Record not found.',404); }
    const data = validateRecord(kind,input,layout,existing);
    return writeRecord(connection,kind,data,id);
  });
}
async function importRecords(kind, parsed, preview, revision) {
  return transaction(async connection => {
    const layout = await getLayout(kind,connection,true); checkRevision(layout,revision);
    const { key } = definitions[kind]; const fields=[...definitions[kind].fields,'custom_data'];
    if (kind === 'books') fields.push('catalog_identity');
    const [existing] = await connection.query(`SELECT * FROM ${kind} WHERE deleted_at IS NULL FOR UPDATE`);
    const known = new Map(existing.map(row => [String(row[key]).trim().toUpperCase(), row]));
    const knownBooks = kind === 'books' ? new Map(existing.map(row=>[bookIdentity(row),row])) : null;
    const results = []; const counts = { total: parsed.length, added: 0, ready: 0, duplicate: 0, conflict: 0, invalid: 0 };
    for (const row of parsed) {
      const existingRecord = known.get(row.data[key]);
      let status = row.status || classify(kind, existingRecord, row.data); let message = row.message;
      const matchingBook = kind === 'books' && status === 'new' ? knownBooks.get(bookIdentity(row.data)) : null;
      if (matchingBook) { status='duplicate'; message=`Matching book already exists under accession ${matchingBook.accession_no}. Increase its Total Copies instead.`; }
      if (kind === 'books' && status === 'duplicate' && existingRecord) {
        const before=customValues(existingRecord), after=customValues(row.data);
        if (layout.fields.some(f=>!f.core && !f.archived && String(before[f.key] ?? '') !== String(after[f.key] ?? ''))) status='conflict';
      }
      if (status === 'new') {
        known.set(row.data[key], row.data);
        if (knownBooks) { const identity=bookIdentity(row.data); knownBooks.set(identity,row.data); row.data.catalog_identity=crypto.createHash('sha256').update(identity).digest('hex'); }
        if (!preview) await connection.query(`INSERT INTO ${kind} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`, fields.map(f => row.data[f]));
        status = preview ? 'ready' : 'added'; message = preview ? 'Ready to import.' : 'Added successfully.';
      } else if (status === 'duplicate' && !message) message = 'Matching identity already exists in the database or this file. Skipped; existing details preserved.';
      else if (status === 'conflict') message = 'Identifier already exists with different details. Review the existing record; nothing overwritten.';
      counts[status]++;
      results.push({ row: row.row, identifier: row.data[key] || '', name: row.data.name || row.data.title || '', status, message });
    }
    return { success: true, preview, counts, rows: results, layoutRevision:layout.revision };
  });
}
function validIds(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000) throw new ValidationError('Select between 1 and 1,000 records.');
  const values=[...new Set(ids.map(Number))];
  if(values.some(id=>!Number.isSafeInteger(id)||id<1))throw new ValidationError('One or more record IDs are invalid.');
  return values;
}
async function moveToTrash(kind, ids, user, reason) {
  ids=validIds(ids); reason=String(reason||'').trim().replace(/\s+/g,' ');
  if(reason.length<3||reason.length>500)throw new ValidationError('Enter a deletion reason of 3–500 characters.');
  return transaction(async connection=>{
    const marks=ids.map(()=>'?').join(',');
    const [rows]=await connection.query(`SELECT id FROM ${kind} WHERE id IN (${marks}) AND deleted_at IS NULL FOR UPDATE`,ids);
    if(rows.length!==ids.length)throw new ValidationError('Some selected records no longer exist or are already in Trash.',409);
    const field=kind==='students'?'student_id':'book_id';
    const [active]=await connection.query(`SELECT DISTINCT ${field} id FROM issues WHERE ${field} IN (${marks}) AND returned=0 FOR UPDATE`,ids);
    if(active.length)throw new ValidationError(`${active.length} selected record(s) have active loans. Return those books before moving them to Trash.`,409,'active_loans');
    await connection.query(`UPDATE ${kind} SET deleted_at=CURRENT_TIMESTAMP,deleted_by=?,deletion_reason=?,purge_at=DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 30 DAY),purged_at=NULL WHERE id IN (${marks})`,[user.id,reason,...ids]);
    return rows.length;
  });
}
async function restoreFromTrash(kind, ids) {
  ids=validIds(ids);
  return transaction(async connection=>{
    const marks=ids.map(()=>'?').join(',');
    const [rows]=await connection.query(`SELECT id FROM ${kind} WHERE id IN (${marks}) AND deleted_at IS NOT NULL AND purged_at IS NULL AND purge_at>CURRENT_TIMESTAMP FOR UPDATE`,ids);
    if(rows.length!==ids.length)throw new ValidationError('Some selected records have expired, were purged, or are no longer in Trash.',409);
    await connection.query(`UPDATE ${kind} SET deleted_at=NULL,deleted_by=NULL,deletion_reason='',purge_at=NULL WHERE id IN (${marks})`,ids);
    return rows.length;
  });
}
async function remove(kind,id,user,reason) { return moveToTrash(kind,[id],user,reason); }
function pageOptions(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1); const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit, search: String(query.search || '').trim().slice(0, 255) };
}
module.exports = { save, importRecords, remove, moveToTrash, restoreFromTrash, pageOptions };
