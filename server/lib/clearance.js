const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { ValidationError, clean } = require('./records');
const { customValues } = require('./fieldSchema');

const SECTION_KEYS = ['header', 'meta', 'title', 'body', 'signature'];
const CORE_TOKENS = [
  'student_name', 'registration_number', 'father_name', 'department', 'semester',
  'student_status', 'student_email', 'contact_number', 'purpose', 'issue_date',
  'reference_number', 'active_books_count', 'outstanding_fine', 'university_name',
  'campus', 'address', 'signatory_name', 'signatory_title', 'signatory_department',
  'signatory_email',
];

const DEFAULT_TEMPLATE = Object.freeze({
  name: 'Library Clearance Letter',
  universityName: 'COMSATS University Islamabad',
  campus: 'Sahiwal Campus',
  address: 'Off G.T. Road, Sahiwal, Punjab, Pakistan',
  contactLine: '',
  title: 'LIBRARY CLEARANCE CERTIFICATE',
  body: 'This is to certify that {{student_name}}, Registration Number {{registration_number}}, of the {{department}} department has returned all library material issued in their name and, as of {{issue_date}}, has no outstanding library fine or obligation.\n\nThis certificate is issued on request for {{purpose}}.',
  footer: '{{university_name}} · {{campus}}',
  referencePrefix: 'LIB-CLR',
  signatoryName: 'Library Administrator',
  signatoryTitle: 'Librarian',
  signatoryDepartment: 'Library Services',
  signatoryEmail: '',
  logoUrl: '',
  signatureUrl: '',
  verificationBaseUrl: '',
  sectionOrder: [...SECTION_KEYS],
  showLogo: true,
  showSignature: true,
  showFooter: true,
  fontSize: 11,
});

function limited(value, max, label, required = false) {
  const result = clean(value);
  if (required && !result) throw new ValidationError(`${label} is required.`);
  if (result.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  return result;
}

function normalizeTemplate(input = {}, settings = {}) {
  const source = { ...DEFAULT_TEMPLATE, ...settings, ...input };
  // Early development versions stored the footer in sectionOrder. The footer is
  // anchored beside the QR code now, so accept and migrate that saved shape.
  const savedOrder = Array.isArray(source.sectionOrder) ? source.sectionOrder : SECTION_KEYS;
  const order = savedOrder.length === SECTION_KEYS.length + 1 && savedOrder.includes('footer')
    ? savedOrder.filter(key => key !== 'footer')
    : savedOrder;
  if (order.length !== SECTION_KEYS.length || new Set(order).size !== SECTION_KEYS.length || order.some(key => !SECTION_KEYS.includes(key))) {
    throw new ValidationError('Template sections must contain each supported section exactly once.');
  }
  const template = {
    name: limited(source.name, 100, 'Template name', true),
    universityName: limited(source.universityName, 255, 'University name', true),
    campus: limited(source.campus, 150, 'Campus'),
    address: limited(source.address, 500, 'Address'),
    contactLine: limited(source.contactLine, 500, 'Contact line'),
    title: limited(source.title, 200, 'Document title', true),
    body: limited(source.body, 6000, 'Letter body', true),
    footer: limited(source.footer, 1000, 'Footer'),
    referencePrefix: limited(source.referencePrefix, 20, 'Reference prefix', true).toUpperCase(),
    signatoryName: limited(source.signatoryName, 150, 'Signatory name'),
    signatoryTitle: limited(source.signatoryTitle, 150, 'Signatory title'),
    signatoryDepartment: limited(source.signatoryDepartment, 150, 'Signatory department'),
    signatoryEmail: limited(source.signatoryEmail, 255, 'Signatory email'),
    logoUrl: limited(source.logoUrl, 500, 'Logo URL'),
    signatureUrl: limited(source.signatureUrl, 500, 'Signature URL'),
    verificationBaseUrl: limited(source.verificationBaseUrl, 500, 'Verification URL'),
    sectionOrder: [...order],
    showLogo: source.showLogo !== false,
    showSignature: source.showSignature !== false,
    showFooter: source.showFooter !== false,
    fontSize: Math.min(14, Math.max(9, Number.parseInt(source.fontSize, 10) || 11)),
  };
  if (template.verificationBaseUrl) {
    let parsed;
    try { parsed = new URL(template.verificationBaseUrl); } catch { throw new ValidationError('Verification website must be a valid HTTP or HTTPS URL.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new ValidationError('Verification website must use HTTP or HTTPS.');
    template.verificationBaseUrl = template.verificationBaseUrl.replace(/\/$/, '');
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{1,19}$/.test(template.referencePrefix)) throw new ValidationError('Reference prefix may contain letters, numbers, hyphens, and underscores.');
  const tokenPattern = /{{\s*([^{}]+?)\s*}}/g;
  for (const value of [template.body, template.footer]) {
    for (const match of value.matchAll(tokenPattern)) if (!/^[a-z][a-z0-9_]{0,63}$/.test(match[1])) throw new ValidationError(`Invalid placeholder “${match[0]}”.`);
  }
  return template;
}

function templateValues(student, template, context) {
  const custom = customValues(student);
  return {
    ...student,
    ...custom,
    student_name: student.name || '',
    registration_number: student.registration_no || '',
    father_name: student.father_name || '',
    department: student.department || '',
    semester: student.semester || '',
    student_status: student.status || '',
    student_email: student.email || '',
    contact_number: student.contact_no || '',
    purpose: context.purpose || '',
    issue_date: context.issueDate || '',
    reference_number: context.referenceNumber || '',
    active_books_count: String(context.activeBooksCount || 0),
    outstanding_fine: Number(context.outstandingFine || 0).toFixed(2),
    university_name: template.universityName,
    campus: template.campus,
    address: template.address,
    signatory_name: template.signatoryName,
    signatory_title: template.signatoryTitle,
    signatory_department: template.signatoryDepartment,
    signatory_email: template.signatoryEmail,
  };
}

function displayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || '');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function pageMetrics(doc) {
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  return { left, right, width: doc.page.width - left - right };
}

function drawLetterhead(doc, template) {
  const { left, width } = pageMetrics(doc);
  const top = doc.y;
  const logo = safeUploadPath(template.logoUrl);
  const hasLogo = template.showLogo && imageSupported(logo);
  const logoSize = 68;
  if (hasLogo) {
    try { doc.image(logo, left, top, { fit: [logoSize, logoSize], align: 'center', valign: 'center' }); } catch {}
  }
  const textX = hasLogo ? left + logoSize + 18 : left;
  const textWidth = width - (hasLogo ? logoSize + 18 : 0);
  const universitySize = template.universityName.length > 48 ? 15 : 17;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(universitySize)
    .text(template.universityName, textX, top, { width: textWidth, align: 'center' });
  if (template.campus) doc.font('Helvetica-Bold').fontSize(11).text(template.campus, textX, doc.y + 2, { width: textWidth, align: 'center' });
  if (template.address) doc.font('Helvetica').fontSize(8.5).text(template.address, textX, doc.y + 3, { width: textWidth, align: 'center' });
  if (template.contactLine) doc.fontSize(8.5).text(template.contactLine, textX, doc.y + 2, { width: textWidth, align: 'center' });
  const bottom = Math.max(doc.y, top + (hasLogo ? logoSize : 0));
  doc.moveTo(left, bottom + 12).lineTo(left + width, bottom + 12).lineWidth(1).strokeColor('#cbd5e1').stroke();
  doc.x = left;
  doc.y = bottom + 28;
}

function drawDocumentTitle(doc, title, color = '#111827') {
  const { left, width } = pageMetrics(doc);
  let fontSize = 16;
  doc.font('Helvetica-Bold');
  while (fontSize > 11 && doc.fontSize(fontSize).widthOfString(title) > width) fontSize -= 1;
  doc.fillColor(color).fontSize(fontSize).text(title, left, doc.y, { width, align: 'center', underline: true });
}

function drawFooter(doc, template, text, qr) {
  const { left, width } = pageMetrics(doc);
  const footerTop = doc.page.height - 94;
  doc.moveTo(left, footerTop).lineTo(left + width, footerTop).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
  const textWidth = qr ? width - 92 : width;
  if (template.showFooter && text) {
    doc.fillColor('#475569').font('Helvetica').fontSize(8)
      .text(text, left, footerTop + 22, { width: textWidth, align: 'center', lineBreak: false });
  }
  if (qr) {
    const qrX = left + width - 66;
    doc.image(qr, qrX, footerTop + 7, { width: 58 });
    doc.fillColor('#475569').fontSize(6.5)
      .text('Scan to verify', qrX - 8, footerTop + 66, { width: 74, align: 'center', lineBreak: false });
  }
}

async function renderPendingClearancePdf({ check, template, issueDate }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 18, left: 58, right: 58 }, info: { Title: `Pending clearance - ${check.student.registration_no}`, Author: template.universityName, Subject: 'Pending Library Clearance Report' } });
  const { left, width } = pageMetrics(doc);
  const dateText = displayDate(issueDate);
  drawLetterhead(doc, template);
  drawDocumentTitle(doc, 'PENDING LIBRARY CLEARANCE REPORT', '#991b1b');
  doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(9)
    .text('THIS DOCUMENT IS NOT A CLEARANCE CERTIFICATE', left, doc.y + 5, { width, align: 'center' });

  const detailsY = doc.y + 24;
  doc.roundedRect(left, detailsY, width, 82, 6).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#334155').font('Helvetica').fontSize(9.5);
  doc.text(`Student`, left + 14, detailsY + 13, { width: 82 });
  doc.font('Helvetica-Bold').text(check.student.name, left + 96, detailsY + 13, { width: width - 110 });
  doc.font('Helvetica').text('Registration', left + 14, detailsY + 34, { width: 82 });
  doc.font('Helvetica-Bold').text(check.student.registration_no, left + 96, detailsY + 34, { width: width / 2 - 50 });
  doc.font('Helvetica').text('Department', left + 14, detailsY + 55, { width: 82 });
  doc.font('Helvetica-Bold').text(check.student.department || '-', left + 96, detailsY + 55, { width: width / 2 - 50 });
  doc.font('Helvetica').text(`Report date: ${dateText}`, left + width / 2, detailsY + 34, { width: width / 2 - 14, align: 'right' });
  doc.x = left;
  doc.y = detailsY + 105;

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12).text('Items requiring resolution', left, doc.y, { width });
  doc.moveDown(0.6).font('Helvetica').fontSize(10);
  for (const issue of check.activeIssues) {
    doc.fillColor('#111827').font('Helvetica-Bold').text(`BOOK  ${issue.accession_no}`, left + 10, doc.y, { width: width - 20, continued: true });
    doc.font('Helvetica').text(`  ${issue.title} - due ${displayDate(issue.due_date)}`, { lineGap: 4 });
  }
  for (const fine of check.unresolvedFines) {
    doc.fillColor('#111827').font('Helvetica-Bold').text(`FINE  #${fine.id}`, left + 10, doc.y, { width: width - 20, continued: true });
    doc.font('Helvetica').text(`  PKR ${Number(fine.fine_amount).toLocaleString()} - ${fine.reason || 'Library fine'}${fine.status === 'sent' ? ' (sent to Accounts)' : ''}`, { lineGap: 4 });
  }
  doc.moveDown(1.2);
  if (doc.y + 125 > doc.page.height - 94) doc.addPage();
  const totalY = doc.y;
  doc.roundedRect(left, totalY, width, 38, 5).fillAndStroke('#fff7ed', '#fdba74');
  doc.fillColor('#9a3412').font('Helvetica-Bold').fontSize(10.5)
    .text(`Outstanding fine total: PKR ${Number(check.fineTotal).toLocaleString()}`, left + 12, totalY + 12, { width: width - 24 });
  doc.fillColor('#475569').font('Helvetica').fontSize(9)
    .text('Return every listed book and resolve every fine, then run a fresh clearance check.', left, totalY + 55, { width, align: 'center' });
  if (doc.y > doc.page.height - 108) doc.addPage();
  drawFooter(doc, template, template.footer ? replaceTokens(template.footer, templateValues(check.student, template, { issueDate: dateText })) : '', null);
  return writePdf(doc);
}

function replaceTokens(text, values) {
  return String(text || '').replace(/{{\s*([a-z][a-z0-9_]{0,63})\s*}}/g, (_, key) => String(values[key] ?? ''));
}

function safeUploadPath(url) {
  if (!url || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return null;
  const file = path.join(require('./uploads'), path.basename(url));
  return fs.existsSync(file) ? file : null;
}

function imageSupported(file) {
  return Boolean(file && /\.(png|jpe?g)$/i.test(file));
}

function writePdf(doc) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

async function renderClearancePdf({ student, template, referenceNumber, purpose, issueDate }) {
  const dateText = displayDate(issueDate);
  const values = templateValues(student, template, { referenceNumber, purpose, issueDate: dateText, activeBooksCount: 0, outstandingFine: 0 });
  const doc = new PDFDocument({ size: 'A4', margins: { top: 42, bottom: 18, left: 58, right: 58 }, info: { Title: referenceNumber, Author: template.universityName, Subject: 'Library Clearance Certificate' } });
  const { left, width } = pageMetrics(doc);
  const section = {
    header() {
      drawLetterhead(doc, template);
    },
    meta() {
      const y = doc.y;
      doc.fillColor('#334155').font('Helvetica').fontSize(9.5).text(`Date: ${dateText}`, left, y, { width: width / 2 });
      doc.text(`Reference: ${referenceNumber}`, left + width / 2, y, { width: width / 2, align: 'right' });
      doc.x = left;
      doc.y = y + 38;
    },
    title() {
      drawDocumentTitle(doc, template.title);
      doc.y += 30;
    },
    body() {
      const statusY = doc.y;
      doc.roundedRect(left, statusY, width, 38, 6).fillAndStroke('#ecfdf5', '#86efac');
      doc.fillColor('#166534').font('Helvetica-Bold').fontSize(11.5).text('LIBRARY CLEARANCE STATUS: CLEARED', left, statusY + 12, { width, align: 'center' });
      doc.x = left;
      doc.y = statusY + 58;
      doc.fillColor('#111827');
      doc.font('Helvetica').fontSize(template.fontSize).text(replaceTokens(template.body, values), left, doc.y, { width, align: 'justify', lineGap: 5 });
      doc.x = left;
      doc.y += 18;
    },
    signature() {
      const signature = safeUploadPath(template.signatureUrl);
      const hasSignature = template.showSignature && imageSupported(signature);
      const requiredHeight = hasSignature ? 128 : 105;
      if (doc.y + requiredHeight > doc.page.height - 112) doc.addPage();
      let y = doc.y + 24;
      if (hasSignature) {
        try { doc.image(signature, left, y, { fit: [150, 48], align: 'left' }); y += 52; } catch { y += 32; }
      } else y += 32;
      doc.moveTo(left, y).lineTo(left + 185, y).lineWidth(0.8).strokeColor('#64748b').stroke();
      y += 7;
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10.5).text(template.signatoryName || 'Authorized Signatory', left, y, { width: 240 });
      if (template.signatoryTitle) doc.font('Helvetica').fontSize(9.5).text(template.signatoryTitle, left, doc.y + 1, { width: 240 });
      if (template.signatoryDepartment) doc.text(template.signatoryDepartment, left, doc.y + 1, { width: 240 });
      if (template.signatoryEmail) doc.text(template.signatoryEmail, left, doc.y + 1, { width: 240 });
      doc.x = left;
    },
  };
  for (const key of template.sectionOrder) section[key]();
  const qrValue = template.verificationBaseUrl
    ? `${template.verificationBaseUrl.replace(/\/$/, '')}/verify/${encodeURIComponent(referenceNumber)}`
    : `CLEARANCE:${referenceNumber}`;
  const qr = await QRCode.toBuffer(qrValue, { type: 'png', width: 180, margin: 1, errorCorrectionLevel: 'M' });
  if (doc.y > doc.page.height - 108) doc.addPage();
  drawFooter(doc, template, replaceTokens(template.footer, values), qr);
  return writePdf(doc);
}

function pdfHash(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

async function clearanceCheck(connection, studentId, lock = false) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const [students] = await connection.query(`SELECT * FROM students WHERE id=? AND deleted_at IS NULL${suffix}`, [studentId]);
  if (!students.length) throw new ValidationError('Student not found.', 404);
  const student = students[0];
  const [issues] = await connection.query(`SELECT i.id,i.issue_date,i.due_date,b.id AS book_id,b.accession_no,b.title FROM issues i JOIN books b ON b.id=i.book_id WHERE i.student_id=? AND i.returned=0${suffix}`, [studentId]);
  const [fines] = await connection.query(`SELECT f.id,f.fine_amount,f.reason,f.status,f.sentToAccounts,f.created_at,b.accession_no,b.title AS book_title FROM fines f LEFT JOIN books b ON b.id=f.book_id WHERE f.student_id=? AND COALESCE(f.resolution_status,'pending')='pending'${suffix}`, [studentId]);
  const fineTotal = fines.reduce((sum, fine) => sum + Number(fine.fine_amount || 0), 0);
  const blockers = [
    ...issues.map(issue => ({ type: 'book', id: issue.id, message: `${issue.title} (${issue.accession_no}) is still issued.`, ...issue })),
    ...fines.map(fine => ({ type: 'fine', id: fine.id, message: `PKR ${Number(fine.fine_amount).toLocaleString()} fine is unresolved${fine.status === 'sent' ? ' and has been sent to Accounts' : ''}.`, ...fine })),
  ];
  return { eligible: blockers.length === 0, student, activeIssues: issues, unresolvedFines: fines, fineTotal, blockers };
}

module.exports = { DEFAULT_TEMPLATE, SECTION_KEYS, CORE_TOKENS, normalizeTemplate, replaceTokens, templateValues, renderClearancePdf, renderPendingClearancePdf, pdfHash, clearanceCheck };
