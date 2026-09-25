const db = require('../db');
function requestIp(req) { return String(req.ip || req.socket?.remoteAddress || '').slice(0, 100); }
async function writeAudit({ adminId=null, adminName='', adminEmail='', action, method, path, targetType='', targetId='', summary='', ipAddress='', userAgent='', statusCode=200 }) {
  try {
    if (adminId && (!adminName || !adminEmail)) {
      const [rows] = await db.promise().query('SELECT name,email FROM admins WHERE id=?', [adminId]);
      adminName ||= rows[0]?.name || ''; adminEmail ||= rows[0]?.email || '';
    }
    await db.promise().query('INSERT INTO audit_logs(admin_id,admin_name,admin_email,action,method,path,target_type,target_id,summary,ip_address,user_agent,status_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [adminId,adminName,adminEmail,String(action).slice(0,100),String(method||'').slice(0,10),String(path||'').slice(0,500),String(targetType||'').slice(0,100),String(targetId||'').slice(0,100),String(summary||'').slice(0,1000),String(ipAddress||'').slice(0,100),String(userAgent||'').slice(0,500),Number(statusCode)||0]);
  } catch (error) { console.error('Audit log write failed:', error.code || error.message); }
}
function actionFor(req) {
  const path=req.originalUrl.split('?')[0];
  if(path.includes('/bulk-delete'))return 'bulk_delete'; if(path.includes('/trash/restore'))return 'trash_restore';
  if(path.includes('/reset'))return 'system_reset'; if(path.includes('/restore'))return 'backup_restore';
  if(path.includes('/issue'))return 'book_issue'; if(path.includes('/return/'))return 'book_return'; if(path.includes('/import'))return 'catalog_import';
  return ({POST:'create',PUT:'update',PATCH:'update',DELETE:'delete'})[req.method] || req.method.toLowerCase();
}
function auditMiddleware(req,res,next) {
  if(['GET','HEAD','OPTIONS'].includes(req.method))return next(); const started=Date.now();
  res.on('finish',()=>{const path=req.originalUrl.split('?')[0],parts=path.split('/').filter(Boolean);void writeAudit({adminId:req.user?.id,adminEmail:req.user?.email,action:actionFor(req),method:req.method,path,targetType:parts[1]||'',targetId:req.params?.id||(Array.isArray(req.body?.ids)?`${req.body.ids.length} records`:''),summary:res.statusCode<400?`Completed in ${Date.now()-started} ms`:`Request failed with status ${res.statusCode}`,ipAddress:requestIp(req),userAgent:req.get('user-agent')||'',statusCode:res.statusCode});}); next();
}
module.exports={auditMiddleware,writeAudit,requestIp};
