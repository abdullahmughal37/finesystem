const express = require('express');
const router = express.Router();
const db = require('../db');
const { transaction, sendError } = require('../lib/database');
const { clean, ValidationError } = require('../lib/records');
const { today, addDays, getPolicy } = require('../lib/policy');
const {getLayout}=require('../lib/layouts');
const {bookSearchClause,bookSearchArgs,describeBookMatch,withoutInternalBookFields}=require('../lib/bookSearch');
for (const kind of ['student','book']) {
  router.get(`/${kind}/:query`, async (req,res) => {
    try {
      const q=clean(req.params.query); const isStudent=kind==='student';
      const table=isStudent?'students':'books';const key=isStudent?'registration_no':'accession_no';const name=isStudent?'name':'title';const field=isStudent?'student_id':'book_id';
      const active=`(SELECT COUNT(*) FROM issues i WHERE i.${field}=t.id AND returned=0)`;
      const select=`SELECT t.*, ${active} AS ${isStudent?'issued':'activeIssues'}${isStudent?'':`, GREATEST(t.total_copies-${active},0) AS availableCopies`} FROM ${table} t`;
      const [exact]=await db.promise().query(`${select} WHERE t.${key}=?`,[q]);
      let matches=exact;
      if(!matches.length) {
        if(isStudent) [matches]=await db.promise().query(`${select} WHERE t.${name} LIKE ? ORDER BY t.${key} LIMIT 20`,[`%${q}%`]);
        else [matches]=await db.promise().query(`${select} WHERE ${bookSearchClause('t')} ORDER BY CASE WHEN t.title LIKE ? THEN 0 WHEN t.author_name LIKE ? THEN 1 WHEN t.call_no LIKE ? THEN 2 ELSE 3 END,t.title,t.accession_no LIMIT 20`,[...bookSearchArgs(q),`${q}%`,`${q}%`,`${q}%`]);
      }
      let publicMatches;
      if(isStudent) publicMatches=matches;
      else {const layout=await getLayout('books');publicMatches=matches.map(row=>({...withoutInternalBookFields(row),match:describeBookMatch(row,q,layout)}));}
      const policy=await getPolicy(db.promise());
      res.json({found:publicMatches.length===1,[kind]:publicMatches.length===1?publicMatches[0]:null,matches:publicMatches,policy,ambiguous:publicMatches.length>1});
    } catch(error) {sendError(res,error);}
  });
}
router.post('/issue',async(req,res)=>{
  try {
    const registration=clean(req.body.registration_no);const accession=clean(req.body.accession_no);
    if(!registration||!accession)throw new ValidationError('Select a student and a book.');
    const result=await transaction(async connection=>{
      const [students]=await connection.query('SELECT * FROM students WHERE registration_no=? FOR UPDATE',[registration]);
      if(!students.length)throw new ValidationError('Student not found.',404);
      const student=students[0];
      if(student.status!=='Active')throw new ValidationError(`Student is ${student.status} and cannot borrow.`,409);
      const [books]=await connection.query('SELECT id,total_copies FROM books WHERE accession_no=? FOR UPDATE',[accession]);
      if(!books.length)throw new ValidationError('Book not found.',404);
      const [active]=await connection.query('SELECT id FROM issues WHERE book_id=? AND returned=0 FOR UPDATE',[books[0].id]);
      if(active.length>=Number(books[0].total_copies))throw new ValidationError('All copies of this book are currently issued. Return a copy before issuing another.',409,'no_copies_available');
      const policy=await getPolicy(connection);
      const [loans]=await connection.query('SELECT id FROM issues WHERE student_id=? AND returned=0 FOR UPDATE',[student.id]);
      if(loans.length>=policy.maxBooks)throw new ValidationError(`Student already has the maximum of ${policy.maxBooks} books.`,409);
      const issueDate=today();const dueDate=addDays(issueDate,policy.issueDays);
      const [insert]=await connection.query('INSERT INTO issues (student_id,book_id,issue_date,due_date,returned) VALUES (?,?,?,?,0)',[student.id,books[0].id,issueDate,dueDate]);
      return {success:true,message:'Book Issued Successfully',issueId:insert.insertId,issueDate,dueDate,availableCopies:Number(books[0].total_copies)-active.length-1,policy};
    });
    res.status(201).json(result);
  } catch(error){sendError(res,error);}
});
module.exports=router;
