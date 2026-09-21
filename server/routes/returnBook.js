const express=require('express');
const router=express.Router();
const db=require('../db');
const {transaction,sendError}=require('../lib/database');
const {ValidationError,clean}=require('../lib/records');
const {today,daysLate,getPolicy,fineAmount}=require('../lib/policy');
const {getLayout}=require('../lib/layouts');
const {bookSearchClause,bookSearchArgs,describeBookMatch}=require('../lib/bookSearch');
for(const mode of ['student','book'])router.get(`/issues/${mode}/:key`,async(req,res)=>{
  try{
    const key=clean(req.params.key).toUpperCase();
    if(!key)throw new ValidationError('Enter a registration or accession number.');
    const bookColumns='b.title book_title,b.accession_no,b.author_name,b.call_no,b.isbn,b.publisher,b.publish_year,b.pages,b.binding,b.source,b.cost,b.remarks,b.total_copies,b.custom_data';
    const sql=mode==='student'
      ? `SELECT i.*,s.name student_name,s.registration_no,${bookColumns} FROM issues i JOIN students s ON s.id=i.student_id JOIN books b ON b.id=i.book_id WHERE s.registration_no=? AND i.returned=0 ORDER BY i.issue_date`
      : `SELECT i.*,s.name student_name,s.registration_no,${bookColumns} FROM issues i JOIN students s ON s.id=i.student_id JOIN books b ON b.id=i.book_id WHERE ${bookSearchClause('b')} AND i.returned=0 ORDER BY CASE WHEN b.accession_no=? THEN 0 WHEN b.title LIKE ? THEN 1 WHEN b.author_name LIKE ? THEN 2 ELSE 3 END,i.issue_date LIMIT 50`;
    const [rows]=await db.promise().query(sql,mode==='student'?[key]:[...bookSearchArgs(key),key,`${key}%`,`${key}%`]);
    const policy=await getPolicy(db.promise());const date=today();
    const layout=mode==='book'?await getLayout('books'):null;
    res.json({records:rows.map(r=>{const overdueDays=daysLate(r.due_date,date);return {issueId:r.id,studentName:r.student_name,registrationNo:r.registration_no,bookTitle:r.book_title,accessionNo:r.accession_no,authorName:r.author_name||'',callNo:r.call_no||'',isbn:r.isbn||'',issueDate:r.issue_date,dueDate:r.due_date,status:overdueDays?'Overdue':'On Time',overdueDays,fineAmount:fineAmount(overdueDays,policy.finePerDay),finePerDay:policy.finePerDay,match:layout?describeBookMatch({...r,title:r.book_title},key,layout):null};})});
  }catch(error){sendError(res,error);}
});
router.post('/return/:issueId',async(req,res)=>{
  try{
    const id=Number(req.params.issueId);if(!Number.isSafeInteger(id)||id<1)throw new ValidationError('Invalid issue ID.');
    const result=await transaction(async connection=>{
      const [rows]=await connection.query('SELECT * FROM issues WHERE id=? FOR UPDATE',[id]);
      if(!rows.length)throw new ValidationError('Issue not found.',404);
      const issue=rows[0];
      if(Number(issue.returned)===1)return {success:true,alreadyReturned:true};
      const policy=await getPolicy(connection);const date=today();const overdueDays=daysLate(issue.due_date,date);const amount=fineAmount(overdueDays,policy.finePerDay);
      if(amount>0)await connection.query("INSERT INTO fines (issue_id,student_id,book_id,days_late,fine_amount,fine_type,reason,status) VALUES (?,?,?,?,?,'auto',?,'unsent')",[id,issue.student_id,issue.book_id,overdueDays,amount,`Late return - ${overdueDays} day${overdueDays===1?'':'s'}`]);
      await connection.query('UPDATE issues SET returned=1,return_date=? WHERE id=?',[date,id]);
      const [stock]=await connection.query('SELECT b.total_copies-(SELECT COUNT(*) FROM issues i WHERE i.book_id=b.id AND i.returned=0) availableCopies FROM books b WHERE b.id=?',[issue.book_id]);
      return {success:true,fineGenerated:amount>0,overdueDays,fineAmount:amount,availableCopies:Number(stock[0]?.availableCopies||0)};
    });
    res.json(result);
  }catch(error){sendError(res,error);}
});
module.exports=router;
