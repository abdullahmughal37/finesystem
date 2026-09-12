import React, { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/config";
import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/app/contexts/AuthContext";
import { requestJson } from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BookPlus,
  BookCheck,
  DollarSign,
  BarChart3,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  UserRound,
  FileCheck2,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/issue-book", label: "Issue Book", icon: BookPlus },
  { to: "/return-book", label: "Return Book", icon: BookCheck },
  { to: "/fines", label: "Fines", icon: DollarSign },
  { to: "/clearance", label: "Clearance", icon: FileCheck2 },
  { to: "/reminder-emails", label: "Reminder Emails", icon: Bell },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [recentFines, setRecentFines] = useState<{ id: number; registrationNo: string; accessionNo: string; fineAmount: number; createdAt: string }[]>([]);
  const [settings, setSettings] = useState<{ universityName?: string; logoUrl?: string }>({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(() => {
    requestJson("/api/notifications/recent-fines")
      .then((rows) => setRecentFines(rows || []))
      .catch(() => []);
  }, []);
  useEffect(loadNotifications, [loadNotifications]);
  useEffect(() => {
    fetch(api("/api/settings"))
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!notifOpen && !adminOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (notifOpen && !notificationRef.current?.contains(target)) setNotifOpen(false);
      if (adminOpen && !adminRef.current?.contains(target)) setAdminOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setNotifOpen(false); setAdminOpen(false); }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notifOpen, adminOpen]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative z-50 h-full flex flex-col
          transition-all duration-300 ease-in-out
          ${collapsed ? "w-[72px]" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ background: "linear-gradient(180deg, #1F3A8A 0%, #162d6e 100%)" }}
      >
        {/* Logo area - dynamic from settings */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 min-h-[70px]">
          {settings.logoUrl ? (
            <img src={settings.logoUrl ? api(settings.logoUrl) : ""} alt="Logo" className="flex-shrink-0 w-10 h-10 rounded-lg object-contain bg-white/10" />
          ) : (
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-md">
              <span className="text-blue-800 font-bold text-sm">LM</span>
            </div>
          )}
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-white text-xs font-semibold leading-tight">{settings.universityName || "Library"}</p>
              <p className="text-blue-300 text-[10px] leading-tight">Library Management</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 mx-2 my-0.5 rounded-lg transition-all duration-150 group relative
                ${isActive
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-r-full" />
                  )}
                  <Icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{label}</span>}
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {label}
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/10 p-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white rounded-full shadow-md items-center justify-center text-blue-800 hover:bg-blue-50 transition-colors z-10"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-[70px] bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4 shadow-sm flex-shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex-1" />

          {/* Notifications dropdown */}
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notifOpen}
              aria-haspopup="dialog"
              onClick={() => { const opening = !notifOpen; setNotifOpen(opening); setAdminOpen(false); if (opening) loadNotifications(); }}
              className="relative w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <Bell size={18} />
              {recentFines.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
            {notifOpen && (
              <div role="dialog" aria-label="Recent notifications" className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">Recent Fines</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {recentFines.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-gray-500">No recent fines</p>
                  ) : (
                    recentFines.map((f) => (
                      <div key={f.id} className="px-4 py-2 hover:bg-gray-50">
                        <p className="text-xs font-mono text-gray-700">{f.registrationNo || "Unknown student"}</p>
                        <p className="text-xs text-gray-500">PKR {Number(f.fineAmount || 0).toLocaleString()} · {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : ""}</p>
                        {f.accessionNo && <p className="text-[11px] text-gray-400">Book: {f.accessionNo}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin profile dropdown */}
          <div className="relative" ref={adminRef}>
            <button
              type="button"
              aria-label="Administrator menu"
              aria-expanded={adminOpen}
              aria-haspopup="menu"
              onClick={() => { setAdminOpen(!adminOpen); setNotifOpen(false); }}
              className="flex items-center gap-3 pl-2 border-l border-gray-200"
            >
              {settings.logoUrl ? <img src={api(settings.logoUrl)} alt="Library logo" className="w-9 h-9 rounded-full border bg-white object-contain shadow-sm" /> : <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shadow-sm"><UserRound size={18} /></div>}
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name || "Administrator"}</p>
                <p className="text-xs text-gray-400 leading-tight">Administrator</p>
              </div>
            </button>
            {adminOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">{user?.name || "Administrator"}</p>
                  <p className="text-xs text-gray-500">{user?.email || "admin@cuisahiwal.edu.pk"}</p>
                  <p className="text-xs text-blue-600 mt-1">Role: Administrator</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
