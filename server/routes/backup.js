const express = require("express");
const router = express.Router();
const db = require("../db");
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get("/sql", async (req, res) => {
  const tables = ["students", "books", "issues", "fines", "fine_deletions", "catalog_layouts", "settings", "clearance_templates", "clearance_sequences", "clearance_letters"];
  try {
    let output = `-- Library data backup\n-- Generated ${new Date().toISOString()}\n-- Restore into an initialized Library Management System database.\n\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\nSTART TRANSACTION;\n`;
    for (const table of tables) {
      const [rows] = await db.promise().query(`SELECT * FROM ${table}`);
      for (const row of rows) {
        const columns = Object.keys(row);
        output += `INSERT INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(',')}) VALUES (${columns.map(column => db.escape(row[column])).join(',')});\n`;
      }
    }
    output += 'COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\n';
    res.type('application/sql').attachment('library-data-backup.sql').send(output);
  } catch (error) {
    require('../lib/database').sendError(res, error);
  }
});

for(const kind of ['students','books']) router.get('/'+kind+'.csv',async(req,res)=>{
  try {
    const layout=await require('../lib/layouts').getLayout(kind);
    const [rows]=await db.promise().query('SELECT * FROM '+kind+' ORDER BY id');
    const fields=layout.fields.filter(f=>!f.archived);
    const {customValues}=require('../lib/fieldSchema');
    res.type('text/csv').attachment(kind+'.csv').send(require('../lib/records').csvText(fields.map(f=>f.label),rows.map(row=>{const values={...customValues(row),...row};return fields.map(f=>values[f.key]);})));
  }catch(e){require('../lib/database').sendError(res,e);}
});

router.post("/delete-all", (req, res) => {
  const tables = ["clearance_letters", "clearance_sequences", "clearance_templates", "fine_deletions", "fines", "issues", "books", "students"];
  let i = 0;
  const next = () => {
    if (i >= tables.length) return res.json({ success: true });
    const t = tables[i++];
    db.query(`DELETE FROM ${t}`, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`, () => next());
    });
  };
  next();
});

module.exports = router;
