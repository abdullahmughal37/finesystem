require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api", require("./routes/issueBook"));
app.use("/api/books", require("./routes/books"));
app.use("/api/students", require("./routes/importStudents"));
app.use("/api", require("./routes/studentRoutes"));
app.use("/api/books", require("./routes/importBooks"));

app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/return", require("./routes/returnBook"));
app.use("/api/fines", require("./routes/fines"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/issued-students", require("./routes/issuedStudents"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/backup", require("./routes/backup"));
app.use("/api/reminders", require("./routes/reminders"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});