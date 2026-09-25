const test=require('node:test');
const assert=require('node:assert/strict');
process.env.JWT_SECRET ||= 'test-only-recovery-secret-at-least-32-characters';
const {_encryptForTest,decrypt,snapshotSql}=require('../lib/recovery');

test('recovery snapshots are encrypted, integrity checked, and preserve binary PDFs',()=>{
  const snapshot={version:1,recordCount:2,tables:{students:[{id:1,name:'Student'}],clearance_letters:[{id:2,pdf_data:Buffer.from('pdf bytes')}]}};
  const sealed=_encryptForTest(snapshot);
  assert(!sealed.encrypted.includes(Buffer.from('Student')));
  const restored=decrypt({encrypted_payload:sealed.encrypted,payload_iv:sealed.iv,payload_tag:sealed.tag,payload_sha256:sealed.hash});
  assert.equal(restored.tables.students[0].name,'Student');
  assert.deepEqual(restored.tables.clearance_letters[0].pdf_data,Buffer.from('pdf bytes'));
  const changed=Buffer.from(sealed.encrypted);changed[0]^=1;
  assert.throws(()=>decrypt({encrypted_payload:changed,payload_iv:sealed.iv,payload_tag:sealed.tag,payload_sha256:sealed.hash}));
});

test('recovery SQL includes transaction and foreign-key protection',()=>{
  const sql=snapshotSql({tables:{students:[{id:1,name:'Student'}]}},value=>value===null?'NULL':`'${String(value).replaceAll("'","''")}'`);
  assert.match(sql,/START TRANSACTION/);assert.match(sql,/INSERT INTO `students`/);assert.match(sql,/COMMIT/);assert.match(sql,/SET FOREIGN_KEY_CHECKS=1/);
});
