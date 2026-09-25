const express = require("express");

const router = express.Router();

const studentController = require("../controllers/studentController");
const db = require('../db');
const {moveToTrash,restoreFromTrash,pageOptions}=require('../lib/catalog');
const {purgeExpiredCatalog}=require('../lib/catalogTrash');
const {sendError}=require('../lib/database');

router.get("/students", studentController.getStudents);

router.post("/students", studentController.addStudent);

router.get('/students/trash',async(req,res)=>{try{await purgeExpiredCatalog(db.promise());const {page,limit,offset,search}=pageOptions(req.query);const where=search?"deleted_at IS NOT NULL AND purged_at IS NULL AND (name LIKE ? OR registration_no LIKE ? OR email LIKE ?)":"deleted_at IS NOT NULL AND purged_at IS NULL";const args=search?Array(3).fill(`%${search}%`):[];const [count]=await db.promise().query(`SELECT COUNT(*) total FROM students WHERE ${where}`,args);const [rows]=await db.promise().query(`SELECT * FROM students WHERE ${where} ORDER BY deleted_at DESC LIMIT ? OFFSET ?`,[...args,limit,offset]);res.json({rows,total:Number(count[0].total),page,limit});}catch(e){sendError(res,e);}});
router.post('/students/bulk-delete',async(req,res)=>{try{const count=await moveToTrash('students',req.body?.ids,req.user,req.body?.reason);res.json({success:true,count});}catch(e){sendError(res,e);}});
router.post('/students/trash/restore',async(req,res)=>{try{const count=await restoreFromTrash('students',req.body?.ids);res.json({success:true,count});}catch(e){sendError(res,e);}});

router.put("/students/:id", studentController.updateStudent);

router.delete("/students/:id", studentController.deleteStudent);

module.exports = router;
