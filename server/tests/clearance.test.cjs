const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_TEMPLATE, normalizeTemplate, replaceTokens, renderClearancePdf, renderPendingClearancePdf, pdfHash } = require('../lib/clearance');

test('clearance templates validate section order, prefix, and placeholders', () => {
  const template = normalizeTemplate({ ...DEFAULT_TEMPLATE, referencePrefix: 'lib-clr', body: 'Student {{student_name}} / {{custom_field123}}' });
  assert.equal(template.referencePrefix, 'LIB-CLR');
  assert.equal(replaceTokens(template.body, { student_name: 'Ali', custom_field123: 'CS' }), 'Student Ali / CS');
  assert.deepEqual(normalizeTemplate({ ...DEFAULT_TEMPLATE, sectionOrder: [...DEFAULT_TEMPLATE.sectionOrder, 'footer'] }).sectionOrder, DEFAULT_TEMPLATE.sectionOrder);
  assert.throws(() => normalizeTemplate({ ...DEFAULT_TEMPLATE, sectionOrder: ['header'] }), /each supported section/);
  assert.throws(() => normalizeTemplate({ ...DEFAULT_TEMPLATE, body: '{{bad token}}' }), /Invalid placeholder/);
});

test('clearance PDF is generated with a stable integrity hash', async () => {
  const template = normalizeTemplate(DEFAULT_TEMPLATE);
  const student = { name: 'Sample Student', registration_no: 'S-001', department: 'Computer Science', custom_data: '{}' };
  const pdf = await renderClearancePdf({ student, template, referenceNumber: 'LIB-CLR-2026-000001', purpose: 'Degree issuance', issueDate: '2026-09-13' });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert(pdf.length > 1000);
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
  assert.match(pdfHash(pdf), /^[a-f0-9]{64}$/);
  assert.equal(pdfHash(pdf), pdfHash(Buffer.from(pdf)));

  const pending = await renderPendingClearancePdf({
    check: {
      student,
      activeIssues: [{ title: 'Algorithms', accession_no: 'CS-001', due_date: '2026-09-01' }],
      unresolvedFines: [{ id: 7, fine_amount: 250, reason: 'Overdue return', status: 'unsent' }],
      fineTotal: 250,
    },
    template,
    issueDate: '2026-09-13',
  });
  assert.equal(pending.subarray(0, 4).toString(), '%PDF');
  assert.equal((pending.toString('latin1').match(/\/Type \/Page\b/g) || []).length, 1);
});
