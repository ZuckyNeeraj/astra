import { createContext, useContext, useEffect, useState } from "react";
import {
  Home, Zap, GitBranch, MapPin, Shield, FolderOpen, CheckSquare, Mic,
  Bot, FileText, CreditCard, Building2, Bell, Star, Upload, Check, X,
  AlertCircle, ArrowRight, Stethoscope, CheckCircle2, Timer, RefreshCw,
  ShieldCheck, Receipt, Circle, Eye, Download, ChevronRight, Settings,
  User, TrendingUp, MoreHorizontal, Activity, Menu, LogOut,
  RotateCcw, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";

// ── Convex helpers ───────────────────────────────────────────────────────────

const ACTIVITY_KIND_COLOR: Record<string, string> = {
  info: "#0284C7", success: "#16A34A", warning: "#F59E0B", action: "#FF6B6B",
};

const SILENT_AI = {
  progressTeal: "#00E5FF",
  accentBlue: "#0284C7",
  slate: "#0B192C",
  background: "#F3F0EA",
  card: "#faf9f7",
  track: "#a7c3e7",
  coral: "#FF6B6B",
  statusBg: "#E0FBFD",
  statusText: "#006064",
};

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function timeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

type Screen =
  | "home" | "agents" | "timeline" | "hospitals"
  | "insurance" | "vault" | "approvals" | "voice";

const SidebarControlsContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
}>({
  collapsed: false,
  toggle: () => {},
});

// ── Primitives ──────────────────────────────────────────────────────────────

function CircularProgress({
  value,
  size = 96,
  stroke = 8,
  trackColor = SILENT_AI.track,
  color = SILENT_AI.progressTeal,
}: {
  value: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <filter id="pgGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" filter="url(#pgGlow)" style={{ transition: "stroke-dashoffset 1.2s ease" }}
      />
    </svg>
  );
}

function PulseDot({ color = "#0284C7", size = "sm" }: { color?: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-3 w-3" : "h-2 w-2";
  return (
    <span className={`relative flex flex-shrink-0 ${dim}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50`} style={{ backgroundColor: color }} />
      <span className={`relative inline-flex rounded-full ${dim}`} style={{ backgroundColor: color }} />
    </span>
  );
}

function StatusBadge({ status }: { status: "working" | "waiting" | "done" | "pending" }) {
  const c = {
    working: { label: "Working",  bg: SILENT_AI.statusBg, text: SILENT_AI.statusText },
    waiting: { label: "Waiting",  bg: "#FFFBEB", text: "#D97706" },
    done:    { label: "Done",     bg: "#F0FDF4", text: "#16A34A" },
    pending: { label: "Pending",  bg: "#F3F0EA", text: "#64748B" },
  }[status];
  return (
    <span className="text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-2xl font-medium text-[#0B192C]">{title}</h2>
        {subtitle && <p className="text-sm text-[#64748B] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: "home"      as Screen, icon: Home,       label: "Home",               group: "main"     },
  { id: "agents"    as Screen, icon: Zap,         label: "Live Agents",        group: "main"     },
  { id: "timeline"  as Screen, icon: GitBranch,   label: "Journey Timeline",   group: "main"     },
  { id: "hospitals" as Screen, icon: MapPin,      label: "Hospital Discovery", group: "journey"  },
  { id: "insurance" as Screen, icon: Shield,      label: "Insurance & Claims", group: "journey"  },
  { id: "vault"     as Screen, icon: FolderOpen,  label: "Document Vault",     group: "journey"  },
  { id: "approvals" as Screen, icon: CheckSquare, label: "Approval Center",    group: "journey"  },
  { id: "voice"     as Screen, icon: Mic,         label: "Voice Command",      group: "tools"    },
];

function Sidebar({
  screen,
  onNavigate,
  collapsed,
  onToggle,
}: {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const groups = [
    { key: "main",    label: "OVERVIEW"       },
    { key: "journey", label: "ACTIVE JOURNEY" },
    { key: "tools",   label: "TOOLS"          },
  ];

  return (
    <aside
      className="app-sidebar h-screen flex flex-col bg-[#faf9f7] border-r border-[rgba(15,23,42,0.07)] overflow-y-auto flex-shrink-0"
      data-collapsed={collapsed}
    >
      {/* Brand */}
      <div className="sidebar-header flex items-center gap-3 px-4 py-4 border-b border-[rgba(15,23,42,0.06)]">
        <div className="sidebar-logo w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: "#0B192C" }}>
          <span className="text-[#faf9f7] font-bold text-base" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>A</span>
        </div>
        <div className="sidebar-brand-copy min-w-0">
          <span className="sidebar-brand-text block font-bold text-[#0B192C] text-lg" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>astra</span>
          <div className="flex items-center gap-1.5 mt-1">
            <PulseDot size="sm" />
            <span className="sidebar-status-text text-sm text-[#64748B] font-medium">4 agents active</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="sidebar-collapse-btn ml-auto inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[rgba(15,23,42,0.08)] bg-[#faf9f7] text-[#0B192C] hover:bg-[#F3F0EA] transition"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-5">
        {groups.map((g) => {
          const items = NAV_ITEMS.filter((n) => n.group === g.key);
          return (
            <div key={g.key}>
              <p className="sidebar-section-label text-sm font-bold text-[#94A3B8] px-2 mb-2">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = screen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`sidebar-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left w-full ${
                        active
                          ? "bg-[#E0FBFD] text-[#0284C7]"
                          : "text-[#64748B] hover:bg-[#F3F0EA] hover:text-[#0B192C]"
                      }`}
                    >
                      <item.icon size={16} strokeWidth={active ? 2.5 : 1.75} />
                      <span className="sidebar-nav-label">{item.label}</span>
                      {item.id === "approvals" && (
                        <span className="sidebar-nav-badge ml-auto w-5 h-5 bg-[#FF6B6B] text-[#faf9f7] text-sm font-bold rounded-full flex items-center justify-center">1</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Inbox tools */}
      <div className="sidebar-scan-card px-3 pb-3">
        <ScanInboxButton variant="sidebar" />
      </div>

      {/* Journey widget */}
      <div className="sidebar-journey-card">
        <CurrentJourneyCard />
      </div>

      {/* User */}
      <div className="sidebar-user-card">
        <UserCard />
      </div>
    </aside>
  );
}

function CurrentJourneyCard() {
  const journeys = useQuery(api.journeys.listActive);
  const j = journeys?.[0];
  if (!j) return null;
  return (
    <div className="mx-3 mb-3 p-4 rounded-2xl bg-[#F3F0EA] border border-[rgba(15,23,42,0.06)]">
      <p className="text-sm font-bold text-[#94A3B8] mb-2">CURRENT JOURNEY</p>
      <p className="font-bold text-[#0B192C] text-sm">{j.title}</p>
      <p className="text-xs text-[#64748B] mb-3">{j.patientName} · {j.patientAge} yrs</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#a7c3e7] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${j.progress}%`, background: "linear-gradient(90deg,#0284C7,#0284C7)" }} />
        </div>
        <span className="text-sm font-bold text-[#0284C7]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>{j.progress}%</span>
      </div>
    </div>
  );
}

function UserCard() {
  const { signOut } = useAuthActions();
  const me = useQuery(api.users.current);
  const email = me?.email ?? "";
  const initial = (email[0] ?? "U").toUpperCase();

  return (
    <div className="px-4 py-4 border-t border-[rgba(15,23,42,0.06)] flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0284C7] to-[#0284C7] flex items-center justify-center flex-shrink-0">
        <span className="text-[#faf9f7] text-xs font-bold">{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0B192C] truncate">{email || "Signed in"}</p>
        <p className="text-sm text-[#94A3B8]">Patient Guardian</p>
      </div>
      <button
        onClick={() => void signOut()}
        title="Sign out"
        className="p-1.5 rounded-lg hover:bg-[#EEEAE2] transition"
      >
        <LogOut size={14} className="text-[#94A3B8]" />
      </button>
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function TopBar() {
  const { collapsed, toggle } = useContext(SidebarControlsContext);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(window.localStorage.getItem("astra-read-notifications") ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const journeys = useQuery(api.journeys.listActive);
  const journey = journeys?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("astra-read-notifications", JSON.stringify([...readNotifications]));
  }, [readNotifications]);

  const notificationItems = [
    ...(bundle?.approvals ?? [])
      .filter((approval) => approval.status === "pending")
      .map((approval) => ({
        id: `approval-${String(approval._id)}`,
        title: approval.title,
        detail: "Your approval is needed",
        tone: "action" as const,
      })),
    ...(bundle?.activity ?? [])
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4)
      .map((event) => ({
        id: `activity-${String(event._id)}`,
        title: event.message,
        detail: relativeTime(event.createdAt),
        tone: event.kind === "action" ? ("action" as const) : ("info" as const),
      })),
  ];
  const unreadCount = notificationItems.filter((item) => !readNotifications.has(item.id)).length;
  const markRead = (id: string) => setReadNotifications((current) => new Set(current).add(id));
  const markAllRead = () => setReadNotifications(new Set(notificationItems.map((item) => item.id)));

  return (
    <header className="responsive-topbar sticky top-0 z-20 bg-[#faf9f7] border-b border-[rgba(15,23,42,0.06)] px-8 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center min-w-0">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={!collapsed}
          className="sidebar-toggle-btn inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[rgba(15,23,42,0.08)] bg-[#faf9f7] text-[#0B192C] hover:bg-[#F3F0EA] transition"
        >
          <Menu size={18} />
        </button>
      </div>

      <div className="responsive-header-brand flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0284C7" }}>
          <span className="text-[#faf9f7] font-bold text-sm" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>A</span>
        </div>
        <span className="font-bold text-[#0B192C] text-lg" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
          astra
        </span>
      </div>

      <div className="responsive-topbar-actions relative flex items-center gap-3">
        <button
          type="button"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-label="Open notifications"
          aria-expanded={notificationsOpen}
          className="relative w-9 h-9 bg-[#faf9f7] border border-[rgba(15,23,42,0.08)] rounded-xl flex items-center justify-center hover:bg-[#EEEAE2] transition"
        >
          <Bell size={16} className="text-[#0B192C]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-2 h-2 bg-[#FF6B6B] rounded-full" />
          )}
        </button>
        {notificationsOpen && (
          <div className="scrollbar-none absolute right-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] max-h-[60dvh] overflow-y-auto rounded-2xl border border-[rgba(15,23,42,0.08)] bg-[#faf9f7] shadow-2xl p-3">
            <div className="flex items-center justify-between gap-3 px-1 pb-2">
              <div>
                <p className="text-sm font-medium text-[#0B192C]">Notifications</p>
                <p className="text-xs text-[#64748B]">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-[#0284C7] hover:text-[#0B192C] transition"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {notificationItems.length === 0 ? (
                <div className="rounded-xl bg-[#F3F0EA] px-3 py-4 text-sm text-[#64748B]">
                  No notifications yet.
                </div>
              ) : (
                notificationItems.map((item) => {
                  const unread = !readNotifications.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => markRead(item.id)}
                      className={`text-left rounded-xl border px-3 py-3 transition ${
                        unread
                          ? "border-[#FF6B6B]/30 bg-[#FFF7F7]"
                          : "border-[rgba(15,23,42,0.06)] bg-[#F3F0EA]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: unread ? (item.tone === "action" ? "#FF6B6B" : "#0284C7") : "#CBD5E1" }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-[#0B192C]">{item.title}</span>
                          <span className="block text-xs text-[#64748B] mt-1">{unread ? item.detail : "Read"}</span>
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function PageIntro({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-2xl font-medium text-[#0B192C]">{title}</h1>
      {subtitle && <p className="text-sm text-[#64748B] mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Screen 1: Home ──────────────────────────────────────────────────────────

const STAGE_ORDER = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];
const AGENT_COLORS = ["#0284C7", "#8B5CF6", "#0284C7", "#F59E0B", "#16A34A", "#64748B"];

function greetingName(me: { name?: string; email?: string } | null | undefined): string {
  const raw = me?.name || me?.email?.split("@")[0] || "";
  if (!raw) return "there";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function HomeScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const me = useQuery(api.users.current);
  const journeys = useQuery(api.journeys.listActive);
  const journey = journeys?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");

  const name = greetingName(me);
  const greeting = timeGreeting();
  const loading = journeys === undefined;

  // Still loading this user's journeys.
  if (loading) {
    return (
      <>
        <TopBar />
        <div className="p-8 flex flex-col gap-4">
          <PageIntro title={`${greeting}, ${name}`} />
          <p className="text-sm text-[#64748B]">Loading your journey…</p>
        </div>
      </>
    );
  }

  // No journey yet for this user — clean empty state, no demo data.
  if (!journey) {
    return (
      <>
        <TopBar />
        <div className="p-8 flex flex-col gap-6">
          <PageIntro title={`${greeting}, ${name}`} subtitle="Let's get your healthcare journey started." />
          <div className="bg-[#faf9f7] rounded-2xl border border-[rgba(15,23,42,0.06)] p-14 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#0284C7,#0284C7)" }}>
              <Stethoscope size={24} className="text-[#faf9f7]" />
            </div>
            <h2 className="text-xl font-medium text-[#0B192C]" style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }}>No active journey yet</h2>
            <p className="text-sm text-[#64748B] mt-1.5 max-w-md">
              When a health report arrives or you start a journey, Astra's agents begin
              coordinating hospitals, insurance, documents and claims — and it all shows up here.
            </p>
            <p className="text-sm text-[#94A3B8] mt-3">Use Scan inbox from the sidebar to check for health reports.</p>
          </div>
        </div>
      </>
    );
  }

  // ── Real, user-scoped data derived from the journey bundle ──────────────────
  const agents = bundle?.agents ?? [];
  const documents = bundle?.documents ?? [];
  const approvals = bundle?.approvals ?? [];
  const activity = (bundle?.activity ?? [])
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 6)
    .map((a) => ({
      text: a.message,
      time: relativeTime(a.createdAt),
      color: ACTIVITY_KIND_COLOR[a.kind] ?? "#0284C7",
    }));

  const activeIdx = Math.max(0, STAGE_ORDER.indexOf(journey.stage));
  const stages = STAGE_ORDER.map((label, i) => ({ label, done: i < activeIdx, active: i === activeIdx }));

  const docsMissing = documents.filter((d) => d.status === "missing").length;
  const approvalsPending = approvals.filter((a) => a.status === "pending").length;

  const hero = {
    title: journey.title,
    patient: `${journey.patientName} · ${journey.patientAge} yrs · ${journey.condition} · ${journey.policy}`,
    progress: journey.progress,
    stats: [
      { label: "Stage",       value: journey.stage },
      { label: "Est. Surgery", value: journey.estSurgeryDate ?? "TBD" },
      { label: "Coverage",    value: `${inr(journey.coverageLeftInr)} left` },
      { label: "Documents",   value: `${journey.documentsReady} of ${journey.documentsTotal} ready` },
    ],
  };

  return (
    <>
      <TopBar />

      <div className="p-8 flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <PageIntro title={`${greeting}, ${name}`} subtitle={`Here's where ${journey.patientName}'s healthcare journey stands today`} />
        </div>
        {/* Hero journey card */}
        <div className="rounded-2xl p-6 text-[#faf9f7] relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0B192C 0%,#12304D 58%,#006064 100%)" }}>
          <div className="absolute inset-0 opacity-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="absolute rounded-full border border-[#faf9f7]" style={{ width: 200 + i * 120, height: 200 + i * 120, top: "50%", right: -60 + i * -40, transform: "translateY(-50%)", opacity: 0.6 - i * 0.1 }} />
            ))}
          </div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <PulseDot color="#faf9f7" />
                <span className="text-xs font-bold opacity-80">ACTIVE JOURNEY</span>
              </div>
              <h2 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-3xl font-medium mb-1">{hero.title}</h2>
              <p className="opacity-75 text-sm mb-5">{hero.patient}</p>

              <div className="flex items-center gap-4 flex-wrap">
                {hero.stats.map((s) => (
                  <div key={s.label} className="bg-[#faf9f7]/10 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                    <p className="text-sm opacity-70 font-medium">{s.label}</p>
                    <p className="font-bold text-sm">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center ml-8 flex-shrink-0">
              <div className="relative">
                <CircularProgress
                  value={hero.progress}
                  size={120}
                  stroke={10}
                  trackColor={SILENT_AI.track}
                  color={SILENT_AI.progressTeal}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center rounded-full bg-[#faf9f7]/90 px-3 py-2 shadow-sm" style={{ color: SILENT_AI.slate }}>
                    <span className="text-3xl font-bold" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>{hero.progress}%</span>
                    <p className="text-xs opacity-70">complete</p>
                  </div>
                </div>
              </div>
              <button onClick={() => onNavigate("agents")} className="mt-3 flex items-center gap-1.5 bg-[#faf9f7]/20 hover:bg-[#faf9f7]/30 transition px-4 py-2 rounded-xl text-xs font-bold">
                View agents <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* 3-col grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {/* Timeline summary */}
          <div className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-[#0B192C] text-sm">Journey Stages</p>
              <button onClick={() => onNavigate("timeline")} className="text-xs text-[#0284C7] font-medium hover:underline flex items-center gap-1">
                Full view <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex flex-col">
              {stages.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      s.active ? "bg-[#0284C7]" : s.done ? "bg-[#0284C7]" : "bg-[#a7c3e7]"
                    }`}>
                      {s.done  && <Check size={9} className="text-[#faf9f7]" />}
                      {s.active && <div className="w-2 h-2 bg-[#faf9f7] rounded-full animate-pulse" />}
                    </div>
                    {i < stages.length - 1 && <div className={`w-0.5 h-4 ${s.done ? "bg-[#0284C7]" : "bg-[#a7c3e7]"}`} />}
                  </div>
                  <div className="flex items-start gap-2 flex-1 py-0.5">
                    <span className={`text-xs ${
                      s.active ? "font-bold text-[#0284C7]" :
                      s.done   ? "text-[#94A3B8] line-through" :
                                 "text-[#C4CEDB]"
                    }`}>{s.label}</span>
                    {s.active && <PulseDot />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI agents overview */}
          <div className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#0B192C] text-sm">AI Agents</p>
                <PulseDot />
              </div>
              <button onClick={() => onNavigate("agents")} className="text-xs text-[#0284C7] font-medium hover:underline flex items-center gap-1">
                All agents <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {agents.length === 0 && (
                <p className="text-xs text-[#94A3B8] py-2">No agents running yet.</p>
              )}
              {agents.map((a, idx) => {
                const color = AGENT_COLORS[idx % AGENT_COLORS.length];
                return (
                  <div key={a._id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
                      <Bot size={14} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-[#0B192C]">{a.name}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="h-1 bg-[#a7c3e7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.progress}%`, backgroundColor: color, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
            <p className="font-bold text-[#0B192C] text-sm mb-4">Quick Access</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { label: "Hospitals",  sub: "Discover",                     icon: Building2,   color: "#0284C7", screen: "hospitals"  as Screen },
                { label: "Documents",  sub: `${docsMissing} missing`,        icon: FileText,    color: "#F59E0B", screen: "vault"      as Screen },
                { label: "Insurance",  sub: `${inr(journey.coverageLeftInr)} left`, icon: Shield, color: "#0284C7", screen: "insurance"  as Screen },
                { label: "Approvals",  sub: `${approvalsPending} pending`,   icon: CheckSquare, color: "#8B5CF6", screen: "approvals"  as Screen },
              ] as const).map((item) => (
                <button
                  key={item.label}
                  onClick={() => onNavigate(item.screen)}
                  className="p-3 rounded-xl border border-[rgba(15,23,42,0.06)] text-left hover:shadow-sm hover:border-[rgba(15,23,42,0.12)] active:scale-95 transition-all"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${item.color}18` }}>
                    <item.icon size={14} style={{ color: item.color }} />
                  </div>
                  <p className="font-bold text-[#0B192C] text-xs">{item.label}</p>
                  <p className="text-sm text-[#64748B]">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-bold text-[#0B192C]">Live Activity Feed</p>
              <p className="text-xs text-[#64748B] mt-0.5">What your AI team has been doing</p>
            </div>
            <div className="flex items-center gap-2 bg-[#F0FDF4] rounded-xl px-3 py-1.5">
              <PulseDot color="#16A34A" />
              <span className="text-xs font-bold text-[#16A34A]">Live</span>
            </div>
          </div>
          {activity.length === 0 ? (
            <p className="text-xs text-[#94A3B8] py-2">No activity yet — your agents haven't started on this journey.</p>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {activity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#F3F0EA]">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: a.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#0B192C]">{a.text}</p>
                    <p className="text-sm text-[#94A3B8] mt-1">{a.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Screen 2: Agents ────────────────────────────────────────────────────────

function AgentsScreen() {
  const journey = useQuery(api.journeys.listActive)?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");

  const agentRows = bundle?.agents ?? [];
  const activityRows = (bundle?.activity ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);

  // Empty state — no journey started yet.
  if (!journey) {
    return (
      <>
        <TopBar />
        <div className="p-8 flex flex-col gap-6">
          <PageIntro title="Live Agent Activity" subtitle="Autonomous agents managing your healthcare journey" />
          <div className="bg-[#faf9f7] rounded-2xl p-12 border border-[rgba(15,23,42,0.06)] text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#E0FBFD] flex items-center justify-center mx-auto mb-4">
              <Zap size={22} className="text-[#0284C7]" />
            </div>
            <p className="font-bold text-[#0B192C]">No active journey yet</p>
            <p className="text-sm text-[#64748B] mt-1">Approve a health report on Home to deploy your agent team — their live steps, tokens and cost show up here.</p>
          </div>
        </div>
      </>
    );
  }

  // Per-agent: latest action message + step count, coloured by position.
  const agents = agentRows.map((a, idx) => {
    const mine = activityRows.filter((ev) => ev.agentName === a.name);
    return {
      name: a.name,
      role: a.role,
      status: a.status,
      progress: a.progress,
      color: AGENT_COLORS[idx % AGENT_COLORS.length],
      action: mine[0]?.message ?? "Standing by…",
      tasks: mine.length,
    };
  });

  // Live event stream from real activity rows.
  const events = activityRows.map((e) => {
    const i = agentRows.findIndex((a) => a.name === e.agentName);
    return {
      agent: e.agentName,
      text: e.message,
      time: relativeTime(e.createdAt),
      color: i >= 0 ? AGENT_COLORS[i % AGENT_COLORS.length] : (ACTIVITY_KIND_COLOR[e.kind] ?? "#0284C7"),
      tokens: e.tokens,
      costUsd: e.costUsd,
    };
  });

  // Rolled-up observability stats.
  const agentsActive = agentRows.filter((a) => a.status === "working").length;
  const tokensUsed = activityRows.reduce((s, e) => s + (e.tokens ?? 0), 0);
  const costUsd = activityRows.reduce((s, e) => s + (e.costUsd ?? 0), 0);
  const fmtCost = (n: number) => (n >= 0.01 || n === 0 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`);

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Live Agent Activity" subtitle={`${agentRows.length} agents · ${journey.title}`} />
        {/* Summary row */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Agents Active", value: String(agentsActive),               color: "#0284C7", bg: "#E0FBFD"  },
            { label: "Steps Logged",  value: String(activityRows.length),         color: "#16A34A", bg: "#F0FDF4"  },
            { label: "Tokens Used",   value: tokensUsed.toLocaleString("en-US"),  color: "#8B5CF6", bg: "#F5F3FF"  },
            { label: "Est. Cost",     value: fmtCost(costUsd),                    color: "#64748B", bg: "#F3F0EA"  },
          ].map((s) => (
            <div key={s.label} className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
              <p className="text-xs text-[#64748B] mb-1">{s.label}</p>
              <p className="text-3xl font-bold" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 360px" }}>
          {/* Agent cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {agents.map((agent) => (
              <div key={agent.name} className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${agent.color}18` }}>
                      <Bot size={18} style={{ color: agent.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#0B192C] text-sm">{agent.name}</p>
                      <p className="text-xs text-[#64748B]">{agent.role}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>

                <div className="bg-[#F3F0EA] rounded-xl p-3">
                  <p className="text-xs text-[#64748B]">{agent.action}</p>
                </div>

                <div className="flex items-center gap-3 mt-auto">
                  <div className="flex-1 h-1.5 bg-[#a7c3e7] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${agent.progress}%`, backgroundColor: agent.color }} />
                  </div>
                  <span className="text-sm font-bold text-[#94A3B8]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>{agent.tasks} steps</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live event stream */}
          <div className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-[#0B192C] text-sm">Event Stream</p>
                <p className="text-xs text-[#64748B]">Real-time agent actions</p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#F0FDF4] rounded-lg px-2 py-1">
                <PulseDot color="#16A34A" size="sm" />
                <span className="text-sm font-bold text-[#16A34A]">LIVE</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto flex-1">
              {events.length === 0 && (
                <p className="text-xs text-[#94A3B8]">No steps yet — agents haven't started on this journey.</p>
              )}
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-[rgba(15,23,42,0.04)] pb-3 last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: e.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold mb-0.5" style={{ color: e.color }}>{e.agent}</p>
                    <p className="text-xs text-[#0B192C]">{e.text}</p>
                    <p className="text-sm text-[#94A3B8] mt-0.5">
                      {e.time}
                      {typeof e.tokens === "number" ? ` · ${e.tokens.toLocaleString("en-US")} tok` : ""}
                      {typeof e.costUsd === "number" ? ` · ${fmtCost(e.costUsd)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Screen 3: Timeline ──────────────────────────────────────────────────────

function TimelineScreen() {
  const journey = useQuery(api.journeys.listActive)?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");
  const [selected, setSelected] = useState<number | null>(null);

  const stages: string[] = bundle?.plan?.stages ?? [];
  const currentIdx = Math.max(0, stages.findIndex((s) => s === journey?.stage));
  const statusFor = (i: number): "done" | "running" | "pending" =>
    i < currentIdx ? "done" : i === currentIdx ? "running" : "pending";
  const cfg = {
    done:    { dot: "#0284C7", label: "Completed" },
    running: { dot: "#0284C7", label: "In Progress" },
    pending: { dot: "#a7c3e7", label: "Upcoming" },
  };
  const activity = [...(bundle?.activity ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const selIdx = selected ?? currentIdx;
  const selLabel = stages[selIdx];

  if (!journey || stages.length === 0) {
    return (
      <>
        <TopBar />
        <div className="p-8">
          <PageIntro title="Journey Timeline" subtitle="No active journey yet" />
          <div className="bg-[#faf9f7] rounded-2xl p-10 border border-dashed border-[#CBD5E1] flex flex-col items-center text-center gap-2 mt-6">
            <div className="w-12 h-12 rounded-2xl bg-[#E0FBFD] flex items-center justify-center mb-1"><GitBranch size={22} className="text-[#0284C7]" /></div>
            <p className="font-bold text-[#0B192C]">No journey in progress</p>
            <p className="text-sm text-[#64748B] max-w-sm">Approve a treatment plan and the journey's real stages will appear here.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Journey Timeline" subtitle={`${journey.title} — ${journey.progress}% complete across ${stages.length} stages`} />
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 380px" }}>
          {/* Timeline */}
          <div className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
            <div className="flex flex-col">
              {stages.map((label, i) => {
                const status = statusFor(i);
                const c = cfg[status];
                const isSelected = selIdx === i;
                return (
                  <button key={i} className="flex gap-5 text-left group" onClick={() => setSelected(i)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ring-2 transition-all ${isSelected ? "ring-[#0284C7] ring-offset-2" : "ring-transparent"}`} style={{ backgroundColor: c.dot }}>
                        {status === "done"    && <Check size={12} className="text-[#faf9f7]" />}
                        {status === "running" && <div className="w-2.5 h-2.5 bg-[#faf9f7] rounded-full animate-pulse" />}
                        {status === "pending" && <div className="w-2.5 h-2.5 bg-[#94A3B8] rounded-full" />}
                      </div>
                      {i < stages.length - 1 && <div className="w-0.5 flex-1 min-h-[32px]" style={{ backgroundColor: status === "done" ? "#0284C7" : "#a7c3e7" }} />}
                    </div>

                    <div className={`flex-1 pb-6 px-4 py-2 rounded-xl mb-1 transition-all ${isSelected ? "bg-[#F3F0EA] border border-[rgba(15,23,42,0.06)]" : "hover:bg-[#F3F0EA]/50"}`}>
                      <span className="text-sm font-bold" style={{ color: c.dot }}>{c.label}</span>
                      <p className="font-bold text-[#0B192C]">{label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel — real agent activity */}
          <div className="flex flex-col gap-4">
            <div className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
              <span className="text-sm font-bold" style={{ color: cfg[statusFor(selIdx)].dot }}>{cfg[statusFor(selIdx)].label}</span>
              <h3 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-xl font-medium text-[#0B192C] mb-1">{selLabel}</h3>
              <p className="text-sm text-[#64748B] mb-4">Live activity logged by the agents</p>

              <div className="flex flex-col gap-2">
                {activity.length === 0 && <p className="text-sm text-[#94A3B8]">No activity logged yet.</p>}
                {activity.slice(0, 8).map((ev) => (
                  <div key={ev._id} className="flex items-start gap-3 p-3 rounded-xl bg-[#F3F0EA]">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#E0FBFD]">
                      <Activity size={10} className="text-[#0284C7]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#0B192C]">{ev.message}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">{ev.agentName} · {new Date(ev.createdAt).toLocaleTimeString("en-IN")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Screen 4: Hospitals ─────────────────────────────────────────────────────

// INR like ₹3,00,000, or "—" when absent (null-safe wrapper around inr()).
function inrOr(n?: number | null) {
  return n === undefined || n === null || !isFinite(n) ? "—" : inr(n);
}

function HospitalsScreen() {
  const [selected, setSelected] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);

  const me = useQuery(api.users.current);
  const journey = useQuery(api.journeys.listActive)?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");
  const setLocation = useMutation(api.users.setLocation);

  const loc = me?.location ?? null;
  const cityLabel = loc?.city ? [loc.city, loc.region].filter(Boolean).join(", ") : null;
  const hospitals = bundle?.hospitals ?? [];
  const sel = hospitals[selected] ?? hospitals[0];

  async function useMyLocation() {
    setLocErr(null);
    if (!navigator.geolocation) { setLocErr("Location isn't available in this browser."); return; }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
      const { latitude, longitude } = pos.coords;
      let city: string | undefined, region: string | undefined, country: string | undefined;
      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
        const g = await r.json();
        city = g.city || g.locality || undefined;
        region = g.principalSubdivision || undefined;
        country = g.countryName || undefined;
      } catch { /* keep coords even if reverse-geocode fails */ }
      await setLocation({ city, region, country, lat: latitude, lng: longitude });
    } catch {
      setLocErr("Couldn't read your location — please allow location access and retry.");
    } finally {
      setLocating(false);
    }
  }

  const LocationButton = (
    <button onClick={() => void useMyLocation()} disabled={locating}
      className="flex items-center gap-1.5 text-sm font-bold px-3.5 py-2 rounded-xl bg-[#0284C7] text-[#faf9f7] hover:bg-[#0B192C] transition disabled:opacity-60">
      <MapPin size={13} /> {locating ? "Locating…" : cityLabel ? "Update location" : "Use my location"}
    </button>
  );

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Hospital Discovery"
          subtitle={journey ? `Hospitals for ${journey.patientName}'s ${journey.condition}` : "Hospitals matched by the Hospital Agent"} />

        {/* Location bar */}
        <div className="flex items-center gap-3 bg-[#faf9f7] rounded-2xl px-5 py-3.5 border border-[rgba(15,23,42,0.06)]">
          <div className="w-9 h-9 rounded-xl bg-[#E0FBFD] flex items-center justify-center">
            <MapPin size={16} className="text-[#0284C7]" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-[#0B192C] text-sm">Searching near {cityLabel ?? "— location not set"}</p>
            <p className="text-[11px] text-[#64748B]">{cityLabel ? "The Hospital Agent uses your current location" : "Share your location so the agent searches hospitals near you"}</p>
          </div>
          {LocationButton}
        </div>
        {locErr && <p className="text-xs text-[#EF4444] -mt-3">{locErr}</p>}

        {hospitals.length === 0 ? (
          <div className="bg-[#faf9f7] rounded-2xl p-10 border border-dashed border-[#CBD5E1] flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#E0FBFD] flex items-center justify-center mb-1">
              <Building2 size={22} className="text-[#0284C7]" />
            </div>
            <p className="font-bold text-[#0B192C]">No hospitals yet</p>
            <p className="text-sm text-[#64748B] max-w-sm">
              {journey ? "The Hospital Agent will list real hospitals here once the journey runs." : "Start a journey, then the Hospital Agent will search hospitals near you."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 380px" }}>
            {/* Hospital list */}
            <div className="flex flex-col gap-3">
              {hospitals.map((h, i) => (
                <button key={h._id} onClick={() => setSelected(i)}
                  className={`bg-[#faf9f7] rounded-2xl p-4 border text-left transition-all ${selected === i ? "border-[#0284C7] shadow-md" : "border-[rgba(15,23,42,0.06)] hover:shadow-sm"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-[#0B192C]">{h.name}</h3>
                      {h.recommended && <span className="text-sm font-bold bg-[#F0FDF4] text-[#16A34A] px-2 py-0.5 rounded-full">RECOMMENDED</span>}
                    </div>
                    {h.rating != null && (
                      <div className="flex items-center gap-1.5">
                        <Star size={12} className="text-[#F59E0B] fill-[#F59E0B]" />
                        <span className="font-bold text-[#0B192C] text-sm">{h.rating}</span>
                      </div>
                    )}
                  </div>
                  {h.area && <p className="text-xs text-[#0284C7] font-medium mb-3">{h.area}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F3F0EA] rounded-xl p-2">
                      <p className="text-sm text-[#64748B] mb-0.5">Est. cost</p>
                      <p className="text-xs font-bold text-[#0B192C]">{inrOr(h.estCostInr)}</p>
                    </div>
                    <div className="bg-[#F3F0EA] rounded-xl p-2">
                      <p className="text-sm text-[#64748B] mb-0.5">Coverage</p>
                      <p className="text-xs font-bold text-[#0B192C] truncate">{h.coverageNote ?? "—"}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail sidebar */}
            {sel && (
              <div className="flex flex-col gap-4">
                <div className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <h3 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-xl font-medium text-[#0B192C]">{sel.name}</h3>
                    {sel.recommended && <span className="text-sm font-bold bg-[#F0FDF4] text-[#16A34A] px-2.5 py-1 rounded-full whitespace-nowrap">TOP PICK</span>}
                  </div>
                  {sel.area && <p className="text-sm text-[#64748B] mb-5">{sel.area}</p>}

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-[#F3F0EA] rounded-xl p-3">
                      <p className="text-sm text-[#64748B] mb-0.5">Est. cost</p>
                      <p className="font-bold text-[#0284C7]">{inrOr(sel.estCostInr)}</p>
                    </div>
                    {sel.rating != null && (
                      <div className="bg-[#F3F0EA] rounded-xl p-3">
                        <p className="text-sm text-[#64748B] mb-0.5">Rating</p>
                        <p className="font-bold text-[#F59E0B]">{sel.rating} / 5.0</p>
                      </div>
                    )}
                    {sel.distanceKm != null && (
                      <div className="bg-[#F3F0EA] rounded-xl p-3">
                        <p className="text-sm text-[#64748B] mb-0.5">Distance</p>
                        <p className="font-bold text-[#0284C7]">{sel.distanceKm} km</p>
                      </div>
                    )}
                  </div>

                  {sel.coverageNote && (
                    <div className="mb-5">
                      <p className="text-xs text-[#64748B] mb-1.5">Insurance coverage</p>
                      <p className="font-medium text-[#0B192C] text-sm">{sel.coverageNote}</p>
                    </div>
                  )}
                  {sel.why && (
                    <div className="mb-5">
                      <p className="text-xs text-[#64748B] mb-1.5">Why the agent picked this</p>
                      <p className="font-medium text-[#0B192C] text-sm">{sel.why}</p>
                    </div>
                  )}
                  {sel.source && (
                    <a href={sel.source} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0284C7] hover:underline">
                      <ArrowRight size={13} /> Source
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Screen 5: Insurance ─────────────────────────────────────────────────────

function InsuranceScreen() {
  const journey = useQuery(api.journeys.listActive)?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");
  const vault = useQuery(api.vault.list);

  // Real policy comes from the parsed insurance document in the vault.
  const policy = (vault ?? []).find((v: any) => v.docKind === "insurance_policy");
  const pf: Record<string, string> = policy?.extractedFields ?? {};
  const num = (s?: string) => { const n = s ? Number(String(s).replace(/[^\d.]/g, "")) : NaN; return isFinite(n) ? n : undefined; };

  const sumInsured = num(pf.sumInsuredInr);
  const remaining = journey?.coverageLeftInr ?? sumInsured;
  const used = sumInsured != null && remaining != null ? Math.max(0, sumInsured - remaining) : undefined;
  const usedPct = sumInsured && used != null ? Math.round((used / sumInsured) * 100) : undefined;
  const estCost = bundle?.plan?.estCostInr;
  const oop = estCost != null && remaining != null ? Math.max(0, estCost - remaining) : undefined;

  const COLORS = ["#0284C7", "#a7c3e7"];
  const coverageData = sumInsured != null && used != null
    ? [{ name: "Used", value: used }, { name: "Remaining", value: Math.max(0, sumInsured - used) }]
    : null;

  const insuranceActivity = [...(bundle?.activity ?? [])]
    .filter((a) => a.agentName.toLowerCase().includes("insurance"))
    .sort((a, b) => b.createdAt - a.createdAt);

  const insurerLabel = pf.insurer
    ? `${pf.insurer}${pf.policyNumber ? ` · Policy ${pf.policyNumber}` : ""}`
    : "No insurance policy parsed yet — upload one in the Vault";

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Insurance & Claims" subtitle={insurerLabel} />

        <div className="grid gap-6" style={{ gridTemplateColumns: "300px 1fr" }}>
          {/* Coverage donut */}
          <div className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)] flex flex-col items-center">
            <p className="font-bold text-[#0B192C] text-sm mb-4 self-start">Coverage</p>
            {coverageData ? (
              <>
                <div className="relative">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={coverageData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        {coverageData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-2xl font-bold text-[#0B192C]">{usedPct ?? 0}%</span>
                    <span className="text-xs text-[#64748B]">used</span>
                  </div>
                </div>
                <div className="w-full mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-[#0284C7]" /><span className="text-[#64748B]">Used</span></div>
                    <span className="font-bold text-[#0B192C]">{inrOr(used)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-[#a7c3e7]" /><span className="text-[#64748B]">Remaining</span></div>
                    <span className="font-bold text-[#0B192C]">{inrOr(remaining)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-[#94A3B8] py-10 text-center">Upload your insurance policy in the Vault — the Health Vault agent will read the sum insured and it'll show here.</p>
            )}
          </div>

          {/* Stats + insurance agent activity */}
          <div className="flex flex-col gap-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[
                { label: "Sum Insured",       value: inrOr(sumInsured),  color: "#0284C7" },
                { label: "Procedure Estimate", value: inrOr(estCost),    color: "#0284C7" },
                { label: "Est. Out-of-Pocket", value: inrOr(oop),        color: "#8B5CF6" },
              ].map((s) => (
                <div key={s.label} className="bg-[#faf9f7] rounded-2xl p-4 border border-[rgba(15,23,42,0.06)]">
                  <p className="text-xs text-[#64748B] mb-1">{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex-1">
              <p className="font-bold text-[#0B192C] text-sm mb-4">Insurance Agent Activity</p>
              {insuranceActivity.length === 0 ? (
                <p className="text-sm text-[#94A3B8]">The Insurance Agent hasn't run on this journey yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {insuranceActivity.slice(0, 5).map((ev) => (
                    <div key={ev._id} className="flex items-start gap-3 p-3 rounded-xl bg-[#F3F0EA]">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#E0FBFD]"><Shield size={10} className="text-[#0284C7]" /></div>
                      <div className="min-w-0">
                        <p className="text-sm text-[#0B192C]">{ev.message}</p>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{new Date(ev.createdAt).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {bundle?.plan?.coverageNote && (
                <div className="bg-[#E0FBFD] rounded-xl p-3 mt-4">
                  <p className="text-xs font-bold text-[#0284C7]">Coverage note</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{bundle.plan.coverageNote}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Claims filed by the Claim Agent */}
        {(bundle?.claims?.length ?? 0) > 0 && (
          <div className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
            <p className="font-bold text-[#0B192C] text-sm mb-4">Claims filed</p>
            <div className="flex flex-col gap-3">
              {[...(bundle?.claims ?? [])].sort((a, b) => b.createdAt - a.createdAt).map((c) => {
                const emailBadge = c.emailStatus === "sent"
                  ? { t: "EMAIL SENT", cls: "bg-[#F0FDF4] text-[#16A34A]" }
                  : c.emailStatus === "failed"
                  ? { t: "EMAIL FAILED", cls: "bg-[#FEF2F2] text-[#FF6B6B]" }
                  : { t: "RECORDED", cls: "bg-[#FFFBEB] text-[#D97706]" };
                return (
                  <div key={c._id} className="rounded-xl border border-[rgba(15,23,42,0.06)] p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-[#0B192C] text-sm">{c.hospitalName ?? "Claim"} · {inrOr(c.amountInr)}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest ${emailBadge.cls}`}>{emailBadge.t}</span>
                    </div>
                    {c.summary && <p className="text-xs text-[#64748B] mb-2">{c.summary}</p>}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#94A3B8] font-mono">
                      {c.toEmail && <span>to {c.toEmail}</span>}
                      {c.employerPortalRef && <span>employer ref {c.employerPortalRef}</span>}
                      <span>{new Date(c.createdAt).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Screen 6: Vault ─────────────────────────────────────────────────────────

// The must-have documents for the demo journey.
const REQUIRED_DOCS = [
  { label: "Insurance Policy",      type: "Insurance",     category: "insurance", icon: Shield,      color: "#0284C7" },
  { label: "Aadhaar Card",          type: "Government ID", category: "identity",  icon: ShieldCheck, color: "#8B5CF6" },
  { label: "PAN Card",              type: "Government ID", category: "identity",  icon: CreditCard,  color: "#0284C7" },
  { label: "Doctor's Prescription", type: "Prescription",  category: "medical",   icon: Stethoscope, color: "#F59E0B" },
];

// Pretty labels for what the Health Vault agent classified a document as.
const DOC_KIND_LABEL: Record<string, string> = {
  insurance_policy: "Insurance policy",
  medical_report: "Medical report",
  prescription: "Prescription",
  id: "Government ID",
  other: "Document",
};

// The Health Vault agent's read-out for one uploaded file: a status chip, the
// one-line summary, and a couple of the key fields it extracted.
function ParseReadout({ item }: { item: any }) {
  const status: string = item.parseStatus ?? (item.storageId ? "pending" : "none");
  if (status === "none") return null;

  if (status === "pending") {
    return (
      <div className="mt-3 pt-3 border-t border-[rgba(15,23,42,0.06)] flex items-center gap-1.5 text-[11px] text-[#64748B]">
        <RefreshCw size={11} className="animate-spin text-[#0EA5E9]" /> Health Vault agent is reading this…
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="mt-3 pt-3 border-t border-[rgba(15,23,42,0.06)] flex items-center gap-1.5 text-[11px] text-[#EF4444]">
        <AlertCircle size={11} /> Couldn't read this automatically
      </div>
    );
  }

  // parsed
  const fields: Record<string, string> = item.extractedFields ?? {};
  const shown = Object.entries(fields).slice(0, 4);
  return (
    <div className="mt-3 pt-3 border-t border-[rgba(15,23,42,0.06)] flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black bg-[#DCFCE7] text-[#16A34A] px-2 py-0.5 rounded-full tracking-widest">READ</span>
        {item.docKind && (
          <span className="text-[10px] font-bold text-[#0EA5E9]">{DOC_KIND_LABEL[item.docKind] ?? "Document"}</span>
        )}
      </div>
      {item.extractedSummary && (
        <p className="text-[11px] text-[#475569] leading-snug">{item.extractedSummary}</p>
      )}
      {shown.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {shown.map(([k, val]) => (
            <div key={k} className="flex gap-1.5 text-[10px]">
              <span className="text-[#94A3B8] capitalize font-mono">{k.replace(/([A-Z])/g, " $1").trim()}:</span>
              <span className="text-[#334155] font-semibold truncate">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VaultScreen() {
  const items = useQuery(api.vault.list);
  const generateUploadUrl = useMutation(api.vault.generateUploadUrl);
  const save = useMutation(api.vault.save);
  const remove = useMutation(api.vault.remove);
  const parseVault = useAction(api.vaultAgent.parseMyVault);
  const [uploading, setUploading] = useState<string | null>(null);
  const [reparsing, setReparsing] = useState(false);

  async function reparseAll() {
    setReparsing(true);
    try {
      await parseVault({ force: true });
    } finally {
      setReparsing(false);
    }
  }

  const byLabel = new Map((items ?? []).map((i) => [i.label, i] as const));
  const uploadedCount = REQUIRED_DOCS.filter((d) => byLabel.has(d.label)).length;
  const extras = (items ?? []).filter((i) => !REQUIRED_DOCS.some((d) => d.label === i.label));

  async function upload(file: File, doc: { label: string; category: string }) {
    setUploading(doc.label);
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const { storageId } = await res.json();
      await save({ category: doc.category, label: doc.label, storageId });
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Document Vault" subtitle={`${uploadedCount} of ${REQUIRED_DOCS.length} required documents uploaded`} />

        {/* Health Vault agent toolbar */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3.5 border border-[rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
              <Bot size={16} className="text-[#0EA5E9]" />
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-sm">Health Vault Agent</p>
              <p className="text-[11px] text-[#64748B]">Reads every uploaded file and extracts the key facts</p>
            </div>
          </div>
          <button onClick={() => void reparseAll()} disabled={reparsing}
            className="flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-lg bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0] transition disabled:opacity-60">
            <RefreshCw size={12} className={reparsing ? "animate-spin" : ""} /> {reparsing ? "Reading…" : "Re-read all"}
          </button>
        </div>

        {/* Required documents */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {REQUIRED_DOCS.map((doc) => {
            const item = byLabel.get(doc.label);
            const ok = !!item;
            const isUp = uploading === doc.label;
            return (
              <div key={doc.label} className={`bg-[#faf9f7] rounded-2xl p-5 border flex flex-col ${ok ? "border-[rgba(15,23,42,0.06)]" : "border-[#FCA5A5] bg-[#FFF8F8]"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${doc.color}18` }}>
                    <doc.icon size={18} style={{ color: doc.color }} />
                  </div>
                  {ok ? (
                    <div className="flex gap-1.5">
                      {item!.url && (
                        <a href={item!.url} target="_blank" rel="noreferrer" title="View" className="w-8 h-8 bg-[#EEEAE2] rounded-xl flex items-center justify-center hover:bg-[#a7c3e7] transition">
                          <Eye size={13} className="text-[#64748B]" />
                        </a>
                      )}
                      <button onClick={() => void remove({ id: item!._id })} title="Remove" className="w-8 h-8 bg-[#EEEAE2] rounded-xl flex items-center justify-center hover:bg-[#FEE2E2] transition">
                        <X size={13} className="text-[#64748B]" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-bold bg-[#FEE2E2] text-[#FF6B6B] px-2 py-0.5 rounded-full">MISSING</span>
                  )}
                </div>
                <p className="font-bold text-[#0B192C] text-sm mb-0.5">{doc.label}</p>
                <p className="text-xs text-[#64748B] mb-4">{doc.type}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm text-[#94A3B8]">{ok ? "Uploaded" : "Not uploaded"}</span>
                  <label className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg cursor-pointer transition ${ok ? "bg-[#EEEAE2] text-[#64748B] hover:bg-[#a7c3e7]" : "bg-[#0284C7] text-[#faf9f7] hover:bg-[#0B192C]"}`}>
                    <Upload size={11} /> {isUp ? "Uploading…" : ok ? "Replace" : "Upload"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={isUp}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, doc); e.target.value = ""; }} />
                  </label>
                </div>
                {item && <ParseReadout item={item} />}
              </div>
            );
          })}
        </div>

        {/* Other uploaded documents */}
        {extras.length > 0 && (
          <div>
            <p className="font-bold text-[#0B192C] text-sm mb-3">Other documents</p>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {extras.map((item) => (
                <div key={item._id} className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#64748B18" }}>
                      <FileText size={18} style={{ color: "#64748B" }} />
                    </div>
                    <div className="flex gap-1.5">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" title="View" className="w-8 h-8 bg-[#EEEAE2] rounded-xl flex items-center justify-center hover:bg-[#a7c3e7] transition">
                          <Eye size={13} className="text-[#64748B]" />
                        </a>
                      )}
                      <button onClick={() => void remove({ id: item._id })} title="Remove" className="w-8 h-8 bg-[#EEEAE2] rounded-xl flex items-center justify-center hover:bg-[#FEE2E2] transition">
                        <X size={13} className="text-[#64748B]" />
                      </button>
                    </div>
                  </div>
                  <p className="font-bold text-[#0B192C] text-sm mb-0.5 truncate">{item.label}</p>
                  <p className="text-xs text-[#64748B] capitalize">{item.category}</p>
                  <ParseReadout item={item} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload any other document */}
        <label className="flex items-center justify-center gap-3 w-full py-6 border-2 border-dashed border-[#CBD5E1] rounded-2xl text-[#64748B] font-medium hover:border-[#0284C7] hover:text-[#0284C7] hover:bg-[#E0FBFD] transition-all group cursor-pointer">
          <div className="w-10 h-10 bg-[#EEEAE2] group-hover:bg-[#DBEAFE] rounded-xl flex items-center justify-center transition-colors">
            <Upload size={18} className="text-[#64748B] group-hover:text-[#0284C7] transition-colors" />
          </div>
          <div className="text-left">
            <p className="font-bold">Upload another document</p>
            <p className="text-xs text-[#94A3B8] font-normal">PDF, JPG, PNG up to 20 MB</p>
          </div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, { label: f.name, category: "other" }); e.target.value = ""; }} />
        </label>
      </div>
    </>
  );
}

// ── Screen 7: Approvals ─────────────────────────────────────────────────────

function ApprovalsScreen() {
  const journey = useQuery(api.journeys.listActive)?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");
  const decide = useMutation(api.approvals.decide);
  const [busy, setBusy] = useState<string | null>(null);

  const all = bundle?.approvals ?? [];
  const pending = all.filter((a) => a.status === "pending");
  const history = all.filter((a) => a.status !== "pending").sort((x, y) => y.createdAt - x.createdAt);
  const remaining = pending.length;

  async function act(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try { await decide({ id: id as any, status }); } finally { setBusy(null); }
  }

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Approval Center" subtitle={remaining > 0 ? `Your decision needed on ${remaining} item${remaining !== 1 ? "s" : ""}` : "All approvals handled"} />
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 360px" }}>
          {/* Approval cards */}
          <div className="flex flex-col gap-4">
            {pending.length === 0 && (
              <div className="bg-[#faf9f7] rounded-2xl p-10 border border-dashed border-[#CBD5E1] flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-[#F0FDF4] flex items-center justify-center mb-1">
                  <CheckCircle2 size={22} className="text-[#16A34A]" />
                </div>
                <p className="font-bold text-[#0B192C]">Nothing needs your approval</p>
                <p className="text-sm text-[#64748B] max-w-sm">When an agent needs a human decision, it'll appear here.</p>
              </div>
            )}
            {pending.map((a) => (
              <div key={a._id} className="bg-[#faf9f7] rounded-2xl p-6 border border-[rgba(15,23,42,0.06)] transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FFFBEB] text-[#D97706]">AWAITING DECISION</span>
                  <span className="text-xs text-[#94A3B8] font-medium">{new Date(a.createdAt).toLocaleString("en-IN")}</span>
                </div>

                <h3 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-xl font-medium text-[#0B192C] mb-2">{a.title}</h3>
                <p className="text-sm text-[#64748B] mb-5">{a.detail}</p>

                <div className="flex gap-3">
                  <button onClick={() => void act(a._id, "approved")} disabled={busy === a._id}
                    className="flex-1 py-3 rounded-xl font-bold text-[#faf9f7] text-sm transition-all active:scale-95 hover:opacity-90 bg-[#0284C7] disabled:opacity-60">
                    {busy === a._id ? "Saving…" : "Approve"}
                  </button>
                  <button onClick={() => void act(a._id, "rejected")} disabled={busy === a._id}
                    className="px-6 py-3 rounded-xl font-bold text-sm text-[#64748B] bg-[#EEEAE2] hover:bg-[#a7c3e7] transition disabled:opacity-60">
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* History panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
              <p className="font-bold text-[#0B192C] text-sm mb-4">Decision History</p>
              {history.length === 0 ? (
                <p className="text-sm text-[#94A3B8] py-2">No decisions yet.</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {history.map((d) => (
                    <div key={d._id} className="flex items-center gap-3 py-3 border-b border-[rgba(15,23,42,0.04)] last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${d.status === "approved" ? "bg-[#F0FDF4]" : "bg-[#FEF2F2]"}`}>
                        {d.status === "approved" ? <Check size={13} className="text-[#16A34A]" /> : <X size={13} className="text-[#FF6B6B]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0B192C]">{d.title}</p>
                        <p className="text-sm text-[#94A3B8] mt-0.5">{new Date(d.createdAt).toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#F3F0EA] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
              <p className="text-xs font-bold text-[#64748B] mb-3">HOW THIS WORKS</p>
              <div className="flex flex-col gap-3">
                {[
                  { icon: Zap,    text: "Agents work 24/7 without your input"  },
                  { icon: Bell,   text: "You're only asked when your decision matters" },
                  { icon: Shield, text: "All approvals are logged and auditable" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-[#E0FBFD] rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon size={13} className="text-[#0284C7]" />
                    </div>
                    <p className="text-xs text-[#64748B]">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Screen 8: Voice ─────────────────────────────────────────────────────────

function VoiceScreen() {
  const journey = useQuery(api.journeys.listActive)?.[0];
  const bundle = useQuery(api.journeys.get, journey ? { id: journey._id } : "skip");
  const notifications = [...(bundle?.notifications ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const latest = notifications[0];

  return (
    <>
      <TopBar />
      <div className="p-8 flex flex-col gap-6">
        <PageIntro title="Voice Updates" subtitle="Spoken updates your Notification Agent sends the family — generated with ElevenLabs" />
        <div className="grid gap-8" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Left: latest spoken update */}
          <div className="bg-[#faf9f7] rounded-3xl border border-[rgba(15,23,42,0.06)] flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-8 ${latest?.audioUrl ? "bg-[#0284C7]" : "bg-[#0B192C]"}`}>
              <Mic size={44} className="text-[#faf9f7]" />
            </div>
            {latest ? (
              <>
                <h2 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-2xl font-medium text-[#0B192C] mb-3">Latest update</h2>
                <p className="text-[#64748B] mb-6 max-w-md">{latest.text}</p>
                {latest.audioUrl ? (
                  <audio controls src={latest.audioUrl} className="w-full max-w-sm" />
                ) : (
                  <p className="text-xs text-[#94A3B8]">Voice not generated (set <span className="font-mono">ELEVENLABS_API_KEY</span> to hear it spoken).</p>
                )}
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }} className="text-2xl font-medium text-[#0B192C] mb-2">No updates yet</h2>
                <p className="text-[#64748B] max-w-md">When the Notification Agent runs, it speaks a warm update for the family here.</p>
              </>
            )}
          </div>

          {/* Right: history of spoken updates */}
          <div className="flex flex-col gap-4">
            <p className="font-bold text-[#0B192C]">All updates</p>
            {notifications.length === 0 && (
              <div className="bg-[#faf9f7] rounded-2xl p-6 border border-dashed border-[#CBD5E1] text-sm text-[#64748B]">
                Nothing yet — spoken updates from the Notification Agent will appear here.
              </div>
            )}
            {notifications.map((n) => (
              <div key={n._id} className="bg-[#faf9f7] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest ${n.voiceStatus === "spoken" ? "bg-[#F0FDF4] text-[#16A34A]" : n.voiceStatus === "failed" ? "bg-[#FEF2F2] text-[#FF6B6B]" : "bg-[#FFFBEB] text-[#D97706]"}`}>
                    {n.voiceStatus === "spoken" ? "SPOKEN" : n.voiceStatus === "failed" ? "VOICE FAILED" : "TEXT ONLY"}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] font-mono">{new Date(n.createdAt).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-sm text-[#0B192C] mb-3">{n.text}</p>
                {n.audioUrl && <audio controls src={n.audioUrl} className="w-full" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────

// "Scan inbox" — pulls every email from the last 30 days whose subject starts
// with "Health Report" (Gmail); each becomes a candidate journey to choose from.
function ScanInboxButton({ variant = "solid" }: { variant?: "solid" | "ghost" | "sidebar" }) {
  const scan = useAction(api.inbox.scanInbox);
  const resetDemo = useMutation(api.inbox.resetDemoData);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await scan();
      if (res.status === "no_gmail") setMsg("Connect Gmail first — set the GMAIL_* env vars.");
      else if (res.status === "auth_failed") setMsg("Gmail auth failed — check the credentials.");
      else if (res.status === "unauthenticated") setMsg("Please sign in again.");
      else if (res.status === "ok") setMsg(res.count ? `Found ${res.count} new report${res.count > 1 ? "s" : ""}.` : "No new health reports in the last 30 days.");
      else setMsg(res.status);
    } catch {
      setMsg("Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setResetting(true);
    setMsg(null);
    try {
      await resetDemo();
      setMsg("Demo data reset — scan again to re-surface candidates.");
    } catch {
      setMsg("Reset failed.");
    } finally {
      setResetting(false);
    }
  }

  const cls =
    variant === "solid"
      ? "bg-[#0284C7] text-[#faf9f7] hover:bg-[#0B192C]"
      : variant === "sidebar"
        ? "bg-[#0B192C] text-[#faf9f7] hover:bg-[#0284C7]"
        : "bg-[#faf9f7] border border-[rgba(15,23,42,0.1)] text-[#0B192C] hover:bg-[#EEEAE2]";

  return (
    <div className={`flex flex-col gap-1.5 ${variant === "ghost" ? "items-end" : variant === "sidebar" ? "items-stretch" : "items-center"}`}>
      <div className={`flex items-center gap-2 ${variant === "sidebar" ? "flex-col" : ""}`}>
        <button
          onClick={run}
          disabled={busy || resetting}
          className={`micro-button-pad flex items-center justify-center gap-2 text-xs font-medium rounded-xl transition disabled:opacity-60 ${variant === "sidebar" ? "w-full" : ""} ${cls}`}
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
          {busy ? "Scanning inbox…" : "Scan inbox"}
        </button>
        <button
          onClick={reset}
          disabled={busy || resetting}
          title="Clear ingested reports & dismissed candidates so a fresh scan re-surfaces them (demo)"
          className={`micro-button-pad flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl transition disabled:opacity-60 text-[#94A3B8] bg-transparent hover:bg-[#EEEAE2] hover:text-[#64748B] ${variant === "sidebar" ? "w-full" : ""}`}
        >
          <RotateCcw size={13} className={resetting ? "animate-spin" : ""} />
          {resetting ? "Resetting…" : "Reset demo"}
        </button>
      </div>
      {msg && <p className="text-sm text-[#64748B]">{msg}</p>}
    </div>
  );
}

// Modal shown when one or more health reports have produced candidate journeys.
// Each "Health Report" email becomes one candidate — the user picks which one to
// start. When several are pending, a selector strip lets them switch between them.
function SuggestionModal() {
  const proposed = useQuery(api.treatment.proposed);
  const approve = useMutation(api.treatment.approve);
  const reject = useMutation(api.treatment.reject);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = proposed ?? [];
  // Keep the selection valid as plans get approved/dismissed; default to the first.
  const entry = entries.find((e) => e.plan._id === selectedId) ?? entries[0];
  if (!entry) return null;
  const { plan, report, email } = entry;
  const multiple = entries.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }}>
      <div className="scrollbar-none w-full max-w-lg max-h-[calc(100dvh-3rem)] bg-[#faf9f7] rounded-3xl shadow-2xl overflow-y-auto" style={{ animation: "fadeUp2 0.25s ease" }}>
        {/* Header */}
        <div className="p-6 text-[#faf9f7]" style={{ background: "linear-gradient(135deg,#0B192C,#0284C7 45%,#0284C7)" }}>
          <div className="flex items-center gap-2 mb-2">
            <PulseDot color="#faf9f7" />
            <span className="text-sm font-bold opacity-90">
              {multiple ? `${entries.length} CARE OPTIONS DETECTED` : "NEW HEALTH REPORT DETECTED"}
            </span>
          </div>
          <h2 className="text-2xl font-medium" style={{ fontFamily: '"Ivar Display", Georgia, "Times New Roman", serif' }}>
            {report?.patientName ? `${report.patientName} · ` : ""}{report?.condition ?? "Report"}
          </h2>
          {email && <p className="text-xs opacity-80 mt-1">From {email.from} · {email.subject}</p>}
        </div>

        {/* Candidate selector — only when more than one report is pending. */}
        {multiple && (
          <div className="px-4 pt-4">
            <p className="text-sm font-bold text-[#94A3B8] mb-2">
              CHOOSE A JOURNEY TO START
            </p>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {entries.map((e) => {
                const active = e.plan._id === entry.plan._id;
                return (
                  <button
                    key={e.plan._id}
                    onClick={() => setSelectedId(e.plan._id)}
                    className={`text-left px-3 py-2.5 rounded-xl border transition ${
                      active
                        ? "border-[#0284C7] bg-[#E0FBFD]"
                        : "border-[rgba(15,23,42,0.1)] bg-[#faf9f7] hover:bg-[#F3F0EA]"
                    }`}
                  >
                    <p className="text-sm font-bold text-[#0B192C] truncate">
                      {e.plan.recommendedProcedure}
                    </p>
                    <p className="text-sm text-[#64748B] truncate">
                      {e.report?.patientName ? `${e.report.patientName} · ` : ""}
                      {e.report?.condition ?? e.plan.summary}
                      {e.plan.estCostInr ? ` · ${inr(e.plan.estCostInr)}` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-bold text-[#94A3B8] mb-1">DIAGNOSIS</p>
            <p className="text-sm text-[#0B192C]">{report?.diagnosis ?? plan.summary}</p>
          </div>
          <div className="bg-[#E0FBFD] rounded-2xl p-4 border border-[#B6F4FA]">
            <div className="flex items-center gap-2 mb-1.5">
              <Bot size={15} className="text-[#0284C7]" />
              <p className="text-sm font-bold text-[#0284C7]">ASTRA RECOMMENDS</p>
            </div>
            <p className="font-bold text-[#0B192C]">{plan.recommendedProcedure}</p>
            <p className="text-xs text-[#64748B] mt-1">{plan.summary}</p>
            <div className="flex gap-4 mt-3">
              {plan.estCostInr ? (
                <div>
                  <p className="text-sm text-[#94A3B8] font-medium">EST. COST</p>
                  <p className="text-sm font-bold text-[#0B192C]">{inr(plan.estCostInr)}</p>
                </div>
              ) : null}
              <div className="flex-1">
                <p className="text-sm text-[#94A3B8] font-medium">COVERAGE</p>
                <p className="text-xs text-[#0B192C]">{plan.coverageNote}</p>
              </div>
            </div>
          </div>

          <p className="text-sm text-[#94A3B8]">
            Approving starts an autonomous journey — Astra's agents will coordinate hospitals,
            insurance pre-auth and documents. You stay in control and approve key decisions.
          </p>

          <div className="flex gap-3 mt-1">
            <button
              onClick={async () => { setBusy(true); try { await reject({ id: plan._id }); } finally { setBusy(false); } }}
              disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-[#64748B] bg-[#EEEAE2] hover:bg-[#a7c3e7] transition disabled:opacity-60"
            >
              Dismiss
            </button>
            <button
              onClick={async () => { setBusy(true); try { await approve({ id: plan._id }); } finally { setBusy(false); } }}
              disabled={busy}
              className="flex-[2] py-3 rounded-xl text-sm font-bold text-[#faf9f7] transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#0284C7,#0284C7)" }}
            >
              <Check size={15} /> {busy ? "Starting…" : "Approve & Start Journey"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const navigate = (nextScreen: Screen) => {
    setScreen(nextScreen);
    if (typeof window !== "undefined" && window.innerWidth <= 767) {
      setSidebarCollapsed(true);
    }
  };

  return (
    <SidebarControlsContext.Provider value={{ collapsed: sidebarCollapsed, toggle: () => setSidebarCollapsed((value) => !value) }}>
      <>
      <style>{`
        * { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }

        @keyframes waveBar2 {
          from { height: 3px; }
          to   { height: 44px; }
        }
        @keyframes ripple2 {
          0%   { transform: scale(1.4); opacity: 0.15; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes fadeUp2 {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="responsive-shell flex h-screen overflow-hidden bg-[#F3F0EA]">
        <Sidebar
          screen={screen}
          onNavigate={navigate}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((value) => !value)}
        />
        <button
          type="button"
          className="responsive-sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarCollapsed(true)}
        />
        <main className="responsive-main flex-1 overflow-y-auto">
          {screen === "home"      && <HomeScreen onNavigate={navigate} />}
          {screen === "agents"    && <AgentsScreen />}
          {screen === "timeline"  && <TimelineScreen />}
          {screen === "hospitals" && <HospitalsScreen />}
          {screen === "insurance" && <InsuranceScreen />}
          {screen === "vault"     && <VaultScreen />}
          {screen === "approvals" && <ApprovalsScreen />}
          {screen === "voice"     && <VoiceScreen />}
        </main>
      </div>

      <SuggestionModal />
      </>
    </SidebarControlsContext.Provider>
  );
}
