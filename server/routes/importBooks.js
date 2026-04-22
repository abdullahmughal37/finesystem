const express = require("express")
const router = express.Router()
const multer = require("multer")
const csv = require("csv-parser")
const fs = require("fs")
const db = require("../db")

const upload = multer({ dest: "uploads/" })

router.post("/import", upload.single("file"), (req,res)=>{

 const results = []

 fs.createReadStream(req.file.path)
  .pipe(csv())
  .on("data",(data)=>results.push(data))
  .on("end",()=>{

   results.forEach(row=>{

    const sql =
     "INSERT INTO books (title,author,isbn,serial,category,total,available) VALUES (?,?,?,?,?,?,?)"

    db.query(sql,[
      row.title,
      row.author,
      row.isbn,
      row.serial,
      row.category,
      row.total,
      row.total
    ])

   })

   res.json({message:"Books Imported"})
  })

})
module.exports = router