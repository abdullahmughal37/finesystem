import React, { useState, useEffect } from "react";
import { api } from "@/config";
import { Outlet, NavLink, useNavigate } from "react-router";
import { useAuth } from "@/app/contexts/AuthContext";
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
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/issue-book", label: "Issue Book", icon: BookPlus },
  { to: "/return-book", label: "Return Book", icon: BookCheck },
  { to: "/fines", label: "Fines", icon: DollarSign },
  { to: "/reminder-emails", label: "Reminder Emails", icon: Bell },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [recentFines, setRecentFines] = useState<{ rollNo: string; fine_amount: number; created_at: string }[]>([]);
  const [settings, setSettings] = useState<{ universityName?: string; logoUrl?: string }>({});
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(api("/api/notifications/recent-fines"))
      .then((r) => r.json())
      .then((rows) => setRecentFines(rows || []))
      .catch(() => []);
  }, []);
  useEffect(() => {
    fetch(api("/api/settings"))
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

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

          {/* Search - disabled */}
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="Search (disabled)"
              disabled
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="flex-1" />

          {/* Notifications dropdown */}
          <div className="relative">
            <button
              onClick={() => { setNotifOpen(!notifOpen); setAdminOpen(false); }}
              className="relative w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
            >
              <Bell size={18} />
              {recentFines.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">Recent Fines</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {recentFines.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-gray-500">No recent fines</p>
                  ) : (
                    recentFines.map((f, i) => (
                      <div key={i} className="px-4 py-2 hover:bg-gray-50">
                        <p className="text-xs font-mono text-gray-600">{f.rollNo}</p>
                        <p className="text-xs text-gray-500">PKR {Number(f.fine_amount || 0).toLocaleString()} · {f.created_at ? new Date(f.created_at).toLocaleDateString() : ""}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin profile dropdown */}
          <div className="relative">
            <button
              onClick={() => { setAdminOpen(!adminOpen); setNotifOpen(false); }}
              className="flex items-center gap-3 pl-2 border-l border-gray-200"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                A
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-800 leading-tight">Admin</p>
                <p className="text-xs text-gray-400 leading-tight">Administrator</p>
              </div>
            </button>
            {adminOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
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
