import React from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./components/pages/Login";
import { Dashboard } from "./components/pages/Dashboard";
import { Students } from "./components/pages/Students";
import { Books } from "./components/pages/Books";
import { IssueBook } from "./components/pages/IssueBook";
import { ReturnBook } from "./components/pages/ReturnBook";
import { Fines } from "./components/pages/Fines";
import { Reports } from "./components/pages/Reports";
import { Settings } from "./components/pages/Settings";
import { ReminderEmails } from "./components/pages/ReminderEmails";
import { IssuedStudents } from "./components/pages/IssuedStudents";

function ProtectedLayout() {
  const token = localStorage.getItem("library_token");
  if (!token) return <Navigate to="/login" replace />;
  return <Layout />;
}

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "students", Component: Students },
      { path: "books", Component: Books },
      { path: "issue-book", Component: IssueBook },
      { path: "return-book", Component: ReturnBook },
      { path: "issued-students", Component: IssuedStudents},
      { path: "fines", Component: Fines },
      { path: "reports", Component: Reports },
      { path: "reminder-emails", Component: ReminderEmails },
      { path: "settings", Component: Settings },
    ],
  },
]);
