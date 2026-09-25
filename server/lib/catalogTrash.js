const crypto = require('crypto');

async function purgeExpiredCatalog(queryable) {
  for (const kind of ['students','books']) {
    const [rows] = await queryable.query(`SELECT id FROM ${kind} WHERE deleted_at IS NOT NULL AND purged_at IS NULL AND purge_at<=CURRENT_TIMESTAMP LIMIT 500`);
    for (const { id } of rows) {
      if (kind === 'students') {
        const [[issues],[fines],[letters]] = await Promise.all([
          queryable.query('SELECT id FROM issues WHERE student_id=? LIMIT 1',[id]),
          queryable.query('SELECT id FROM fines WHERE student_id=? LIMIT 1',[id]),
          queryable.query('SELECT id FROM clearance_letters WHERE student_id=? LIMIT 1',[id]),
        ]);
        if (!issues.length && !fines.length && !letters.length) await queryable.query('DELETE FROM students WHERE id=?',[id]);
        else await queryable.query(`UPDATE students SET name='Deleted student',father_name='',registration_no=?,department='',contact_no='',email='',semester='',status='Inactive',remarks='',custom_data=NULL,purged_at=CURRENT_TIMESTAMP WHERE id=?`, [`DELETED-${id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,id]);
      } else {
        const [[issues],[fines]] = await Promise.all([
          queryable.query('SELECT id FROM issues WHERE book_id=? LIMIT 1',[id]),
          queryable.query('SELECT id FROM fines WHERE book_id=? LIMIT 1',[id]),
        ]);
        if (!issues.length && !fines.length) await queryable.query('DELETE FROM books WHERE id=?',[id]);
        else await queryable.query(`UPDATE books SET accession_no=?,title='Deleted book',author_name='',total_copies=0,catalog_identity=NULL,publisher='',publish_year='',pages=0,call_no='',binding='',source='',cost=0,isbn='',remarks='',custom_data=NULL,purged_at=CURRENT_TIMESTAMP WHERE id=?`, [`DELETED-${id}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,id]);
      }
    }
  }
}
function startCatalogTrashCleanup(queryable){
  const timer=setInterval(async()=>{try{await purgeExpiredCatalog(queryable);await queryable.query('DELETE FROM recovery_backups WHERE expires_at<=CURRENT_TIMESTAMP');}catch(error){console.error('Catalog trash cleanup failed:',error.code||error.message);}},6*60*60*1000);
  timer.unref();return timer;
}
module.exports={purgeExpiredCatalog,startCatalogTrashCleanup};
