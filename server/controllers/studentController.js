const db = require('../db');
const { save, remove, pageOptions } = require('../lib/catalog');
const { sendError } = require('../lib/database');
exports.getStudents = async (req, res) => {
  try {
    const { page, limit, offset, search } = pageOptions(req.query);
    const where = search ? "WHERE name LIKE ? OR registration_no LIKE ? OR email LIKE ? OR department LIKE ? OR contact_no LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(custom_data, '$.*')) LIKE ?" : '';
    const args = search ? Array(6).fill(`%${search}%`) : [];
    const [count] = await db.promise().query(`SELECT COUNT(*) AS total FROM students ${where}`, args);
    const [rows] = await db.promise().query(`SELECT * FROM students ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
    res.json({ rows, total: count[0].total, page, limit });
  } catch (error) { sendError(res, error); }
};
exports.addStudent = async (req, res) => {
  try { const id = await save('students', req.body); res.status(201).json({ success: true, id, message: 'Student added successfully.' }); }
  catch (error) { sendError(res, error); }
};
exports.updateStudent = async (req, res) => {
  try { await save('students', req.body, Number(req.params.id)); res.json({ success: true, message: 'Student updated successfully.' }); }
  catch (error) { sendError(res, error); }
};
exports.deleteStudent = async (req, res) => {
  try { await remove('students', Number(req.params.id)); res.json({ success: true }); }
  catch (error) { sendError(res, error); }
};
