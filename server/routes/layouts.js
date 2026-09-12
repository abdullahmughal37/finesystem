const router = require('express').Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getLayout, updateLayout } = require('../lib/layouts');
const { sendError } = require('../lib/database');
router.get('/:kind',async(req,res)=>{try {res.json(await getLayout(req.params.kind));} catch(e){sendError(res,e);}});
router.put('/:kind',authMiddleware,async(req,res)=>{
  try {
    const [admins] = await db.promise().query('SELECT id FROM admins WHERE id=? AND email=?',[req.user.id,req.user.email]);
    if (!admins.length) return res.status(403).json({error:'An administrator account is required.'});
    res.json(await updateLayout(req.params.kind,req.body));
  } catch(e){sendError(res,e);}
});
module.exports=router;
