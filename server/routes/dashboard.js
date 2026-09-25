const express=require('express');
const router=express.Router();
const db=require('../db');
const {today}=require('../lib/policy');
const {sendError}=require('../lib/database');
router.get('/stats',async(req,res)=>{
  try{
    const queries={totalStudents:'SELECT COUNT(*) v FROM students WHERE deleted_at IS NULL',totalBooks:'SELECT COALESCE(SUM(total_copies),0) v FROM books WHERE deleted_at IS NULL',issuedBooks:'SELECT COUNT(*) v FROM issues WHERE returned=0',returnedBooks:'SELECT COUNT(*) v FROM issues WHERE returned=1',overdueBooks:'SELECT COUNT(*) v FROM issues WHERE returned=0 AND due_date<?',studentsWithFines:"SELECT COUNT(DISTINCT student_id) v FROM fines WHERE status='unsent' AND COALESCE(resolution_status,'pending')='pending'",totalFines:"SELECT COALESCE(SUM(fine_amount),0) v FROM fines WHERE COALESCE(resolution_status,'pending')='pending'"};
    const results=await Promise.all(Object.entries(queries).map(async([k,sql])=>{const [rows]=await db.promise().query(sql,k==='overdueBooks'?[today()]:[]);return [k,Number(rows[0].v)];}));res.json(Object.fromEntries(results));
  }catch(error){sendError(res,error);}
});
router.get('/monthly',async(req,res)=>{
  try{
    const [issues]=await db.promise().query("SELECT DATE_FORMAT(issue_date,'%Y-%m') month,COUNT(*) issued FROM issues GROUP BY DATE_FORMAT(issue_date,'%Y-%m')");
    const [returns]=await db.promise().query("SELECT DATE_FORMAT(return_date,'%Y-%m') month,COUNT(*) returned FROM issues WHERE returned=1 GROUP BY DATE_FORMAT(return_date,'%Y-%m')");
    const [fines]=await db.promise().query("SELECT DATE_FORMAT(created_at,'%Y-%m') month,SUM(fine_amount) fines FROM fines GROUP BY DATE_FORMAT(created_at,'%Y-%m')");
    const end=new Date(today().slice(0,7)+'-01T00:00:00Z');const months=[];
    for(let i=5;i>=0;i--){const d=new Date(end);d.setUTCMonth(d.getUTCMonth()-i);const key=d.toISOString().slice(0,7);months.push({month:key,issued:Number(issues.find(x=>x.month===key)?.issued||0),returned:Number(returns.find(x=>x.month===key)?.returned||0),fines:Number(fines.find(x=>x.month===key)?.fines||0)});}res.json(months);
  }catch(error){sendError(res,error);}
});
router.get('/recent-issues',async(req,res)=>{
  try{const [rows]=await db.promise().query("SELECT i.id,s.registration_no,s.name,b.title book,i.issue_date,i.due_date,CASE WHEN i.due_date<? THEN 'Overdue' ELSE 'Active' END status FROM issues i JOIN students s ON s.id=i.student_id JOIN books b ON b.id=i.book_id WHERE returned=0 ORDER BY i.id DESC LIMIT 6",[today()]);res.json(rows);}catch(error){sendError(res,error);}
});
router.get('/recent-fines',async(req,res)=>{
  try{const [rows]=await db.promise().query("SELECT f.id,s.registration_no,s.name,f.fine_amount,f.days_late,f.fine_type,f.reason,f.status FROM fines f JOIN students s ON s.id=f.student_id ORDER BY f.id DESC LIMIT 5");res.json(rows.map(r=>({id:r.id,registrationNo:r.registration_no,name:r.name,amount:`PKR ${r.fine_amount}`,reason:r.reason||(r.fine_type==='auto'?`Late return - ${r.days_late} days`:'Manual fine'),type:r.fine_type==='manual'?'Manual':'Auto',status:r.status==='sent'?'Sent':'Unsent'})));}catch(error){sendError(res,error);}
});
module.exports=router;
