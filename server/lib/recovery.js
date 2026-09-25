const crypto=require('crypto');
const zlib=require('zlib');
const config=require('../config');

const TABLES=['students','books','issues','fines','fine_deletions','clearance_letters','clearance_sequences'];
const DELETE_ORDER=['clearance_letters','clearance_sequences','fine_deletions','fines','issues','books','students'];
function key(){return crypto.createHash('sha256').update(String(process.env.RECOVERY_ENCRYPTION_KEY||config.jwt.secret)).digest();}
function encrypt(payload){
  const plain=zlib.gzipSync(Buffer.from(JSON.stringify(payload)));const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);return {encrypted,iv,tag:cipher.getAuthTag(),hash:crypto.createHash('sha256').update(plain).digest('hex')};
}
function decrypt(row){
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),row.payload_iv);decipher.setAuthTag(row.payload_tag);
  const plain=Buffer.concat([decipher.update(row.encrypted_payload),decipher.final()]);
  if(crypto.createHash('sha256').update(plain).digest('hex')!==row.payload_sha256)throw new Error('Recovery backup integrity check failed.');
  return JSON.parse(zlib.gunzipSync(plain).toString('utf8'),(_key,value)=>value&&value.type==='Buffer'&&Array.isArray(value.data)?Buffer.from(value.data):value);
}
async function readSnapshot(connection){
  const tables={};let recordCount=0;
  for(const table of TABLES){const [rows]=await connection.query(`SELECT * FROM ${table}`);tables[table]=rows;recordCount+=rows.length;}
  return {version:1,createdAt:new Date().toISOString(),tables,recordCount};
}
async function saveSnapshot(connection,admin,label){
  const snapshot=await readSnapshot(connection);const sealed=encrypt(snapshot);
  const [result]=await connection.query(`INSERT INTO recovery_backups(label,encrypted_payload,payload_iv,payload_tag,payload_sha256,record_count,created_by,created_by_name,created_by_email,expires_at) VALUES (?,?,?,?,?,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 30 DAY))`,[label,sealed.encrypted,sealed.iv,sealed.tag,sealed.hash,snapshot.recordCount,admin.id,admin.name,admin.email]);
  return {id:result.insertId,recordCount:snapshot.recordCount};
}
async function clearOperationalData(connection){for(const table of DELETE_ORDER)await connection.query(`DELETE FROM ${table}`);}
function databaseValue(value){if(Buffer.isBuffer(value)||value===null||value===undefined||typeof value!=='object')return value;return JSON.stringify(value);}
async function restoreSnapshot(connection,snapshot){
  await clearOperationalData(connection);
  for(const table of TABLES){for(const row of snapshot.tables[table]||[]){const columns=Object.keys(row);if(columns.length)await connection.query(`INSERT INTO \`${table}\` (${columns.map(c=>`\`${c}\``).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,columns.map(c=>databaseValue(row[c])));}}
}
function snapshotSql(snapshot,escape){
  let output=`-- Library recovery backup\n-- Generated ${new Date().toISOString()}\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSTART TRANSACTION;\n`;
  for(const table of TABLES)for(const row of snapshot.tables[table]||[]){const columns=Object.keys(row);output+=`INSERT INTO \`${table}\` (${columns.map(c=>`\`${c}\``).join(',')}) VALUES (${columns.map(c=>escape(databaseValue(row[c]))).join(',')});\n`;}
  return output+'COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n';
}
module.exports={TABLES,DELETE_ORDER,decrypt,saveSnapshot,clearOperationalData,restoreSnapshot,snapshotSql,_encryptForTest:encrypt};
