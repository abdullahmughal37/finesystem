const db = require("../db");

// GET all students
exports.getStudents = (req, res) => {
  const sql = "SELECT * FROM students";

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);
  });
};


// ADD student
exports.addStudent = (req, res) => {

  const { rollNo, name, email, dept, semester, status, enrolled } = req.body;

  const sql = `
  INSERT INTO students 
  (rollNo, name, email, dept, semester, status, enrolled)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [rollNo, name, email, dept, semester, status, enrolled],
    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json({ message: "Student added successfully" });
    }
  );
};


// DELETE student
exports.deleteStudent = (req, res) => {

  const id = req.params.id;

  const sql = "DELETE FROM students WHERE id=?";

  db.query(sql, [id], (err, result) => {

    if (err) {
      return res.status(500).json(err);
    }

    res.json({ message: "Student deleted successfully" });

  });
};
exports.updateStudent = (req, res) => {

  const id = req.params.id;

  const { rollNo, name, email, dept, semester, status, enrolled } = req.body;

  const sql = `
  UPDATE students
  SET rollNo=?, name=?, email=?, dept=?, semester=?, status=?, enrolled=?
  WHERE id=?
  `;

  db.query(
    sql,
    [rollNo, name, email, dept, semester, status, enrolled, id],
    (err, result) => {

      if (err) {
        return res.status(500).json(err);
      }

      res.json({ message: "Student updated successfully" });

    }
  );

};