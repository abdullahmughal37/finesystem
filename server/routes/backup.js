const express = require("express");
const router = express.Router();
const db = require("../db");
const { authMiddleware } = require('../middleware/auth');
const bcrypt=require('bcryptjs');
const {transaction,sendError}=require('../lib/database');
const {ValidationError}=require('../lib/records');
const {saveSnapshot,clearOperationalData,decrypt,restoreSnapshot,snapshotSql}=require('../lib/recovery');

router.use(authMiddleware);

router.get("/sql", async (req, res) => {
  const tables = ["students", "books", "issues", "fines", "fine_deletions", "catalog_layouts", "settings", "clearance_templates", "clearance_sequences", "clearance_letters", "audit_logs"];
  try {
    let output = `-- Library data backup\n-- Generated ${new Date().toISOString()}\n-- Restore into an initialized Library Management System database.\n\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSTART TRANSACTION;\n`;
    for (const table of tables) {
      const [rows] = await db.promise().query(`SELECT * FROM ${table}`);
      for (const row of rows) {
        const columns = Object.keys(row);
        output += `INSERT INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(',')}) VALUES (${columns.map(column => db.escape(row[column])).join(',')});\n`;
      }
    }
    output += 'COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n';
    res.type('application/sql').attachment('library-data-backup.sql').send(output);
  } catch (error) {
    require('../lib/database').sendError(res, error);
  }
});

for(const kind of ['students','books']) router.get('/'+kind+'.csv',async(req,res)=>{
  try {
    const layout=await require('../lib/layouts').getLayout(kind);
    const [rows]=await db.promise().query('SELECT * FROM '+kind+' WHERE deleted_at IS NULL ORDER BY id');
    const fields=layout.fields.filter(f=>!f.archived);
    const {customValues}=require('../lib/fieldSchema');
    res.type('text/csv').attachment(kind+'.csv').send(require('../lib/records').csvText(fields.map(f=>f.label),rows.map(row=>{const values={...customValues(row),...row};return fields.map(f=>values[f.key]);})));
  }catch(e){require('../lib/database').sendError(res,e);}
});

async function verifiedAdmin(connection,id,password){
  if(typeof password!=='string'||!password)throw new ValidationError('Enter your current administrator password.');
  const [rows]=await connection.query('SELECT id,name,email,password_hash FROM admins WHERE id=? FOR UPDATE',[id]);
  if(!rows.length||!await bcrypt.compare(password,rows[0].password_hash))throw new ValidationError('Current password is incorrect.',403);
  return rows[0];
}
router.get('/recoveries',async(_req,res)=>{try{await db.promise().query('DELETE FROM recovery_backups WHERE expires_at<=CURRENT_TIMESTAMP');const [rows]=await db.promise().query('SELECT id,label,record_count AS recordCount,created_by_name AS createdByName,created_at AS createdAt,expires_at AS expiresAt,restored_at AS restoredAt FROM recovery_backups ORDER BY id DESC');res.json(rows);}catch(error){sendError(res,error);}});
router.get('/recoveries/:id/sql',async(req,res)=>{try{const [rows]=await db.promise().query('SELECT * FROM recovery_backups WHERE id=? AND expires_at>CURRENT_TIMESTAMP',[Number(req.params.id)]);if(!rows.length)throw new ValidationError('Recovery backup not found or expired.',404);res.type('application/sql').attachment(`library-recovery-${rows[0].id}.sql`).send(snapshotSql(decrypt(rows[0]),db.escape.bind(db)));}catch(error){sendError(res,error);}});
router.post('/reset',async(req,res)=>{try{
  if(req.body?.confirmation!=='RESET ALL DATA')throw new ValidationError('Type RESET ALL DATA exactly to continue.');
  const result=await transaction(async connection=>{const admin=await verifiedAdmin(connection,req.user.id,req.body?.currentPassword);const backup=await saveSnapshot(connection,admin,'Before system reset');await clearOperationalData(connection);return backup;});
  res.json({success:true,backupId:result.id,recordCount:result.recordCount,message:'Operational data reset. The encrypted recovery backup is available for 30 days.'});
}catch(error){sendError(res,error);}});
router.post('/recoveries/:id/restore',async(req,res)=>{try{
  if(req.body?.confirmation!=='RESTORE BACKUP')throw new ValidationError('Type RESTORE BACKUP exactly to continue.');
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1)throw new ValidationError('Invalid recovery backup ID.');
  const result=await transaction(async connection=>{const admin=await verifiedAdmin(connection,req.user.id,req.body?.currentPassword);const [rows]=await connection.query('SELECT * FROM recovery_backups WHERE id=? AND expires_at>CURRENT_TIMESTAMP FOR UPDATE',[id]);if(!rows.length)throw new ValidationError('Recovery backup not found or expired.',404);const safety=await saveSnapshot(connection,admin,'Before recovery restore');const snapshot=decrypt(rows[0]);await restoreSnapshot(connection,snapshot);await connection.query('UPDATE recovery_backups SET restored_at=CURRENT_TIMESTAMP WHERE id=?',[id]);return {safetyBackupId:safety.id,recordCount:snapshot.recordCount};});
  res.json({success:true,...result,message:'Backup restored. A safety backup of the previous state was also created.'});
}catch(error){sendError(res,error);}});
router.post('/delete-all',(_req,res)=>res.status(410).json({error:'Immediate deletion has been disabled. Use the protected Reset System Data workflow.'}));

module.exports = router;
