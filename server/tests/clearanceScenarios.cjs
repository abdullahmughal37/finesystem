const assert = require('node:assert/strict');

module.exports = async function clearanceScenarios(t, { base, db, request, authToken }) {
  let studentId, fineId, letterId, reference, originalPdf;
  await t.test('clearance starts ready for a student without obligations', async () => {
    let response = await request('/api/students', 'POST', { name: 'Clearance Student', registration_no: 'CLR001', department: 'Computer Science', status: 'Graduated' });
    assert.equal(response.status, 201); studentId = response.data.id;
    response = await request(`/api/clearance/check/${studentId}`);
    assert.equal(response.status, 200); assert.equal(response.data.eligible, true);
  });
  await t.test('unresolved fines block clearance and resolved fines do not', async () => {
    let response = await request('/api/fines/create', 'POST', { registration_no: 'CLR001', fine_amount: 250, reason: 'Damaged book' });
    assert.equal(response.status, 201); fineId = response.data.id;
    response = await request(`/api/clearance/check/${studentId}`); assert.equal(response.data.eligible, false); assert.equal(response.data.fineTotal, 250);
    response = await request(`/api/fines/${fineId}/resolve`, 'POST', { resolution: 'paid', reason: 'Accounts receipt TEST-1 verified' }); assert.equal(response.status, 200);
    response = await request(`/api/clearance/check/${studentId}`); assert.equal(response.data.eligible, true);
  });
  await t.test('template saves as a new version', async () => {
    let response = await request('/api/clearance/template'); const version = response.data.version;
    response.data.config.body += '\nIntegration template marker.';
    response = await request('/api/clearance/template', 'POST', { config: response.data.config });
    assert.equal(response.status, 201); assert.equal(response.data.version, version + 1);
  });
  await t.test('issuing stores a downloadable immutable PDF and public verification record', async () => {
    let response = await request('/api/clearance/issue', 'POST', { studentId, purpose: 'Degree issuance' });
    assert.equal(response.status, 201); letterId = response.data.id; reference = response.data.referenceNumber; assert.match(reference, /^LIB-CLR-\d{4}-\d{6}$/);
    const download = await fetch(`${base}/api/clearance/letters/${letterId}/pdf`, { headers: { Authorization: `Bearer ${authToken}` } });
    assert.equal(download.status, 200); originalPdf = Buffer.from(await download.arrayBuffer()); assert.equal(originalPdf.subarray(0, 4).toString(), '%PDF');
    const verify = await fetch(`${base}/api/clearance/verify/${reference}`); const data = await verify.json(); assert.equal(verify.status, 200); assert.equal(data.valid, true); assert.equal(data.registrationNumber, 'CLR001');
  });
  await t.test('template edits cannot change an already-issued PDF', async () => {
    let response = await request('/api/clearance/template'); response.data.config.title = 'CHANGED FUTURE TITLE';
    response = await request('/api/clearance/template', 'POST', { config: response.data.config }); assert.equal(response.status, 201);
    const download = await fetch(`${base}/api/clearance/letters/${letterId}/pdf`, { headers: { Authorization: `Bearer ${authToken}` } });
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), originalPdf);
  });
  await t.test('revocation changes verification but preserves PDF and audit history', async () => {
    let response = await request(`/api/clearance/letters/${letterId}/revoke`, 'POST', { reason: 'Test revocation requested' }); assert.equal(response.status, 200);
    const verify = await fetch(`${base}/api/clearance/verify/${reference}`); const data = await verify.json(); assert.equal(data.valid, false); assert.equal(data.status, 'revoked');
    response = await request(`/api/students/${studentId}`, 'DELETE'); assert.equal(response.status, 409);
  });
  await t.test('reopening a paid fine immediately blocks new clearance', async () => {
    let response = await request(`/api/fines/${fineId}/reopen`, 'POST', { reason: 'Payment reversed during test' }); assert.equal(response.status, 200);
    response = await request(`/api/clearance/check/${studentId}`); assert.equal(response.data.eligible, false);
  });
  await t.test('pending report is a PDF and resolved fine trash keeps its resolution audit', async () => {
    let response = await fetch(`${base}/api/clearance/pending/${studentId}/pdf`, { headers: { Authorization: `Bearer ${authToken}` } });
    assert.equal(response.status, 200); assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
    response = await request(`/api/fines/${fineId}/resolve`, 'POST', { resolution: 'waived', reason: 'Approved test waiver' }); assert.equal(response.status, 200);
    response = await request(`/api/fines/${fineId}/trash`, 'POST', { reason: 'Archive resolved test fine' }); assert.equal(response.status, 200);
    response = await request('/api/fines/trash?search=CLR001'); const row = response.data.rows.find(item => item.fineId === fineId); assert.equal(row.resolutionStatus, 'waived'); assert.equal(row.resolutionReason, 'Approved test waiver');
  });
};
