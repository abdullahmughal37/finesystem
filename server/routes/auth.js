const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const config = require("../config");
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require('../middleware/auth');
const { ValidationError, clean } = require('../lib/records');
const { transaction, sendError } = require('../lib/database');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again later." },
});

router.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || Buffer.byteLength(password,'utf8') > 72) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const emailNorm = String(email).trim().toLowerCase();

  db.query(
    "SELECT * FROM admins WHERE email = ?",
    [emailNorm],
    async (err, rows) => {
      if (err) {
        console.error('Login lookup failed:', err.code || err.message);
        return res.status(500).json({ error: "Server error" });
      }
      if (!rows || rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const admin = rows[0];

      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        return res.status(423).json({
          error: "Account temporarily locked",
          message: "Too many failed attempts. Try again later.",
        });
      }

      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) {
        const failed = (admin.failed_attempts || 0) + 1;
        const maxAttempts = config.rateLimit.maxAttempts;
        const lockoutMinutes = config.rateLimit.lockoutMinutes;
        const lockedUntil = failed >= maxAttempts
          ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
          : null;

        db.query(
          "UPDATE admins SET failed_attempts = ?, locked_until = ? WHERE id = ?",
          [failed, lockedUntil, admin.id],
          () => {}
        );

        return res.status(401).json({
          error: "Invalid email or password",
          attemptsLeft: Math.max(0, maxAttempts - failed),
          locked: failed >= maxAttempts,
        });
      }

      db.query("UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = ?", [admin.id], () => {});

      const token = jwt.sign(
        { id: admin.id, email: admin.email, version:admin.password_version || 0 },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        token,
        user: { id: admin.id, email: admin.email, name: admin.name },
      });
    }
  );
});

router.put('/account',authMiddleware,loginLimiter,async(req,res)=>{
  try {
    const {currentPassword,password,email}=req.body;
    if (typeof currentPassword!=='string'||typeof email!=='string'||typeof password!=='string') return res.status(400).json({error:'Enter your current password and email. New password is optional.'});
    const normalized=email.trim().toLowerCase();
    if(normalized.length>255||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(normalized)) return res.status(400).json({error:'Enter a valid email address.'});
    if(password && (password.length<12||Buffer.byteLength(password,'utf8')>72)) return res.status(400).json({error:'Use a password of at least 12 characters and at most 72 UTF-8 bytes.'});
    const [rows]=await db.promise().query('SELECT * FROM admins WHERE id=?',[req.user.id]);const admin=rows[0];
    if(!admin||!await bcrypt.compare(currentPassword,admin.password_hash)) return res.status(400).json({error:'Current password is incorrect.'});
    const name=req.body.name===undefined?admin.name:clean(req.body.name);
    if(!name||name.length>100)return res.status(400).json({error:'Enter an administrator name of up to 100 characters.'});
    const hash=password?await bcrypt.hash(password,12):admin.password_hash;
    const [result]=await db.promise().query('UPDATE admins SET name=?,email=?,password_hash=?,password_version=password_version+1,failed_attempts=0,locked_until=NULL WHERE id=? AND password_version=?',[name,normalized,hash,admin.id,admin.password_version]);
    if(!result.affectedRows)return res.status(409).json({error:'Account changed in another session. Sign in again.'});
    res.json({success:true});
  }catch(e){
    if(e.code==='ER_DUP_ENTRY')return res.status(409).json({error:'An administrator with this email already exists.'});
    sendError(res,e);
  }
});

router.get('/admins',authMiddleware,async(req,res)=>{
  try {const [rows]=await db.promise().query('SELECT id,name,email,created_at FROM admins ORDER BY id');res.json(rows);}
  catch(error){sendError(res,error);}
});

router.post('/admins',authMiddleware,async(req,res)=>{
  try {
    const name=clean(req.body.name);const email=clean(req.body.email).toLowerCase();const password=req.body.password;
    if(!name||name.length>100)throw new ValidationError('Enter a name of up to 100 characters.');
    if(email.length>255||!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email))throw new ValidationError('Enter a valid email address.');
    if(typeof password!=='string'||password.length<12||Buffer.byteLength(password,'utf8')>72)throw new ValidationError('Use a password of at least 12 characters and at most 72 UTF-8 bytes.');
    const [count]=await db.promise().query('SELECT COUNT(*) total FROM admins');
    if(count[0].total>=50)throw new ValidationError('This installation supports up to 50 administrator accounts.');
    const [result]=await db.promise().query('INSERT INTO admins(name,email,password_hash) VALUES (?,?,?)',[name,email,await bcrypt.hash(password,12)]);
    res.status(201).json({success:true,admin:{id:result.insertId,name,email}});
  }catch(error){
    if(error.code==='ER_DUP_ENTRY')return res.status(409).json({error:'An administrator with this email already exists.'});
    sendError(res,error);
  }
});

router.delete('/admins/:id',authMiddleware,async(req,res)=>{
  try {
    const id=Number(req.params.id);
    if(!Number.isSafeInteger(id)||id<1)throw new ValidationError('Invalid administrator ID.');
    if(id===req.user.id)throw new ValidationError('You cannot remove the account you are currently using.',409);
    await transaction(async connection=>{
      const [admins]=await connection.query('SELECT id FROM admins FOR UPDATE');
      if(!admins.some(admin=>admin.id===id))throw new ValidationError('Administrator account not found.',404);
      if(admins.length<=1)throw new ValidationError('Keep at least one administrator account.',409);
      await connection.query('DELETE FROM admins WHERE id=?',[id]);
    });
    res.json({success:true});
  }catch(error){sendError(res,error);}
});
module.exports = router;
