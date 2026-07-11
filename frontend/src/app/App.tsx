import { useState, useEffect } from "react";
import {
  Home, Zap, GitBranch, MapPin, Shield, FolderOpen, CheckSquare, Mic,
  Bot, FileText, CreditCard, Building2, Bell, Star, Upload, Check, X,
  AlertCircle, ArrowRight, Stethoscope, CheckCircle2, Timer, RefreshCw,
  ShieldCheck, Receipt, Circle, Eye, Download, ChevronRight, Settings,
  User, TrendingUp, MoreHorizontal, Calendar, Activity, Menu, LogOut,
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
  info: "#0EA5E9", success: "#16A34A", warning: "#F59E0B", action: "#8B5CF6",
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

type Screen =
  | "home" | "agents" | "timeline" | "hospitals"
  | "insurance" | "vault" | "approvals" | "voice";

// ── Primitives ──────────────────────────────────────────────────────────────

function CircularProgress({ value, size = 96, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <defs>
        <linearGradient id="pgWeb" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#pgWeb)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s ease" }}
      />
    </svg>
  );
}

function PulseDot({ color = "#0EA5E9", size = "sm" }: { color?: string; size?: "sm" | "md" }) {
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
    working: { label: "Working",  bg: "#EFF6FF", text: "#0EA5E9" },
    waiting: { label: "Waiting",  bg: "#FFFBEB", text: "#D97706" },
    done:    { label: "Done",     bg: "#F0FDF4", text: "#16A34A" },
    pending: { label: "Pending",  bg: "#F8FAFF", text: "#64748B" },
  }[status];
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label.toUpperCase()}
    </span>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-2xl font-bold text-[#0F172A] tracking-tight">{title}</h2>
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

function Sidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const groups = [
    { key: "main",    label: "OVERVIEW"       },
    { key: "journey", label: "ACTIVE JOURNEY" },
    { key: "tools",   label: "TOOLS"          },
  ];

  return (
    <aside className="h-screen flex flex-col bg-white border-r border-[rgba(15,23,42,0.07)] overflow-y-auto flex-shrink-0" style={{ width: 256 }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[rgba(15,23,42,0.06)]">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#0EA5E9,#14B8A6)" }}>
          <span className="text-white font-black text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>A</span>
        </div>
        <div>
          <span className="font-black text-[#0F172A] text-lg tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>astra</span>
          <div className="flex items-center gap-1.5 mt-0">
            <PulseDot size="sm" />
            <span className="text-[10px] text-[#64748B] font-semibold">4 agents active</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-5">
        {groups.map((g) => {
          const items = NAV_ITEMS.filter((n) => n.group === g.key);
          return (
            <div key={g.key}>
              <p className="text-[10px] font-black text-[#94A3B8] tracking-widest px-2 mb-2">{g.label}</p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const active = screen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                        active
                          ? "bg-[#EFF6FF] text-[#0EA5E9]"
                          : "text-[#64748B] hover:bg-[#F8FAFF] hover:text-[#0F172A]"
                      }`}
                    >
                      <item.icon size={16} strokeWidth={active ? 2.5 : 1.75} />
                      {item.label}
                      {item.id === "approvals" && (
                        <span className="ml-auto w-5 h-5 bg-[#EF4444] text-white text-[9px] font-black rounded-full flex items-center justify-center">1</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Journey widget */}
      <CurrentJourneyCard />

      {/* User */}
      <UserCard />
    </aside>
  );
}

function CurrentJourneyCard() {
  const journeys = useQuery(api.journeys.listActive);
  const j = journeys?.[0];
  if (!j) return null;
  return (
    <div className="mx-3 mb-3 p-4 rounded-2xl bg-[#F8FAFF] border border-[rgba(15,23,42,0.06)]">
      <p className="text-[10px] font-black text-[#94A3B8] tracking-widest mb-2">CURRENT JOURNEY</p>
      <p className="font-bold text-[#0F172A] text-sm leading-tight">{j.title}</p>
      <p className="text-xs text-[#64748B] mb-3">{j.patientName} · {j.patientAge} yrs</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${j.progress}%`, background: "linear-gradient(90deg,#0EA5E9,#14B8A6)" }} />
        </div>
        <span className="text-[11px] font-black text-[#0EA5E9]" style={{ fontFamily: "'DM Mono', monospace" }}>{j.progress}%</span>
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
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#14B8A6] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-black">{initial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{email || "Signed in"}</p>
        <p className="text-[11px] text-[#94A3B8]">Patient Guardian</p>
      </div>
      <button
        onClick={() => void signOut()}
        title="Sign out"
        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition"
      >
        <LogOut size={14} className="text-[#94A3B8]" />
      </button>
    </div>
  );
}

// ── Top bar ─────────────────────────────────────────────────────────────────

function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sticky top-0 z-20 bg-[#F8FAFF]/90 backdrop-blur-xl border-b border-[rgba(15,23,42,0.06)] px-8 py-4 flex items-center justify-between">
      <div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-xl font-bold text-[#0F172A] tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-[#64748B] mt-0">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-[rgba(15,23,42,0.08)] rounded-xl px-3 py-2">
          <Calendar size={14} className="text-[#64748B]" />
          <span className="text-xs font-semibold text-[#64748B]">Mon, Jul 7, 2025</span>
        </div>
        <button className="relative w-9 h-9 bg-white border border-[rgba(15,23,42,0.08)] rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] transition">
          <Bell size={16} className="text-[#0F172A]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full" />
        </button>
      </div>
    </div>
  );
}

// ── Screen 1: Home ──────────────────────────────────────────────────────────

const STAGE_ORDER = [
  "Doctor Consultation", "Insurance Pre-Auth", "Hospital Booking",
  "Surgery", "Recovery & Rehab", "Claim Filing",
];
const AGENT_COLORS = ["#0EA5E9", "#8B5CF6", "#14B8A6", "#F59E0B", "#16A34A", "#64748B"];

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
  const loading = journeys === undefined;

  // Still loading this user's journeys.
  if (loading) {
    return (
      <>
        <TopBar title={`Good morning, ${name}`} />
        <div className="p-8 text-sm text-[#64748B]">Loading your journey…</div>
      </>
    );
  }

  // No journey yet for this user — clean empty state, no demo data.
  if (!journey) {
    return (
      <>
        <TopBar title={`Good morning, ${name}`} subtitle="Let's get your healthcare journey started." />
        <div className="p-8">
          <div className="bg-white rounded-2xl border border-[rgba(15,23,42,0.06)] p-14 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg,#0EA5E9,#14B8A6)" }}>
              <Stethoscope size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-[#0F172A]" style={{ fontFamily: "'Outfit', sans-serif" }}>No active journey yet</h2>
            <p className="text-sm text-[#64748B] mt-1.5 max-w-md">
              When a health report arrives or you start a journey, Astra's agents begin
              coordinating hospitals, insurance, documents and claims — and it all shows up here.
            </p>
            <div className="mt-6">
              <ScanInboxButton />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-3">Simulates a health report arriving in your inbox.</p>
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
      color: ACTIVITY_KIND_COLOR[a.kind] ?? "#0EA5E9",
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
      <TopBar title={`Good morning, ${name}`} subtitle={`Here's where ${journey.patientName}'s healthcare journey stands today`} />

      <div className="p-8 flex flex-col gap-6">
        <div className="flex justify-end -mb-2">
          <ScanInboxButton variant="ghost" />
        </div>
        {/* Hero journey card */}
        <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0284C7 0%,#0EA5E9 40%,#14B8A6 100%)" }}>
          <div className="absolute inset-0 opacity-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="absolute rounded-full border border-white" style={{ width: 200 + i * 120, height: 200 + i * 120, top: "50%", right: -60 + i * -40, transform: "translateY(-50%)", opacity: 0.6 - i * 0.1 }} />
            ))}
          </div>
          <div className="relative flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <PulseDot color="white" />
                <span className="text-xs font-black opacity-80 tracking-widest">ACTIVE JOURNEY</span>
              </div>
              <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-black tracking-tight mb-1">{hero.title}</h2>
              <p className="opacity-75 text-sm mb-5">{hero.patient}</p>

              <div className="flex items-center gap-4 flex-wrap">
                {hero.stats.map((s) => (
                  <div key={s.label} className="bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                    <p className="text-[10px] opacity-70 font-semibold tracking-wide">{s.label}</p>
                    <p className="font-black text-sm">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center ml-8 flex-shrink-0">
              <div className="relative">
                <CircularProgress value={hero.progress} size={120} stroke={10} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-3xl font-black" style={{ fontFamily: "'DM Mono', monospace" }}>{hero.progress}%</span>
                    <p className="text-xs opacity-70">complete</p>
                  </div>
                </div>
              </div>
              <button onClick={() => onNavigate("agents")} className="mt-3 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-xl text-xs font-bold">
                View agents <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* 3-col grid */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          {/* Timeline summary */}
          <div className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-[#0F172A] text-sm">Journey Stages</p>
              <button onClick={() => onNavigate("timeline")} className="text-xs text-[#0EA5E9] font-semibold hover:underline flex items-center gap-1">
                Full view <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex flex-col">
              {stages.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      s.active ? "bg-[#0EA5E9]" : s.done ? "bg-[#14B8A6]" : "bg-[#E2E8F0]"
                    }`}>
                      {s.done  && <Check size={9} className="text-white" />}
                      {s.active && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                    </div>
                    {i < stages.length - 1 && <div className={`w-0.5 h-4 ${s.done ? "bg-[#14B8A6]" : "bg-[#E2E8F0]"}`} />}
                  </div>
                  <div className="flex items-center gap-2 flex-1 py-0.5">
                    <span className={`text-xs ${
                      s.active ? "font-bold text-[#0EA5E9]" :
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
          <div className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <p className="font-bold text-[#0F172A] text-sm">AI Agents</p>
                <PulseDot />
              </div>
              <button onClick={() => onNavigate("agents")} className="text-xs text-[#0EA5E9] font-semibold hover:underline flex items-center gap-1">
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
                        <span className="text-xs font-semibold text-[#0F172A]">{a.name}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.progress}%`, backgroundColor: color, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
            <p className="font-bold text-[#0F172A] text-sm mb-4">Quick Access</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                { label: "Hospitals",  sub: "Discover",                     icon: Building2,   color: "#0EA5E9", screen: "hospitals"  as Screen },
                { label: "Documents",  sub: `${docsMissing} missing`,        icon: FileText,    color: "#F59E0B", screen: "vault"      as Screen },
                { label: "Insurance",  sub: `${inr(journey.coverageLeftInr)} left`, icon: Shield, color: "#14B8A6", screen: "insurance"  as Screen },
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
                  <p className="font-bold text-[#0F172A] text-xs">{item.label}</p>
                  <p className="text-[11px] text-[#64748B]">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-bold text-[#0F172A]">Live Activity Feed</p>
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
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#F8FAFF]">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: a.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#0F172A] leading-snug">{a.text}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-1 font-mono">{a.time}</p>
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
  const agents = [
    { name: "Planner Agent",       role: "Journey Orchestrator",      status: "working" as const, action: "Coordinating hospital booking timeline and surgery prep schedule",        progress: 68,  tasks: 12, color: "#0EA5E9" },
    { name: "Insurance Agent",     role: "Coverage Specialist",       status: "working" as const, action: "Parsing Star Health policy clause 8.3 — surgical procedure coverage",   progress: 45,  tasks: 7,  color: "#8B5CF6" },
    { name: "Hospital Agent",      role: "Facility Coordinator",      status: "working" as const, action: "Matching TKR-specialist hospitals within 10 km — 3 shortlisted",        progress: 80,  tasks: 9,  color: "#14B8A6" },
    { name: "Document Agent",      role: "Records Manager",           status: "waiting" as const, action: "Awaiting MRI report from Medanta Radiology — follow-up sent",           progress: 30,  tasks: 5,  color: "#F59E0B" },
    { name: "Claim Agent",         role: "Reimbursement Specialist",  status: "pending" as const, action: "On standby — claim package preparation begins post-surgery discharge",  progress: 10,  tasks: 3,  color: "#64748B" },
    { name: "Notification Agent",  role: "Communication Manager",     status: "done"    as const, action: "Pre-auth approval confirmation sent to Apollo hospital coordinator",    progress: 100, tasks: 15, color: "#16A34A" },
  ];

  const events = [
    { agent: "Hospital Agent",   text: "Found 3 hospitals matching TKR specialty + Star Health coverage",   time: "Just now",  color: "#14B8A6" },
    { agent: "Insurance Agent",  text: "Clause 8.3 confirmed: TKR procedure covered up to ₹5,00,000",     time: "4m ago",    color: "#8B5CF6" },
    { agent: "Planner Agent",    text: "Surgery timeline updated — estimated date moved to Jul 14",        time: "11m ago",   color: "#0EA5E9" },
    { agent: "Document Agent",   text: "Follow-up reminder sent to Medanta radiology department",         time: "22m ago",   color: "#F59E0B" },
    { agent: "Notification Agent","text": "Confirmation email dispatched to hospital coordinator",         time: "1h ago",    color: "#16A34A" },
    { agent: "Planner Agent",    text: "Pre-op checklist generated — 8 items identified",                time: "2h ago",    color: "#0EA5E9" },
    { agent: "Insurance Agent",  text: "Policy deductible ₹10,000 per procedure confirmed",              time: "3h ago",    color: "#8B5CF6" },
    { agent: "Hospital Agent",   text: "Apollo Hospitals Bandra identified as primary recommendation",    time: "4h ago",    color: "#14B8A6" },
  ];

  return (
    <>
      <TopBar title="Live Agent Activity" subtitle="6 autonomous agents managing your father's healthcare journey" />
      <div className="p-8 flex flex-col gap-6">
        {/* Summary row */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Agents Active",   value: "4",   color: "#0EA5E9", bg: "#EFF6FF"  },
            { label: "Tasks Completed", value: "38",  color: "#16A34A", bg: "#F0FDF4"  },
            { label: "Agents Waiting",  value: "1",   color: "#D97706", bg: "#FFFBEB"  },
            { label: "Total Tasks",     value: "51",  color: "#64748B", bg: "#F8FAFF"  },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
              <p className="text-xs text-[#64748B] mb-1">{s.label}</p>
              <p className="text-3xl font-black" style={{ fontFamily: "'DM Mono', monospace", color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 360px" }}>
          {/* Agent cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            {agents.map((agent) => (
              <div key={agent.name} className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${agent.color}18` }}>
                      <Bot size={18} style={{ color: agent.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-[#0F172A] text-sm">{agent.name}</p>
                      <p className="text-xs text-[#64748B]">{agent.role}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>

                <div className="bg-[#F8FAFF] rounded-xl p-3">
                  <p className="text-xs text-[#64748B] leading-relaxed">{agent.action}</p>
                </div>

                <div className="flex items-center gap-3 mt-auto">
                  <div className="flex-1 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${agent.progress}%`, backgroundColor: agent.color }} />
                  </div>
                  <span className="text-[11px] font-bold text-[#94A3B8]" style={{ fontFamily: "'DM Mono', monospace" }}>{agent.tasks} tasks</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live event stream */}
          <div className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-[#0F172A] text-sm">Event Stream</p>
                <p className="text-xs text-[#64748B]">Real-time agent actions</p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#F0FDF4] rounded-lg px-2 py-1">
                <PulseDot color="#16A34A" size="sm" />
                <span className="text-[10px] font-bold text-[#16A34A]">LIVE</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto flex-1">
              {events.map((e, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-[rgba(15,23,42,0.04)] pb-3 last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: e.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold mb-0.5" style={{ color: e.color }}>{e.agent}</p>
                    <p className="text-xs text-[#0F172A] leading-snug">{e.text}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">{e.time}</p>
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
  const [selected, setSelected] = useState(2);

  const stages = [
    { label: "Doctor Consultation",     status: "done"    as const, date: "Jun 28", sub: "Apollo Clinic, Bandra",     steps: ["GP consultation completed", "Referred to orthopedic surgeon", "Diagnosis: Grade 3 Osteoarthritis"] },
    { label: "Insurance Pre-Authorization", status: "done" as const, date: "Jul 1",  sub: "Star Health Insurance",     steps: ["Policy benefits verified", "Surgery covered up to ₹5,00,000", "Pre-auth approved in 48 hours"] },
    { label: "Hospital Booking",        status: "running" as const, date: "Jul 7",  sub: "3 hospitals shortlisted",   steps: ["Apollo Hospitals shortlisted", "Kokilaben Hospital shortlisted", "Awaiting slot confirmation"] },
    { label: "Surgery",                 status: "pending" as const, date: "Jul 14", sub: "Total Knee Replacement",    steps: ["Pre-op blood work scheduled", "Anaesthesia consult required", "Surgery slot to be confirmed"] },
    { label: "Recovery & Rehabilitation", status: "pending" as const, date: "Jul 15–28", sub: "In-hospital + home care", steps: ["4-day hospital stay", "Daily physiotherapy sessions", "Home nursing visits arranged"] },
    { label: "Claim Filing",            status: "pending" as const, date: "Post-discharge", sub: "Star Health Insurance", steps: ["Collect discharge summary", "Submit all hospital bills", "Reimbursement within 7 days"] },
  ];

  const cfg = {
    done:    { dot: "#14B8A6", label: "Completed", bg: "#F0FDF4" },
    running: { dot: "#0EA5E9", label: "In Progress", bg: "#EFF6FF" },
    pending: { dot: "#E2E8F0", label: "Upcoming",   bg: "#F8FAFF" },
  };

  const sel = stages[selected];

  return (
    <>
      <TopBar title="Journey Timeline" subtitle="Father's Knee Surgery — 72% complete across 6 stages" />
      <div className="p-8">
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 380px" }}>
          {/* Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
            <div className="flex flex-col">
              {stages.map((stage, i) => {
                const c = cfg[stage.status];
                const isSelected = selected === i;
                return (
                  <button key={i} className="flex gap-5 text-left group" onClick={() => setSelected(i)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ring-2 transition-all ${isSelected ? "ring-[#0EA5E9] ring-offset-2" : "ring-transparent"}`} style={{ backgroundColor: c.dot }}>
                        {stage.status === "done"    && <Check size={12} className="text-white" />}
                        {stage.status === "running" && <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />}
                        {stage.status === "pending" && <div className="w-2.5 h-2.5 bg-[#94A3B8] rounded-full" />}
                      </div>
                      {i < stages.length - 1 && <div className="w-0.5 flex-1 min-h-[32px]" style={{ backgroundColor: stage.status === "done" ? "#14B8A6" : "#E2E8F0" }} />}
                    </div>

                    <div className={`flex-1 pb-6 px-4 py-2 rounded-xl mb-1 transition-all ${isSelected ? "bg-[#F8FAFF] border border-[rgba(15,23,42,0.06)]" : "hover:bg-[#F8FAFF]/50"}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black tracking-widest" style={{ color: c.dot }}>{c.label}</span>
                        <span className="text-[10px] text-[#94A3B8] font-mono">{stage.date}</span>
                      </div>
                      <p className="font-bold text-[#0F172A]">{stage.label}</p>
                      <p className="text-sm text-[#64748B]">{stage.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black tracking-widest" style={{ color: cfg[sel.status].dot }}>
                  {cfg[sel.status].label.toUpperCase()}
                </span>
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-xl font-bold text-[#0F172A] mb-1">{sel.label}</h3>
              <p className="text-sm text-[#64748B] mb-4">{sel.sub} · {sel.date}</p>

              <div className="flex flex-col gap-2">
                {sel.steps.map((step, j) => {
                  const isDone    = sel.status === "done" || (sel.status === "running" && j < 2);
                  const isCurrent = sel.status === "running" && j === 2;
                  return (
                    <div key={j} className={`flex items-center gap-3 p-3 rounded-xl ${isDone ? "bg-[#F0FDF4]" : isCurrent ? "bg-[#FFFBEB]" : "bg-[#F8FAFF]"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? "bg-[#D1FAE5]" : isCurrent ? "bg-[#FEF3C7]" : "bg-[#E2E8F0]"}`}>
                        {isDone    ? <Check size={10} className="text-[#16A34A]" /> :
                         isCurrent ? <Timer size={10} className="text-[#D97706]" /> :
                                     <Circle size={10} className="text-[#CBD5E1]" />}
                      </div>
                      <span className={`text-sm ${isDone ? "text-[#64748B] line-through" : isCurrent ? "text-[#D97706] font-semibold" : "text-[#CBD5E1]"}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {sel.status === "running" && (
              <div className="bg-gradient-to-br from-[#0EA5E9] to-[#14B8A6] rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <PulseDot color="white" />
                  <span className="text-xs font-black opacity-80 tracking-wider">AGENT WORKING</span>
                </div>
                <p className="font-bold">Hospital Agent is active</p>
                <p className="text-sm opacity-75 mt-0.5">Comparing 3 hospitals on insurance coverage, wait time, and surgeon expertise</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Screen 4: Hospitals ─────────────────────────────────────────────────────

function HospitalsScreen() {
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(0);

  const hospitals = [
    { name: "Apollo Hospitals",  location: "Bandra West", dist: "3.2 km", rating: 4.8, wait: "2 days", oop: "₹28,000",  covered: true,  specialty: "Orthopedics Center of Excellence", beds: 650, pin: { x: "28%", y: "30%" }, surgeons: "Dr. Priya Sharma, Dr. Anand Rao" },
    { name: "Kokilaben Hospital", location: "Andheri West", dist: "5.8 km", rating: 4.7, wait: "5 days", oop: "₹35,000", covered: true,  specialty: "Joint Replacement Unit",           beds: 750, pin: { x: "66%", y: "48%" }, surgeons: "Dr. Suresh Mehta, Dr. Kavitha Nair" },
    { name: "Hinduja Hospital",  location: "Mahim",       dist: "4.1 km", rating: 4.6, wait: "3 days", oop: "₹22,000",  covered: false, specialty: "Orthopedic Surgery Dept.",         beds: 350, pin: { x: "47%", y: "66%" }, surgeons: "Dr. Vikram Singh" },
  ];

  const filtered = filter === "Covered" ? hospitals.filter((h) => h.covered)
    : filter === "< 5km" ? hospitals.filter((h) => parseFloat(h.dist) < 5)
    : filter === "Top Rated" ? hospitals.filter((h) => h.rating >= 4.7)
    : hospitals;

  const sel = hospitals[selected];

  return (
    <>
      <TopBar title="Hospital Discovery" subtitle="AI-matched hospitals for Total Knee Replacement — Star Health accepted" />
      <div className="p-8 flex flex-col gap-6">
        {/* Filters */}
        <div className="flex items-center gap-3">
          {["All", "Covered", "< 5km", "Top Rated"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-sm font-bold px-4 py-2 rounded-xl transition ${filter === f ? "bg-[#0EA5E9] text-white" : "bg-white text-[#64748B] border border-[rgba(15,23,42,0.08)] hover:border-[#0EA5E9] hover:text-[#0EA5E9]"}`}>
              {f}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-[#64748B]">
            <Activity size={14} /> Agent refreshed 2m ago
          </div>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 380px" }}>
          {/* Map + list */}
          <div className="flex flex-col gap-4">
            {/* Map */}
            <div className="rounded-2xl h-64 relative overflow-hidden border border-[rgba(15,23,42,0.06)]"
              style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #E0F2FE 50%, #CCFBF1 100%)" }}>
              <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                {[...Array(9)].map((_, i) => (
                  <line key={`v${i}`} x1={`${i * 12.5}%`} y1="0" x2={`${i * 12.5}%`} y2="100%" stroke="#0EA5E9" strokeWidth="0.4" opacity="0.2" />
                ))}
                {[...Array(7)].map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={`${i * 16.7}%`} x2="100%" y2={`${i * 16.7}%`} stroke="#0EA5E9" strokeWidth="0.4" opacity="0.2" />
                ))}
                <path d="M50,130 Q150,100 250,115 Q350,130 500,105 Q620,85 750,110 Q850,125 950,95" fill="none" stroke="#0EA5E9" strokeWidth="2" opacity="0.35" />
                <path d="M0,160 Q120,140 250,155 Q380,165 500,145 Q640,130 780,150 Q880,160 960,140" fill="none" stroke="#14B8A6" strokeWidth="1.5" opacity="0.25" />
                <path d="M80,80 Q200,70 350,90 Q480,105 600,85 Q720,70 850,88" fill="none" stroke="#0EA5E9" strokeWidth="1" opacity="0.15" />
              </svg>

              {hospitals.map((h, i) => (
                <button key={h.name} className="absolute flex flex-col items-center transition-all hover:scale-110" style={{ left: h.pin.x, top: h.pin.y, transform: "translate(-50%,-100%)" }} onClick={() => setSelected(i)}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${selected === i ? "bg-[#0EA5E9] scale-110" : "bg-white border-2 border-[#0EA5E9]"}`}>
                    <Building2 size={14} className={selected === i ? "text-white" : "text-[#0EA5E9]"} />
                  </div>
                  <div className={`text-[9px] font-black mt-0.5 px-2 py-0.5 rounded shadow-sm whitespace-nowrap ${selected === i ? "bg-[#0EA5E9] text-white" : "bg-white text-[#0F172A]"}`}>
                    {h.name.split(" ")[0]}
                  </div>
                </button>
              ))}

              <div className="absolute" style={{ left: "50%", top: "52%", transform: "translate(-50%,-50%)" }}>
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 bg-[#0EA5E9] rounded-full animate-ping opacity-30" />
                  <div className="relative w-5 h-5 bg-[#0EA5E9] rounded-full border-3 border-white shadow-lg" />
                </div>
              </div>

              <div className="absolute bottom-3 right-3 bg-white/80 backdrop-blur rounded-xl px-3 py-1.5">
                <span className="text-xs font-bold text-[#0F172A]">Mumbai, Maharashtra</span>
              </div>
            </div>

            {/* Hospital cards */}
            <div className="flex flex-col gap-3">
              {filtered.map((h, i) => (
                <button key={h.name} onClick={() => setSelected(hospitals.indexOf(h))}
                  className={`bg-white rounded-2xl p-4 border text-left transition-all ${selected === hospitals.indexOf(h) ? "border-[#0EA5E9] shadow-md" : "border-[rgba(15,23,42,0.06)] hover:shadow-sm"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-[#0F172A]">{h.name}</h3>
                      {h.covered && <span className="text-[9px] font-black bg-[#F0FDF4] text-[#16A34A] px-2 py-0.5 rounded-full tracking-wider">COVERED</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Star size={12} className="text-[#F59E0B] fill-[#F59E0B]" />
                      <span className="font-black text-[#0F172A] text-sm">{h.rating}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#0EA5E9] font-semibold mb-3">{h.specialty}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Distance",     value: h.dist  },
                      { label: "Wait time",    value: h.wait  },
                      { label: "Out-of-pocket", value: h.oop  },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#F8FAFF] rounded-xl p-2">
                        <p className="text-[9px] text-[#64748B] mb-0.5">{s.label}</p>
                        <p className="text-xs font-black text-[#0F172A]">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail sidebar */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
              <div className="flex items-center justify-between mb-1">
                <h3 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-xl font-bold text-[#0F172A]">{sel.name}</h3>
                {sel.covered && <span className="text-[9px] font-black bg-[#F0FDF4] text-[#16A34A] px-2.5 py-1 rounded-full tracking-wider">STAR HEALTH COVERED</span>}
              </div>
              <p className="text-sm text-[#64748B] mb-5">{sel.location} · {sel.dist} away</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: "Rating",       value: `${sel.rating} / 5.0`, color: "#F59E0B" },
                  { label: "Wait Time",    value: sel.wait,               color: "#0EA5E9" },
                  { label: "Out-of-Pocket", value: sel.oop,               color: "#8B5CF6" },
                  { label: "Total Beds",   value: `${sel.beds}+`,         color: "#14B8A6" },
                ].map((s) => (
                  <div key={s.label} className="bg-[#F8FAFF] rounded-xl p-3">
                    <p className="text-[10px] text-[#64748B] mb-0.5">{s.label}</p>
                    <p className="font-black" style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <p className="text-xs text-[#64748B] mb-1.5">Specialty Unit</p>
                <p className="font-semibold text-[#0F172A] text-sm">{sel.specialty}</p>
              </div>

              <div className="mb-5">
                <p className="text-xs text-[#64748B] mb-1.5">Available Surgeons</p>
                <p className="font-semibold text-[#0F172A] text-sm">{sel.surgeons}</p>
              </div>

              <button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white font-bold py-3 rounded-xl transition-colors">
                Book Appointment
              </button>
            </div>

            <div className="bg-gradient-to-br from-[#0EA5E9] to-[#14B8A6] rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-2">
                <PulseDot color="white" />
                <span className="text-xs font-black opacity-80 tracking-wider">HOSPITAL AGENT</span>
              </div>
              <p className="font-bold">Apollo Hospitals recommended</p>
              <p className="text-sm opacity-75 mt-1">Best combination of insurance coverage, wait time, and surgeon expertise for your father's TKR surgery.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Screen 5: Insurance ─────────────────────────────────────────────────────

function InsuranceScreen() {
  const claimSteps = ["Initiated", "Docs Collected", "Submitted", "Under Review", "Approved", "Paid"];
  const current = 2;

  const coverageData = [
    { name: "Used", value: 80000 },
    { name: "Remaining", value: 420000 },
  ];
  const COLORS = ["#0EA5E9", "#E2E8F0"];

  const monthlyData = [
    { month: "Mar", amount: 0 },
    { month: "Apr", amount: 15000 },
    { month: "May", amount: 15000 },
    { month: "Jun", amount: 35600 },
    { month: "Jul", amount: 80000 },
  ];

  const barData = [
    { label: "Diagnostic", amount: 12400 },
    { label: "Consult", amount: 3200 },
    { label: "Pre-op", amount: 4800 },
    { label: "Surgery*", amount: 152000 },
  ];

  return (
    <>
      <TopBar title="Insurance & Claims" subtitle="Star Health Comprehensive · Policy #SHC-2024-887231" />
      <div className="p-8 flex flex-col gap-6">
        {/* Top row */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "300px 1fr" }}>
          {/* Coverage donut */}
          <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)] flex flex-col items-center">
            <p className="font-bold text-[#0F172A] text-sm mb-4 self-start">Annual Coverage</p>
            <div className="relative">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={coverageData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                    {coverageData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-black text-[#0F172A]" style={{ fontFamily: "'DM Mono', monospace" }}>16%</span>
                <span className="text-xs text-[#64748B]">used</span>
              </div>
            </div>
            <div className="w-full mt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-[#0EA5E9]" /><span className="text-[#64748B]">Used</span></div>
                <span className="font-black text-[#0F172A]" style={{ fontFamily: "'DM Mono', monospace" }}>₹80,000</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-[#E2E8F0]" /><span className="text-[#64748B]">Remaining</span></div>
                <span className="font-black text-[#0F172A]" style={{ fontFamily: "'DM Mono', monospace" }}>₹4,20,000</span>
              </div>
            </div>
          </div>

          {/* Stats + claim pipeline */}
          <div className="flex flex-col gap-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              {[
                { label: "Surgery Estimate",         value: "₹1,80,000", color: "#0EA5E9" },
                { label: "Expected Reimbursement",   value: "₹1,52,000", color: "#14B8A6" },
                { label: "Deductible",               value: "₹10,000",   color: "#F59E0B" },
                { label: "Co-pay",                   value: "10%",        color: "#8B5CF6" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-[rgba(15,23,42,0.06)]">
                  <p className="text-xs text-[#64748B] mb-1 leading-tight">{s.label}</p>
                  <p className="text-xl font-black" style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Claim pipeline */}
            <div className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex-1">
              <p className="font-bold text-[#0F172A] text-sm mb-5">Current Claim Pipeline</p>
              <div className="flex items-center">
                {claimSteps.map((step, i) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black mb-2 ${
                        i < current ? "bg-[#14B8A6] text-white" : i === current ? "bg-[#0EA5E9] text-white" : "bg-[#E2E8F0] text-[#94A3B8]"
                      }`}>
                        {i < current ? <Check size={12} /> : i + 1}
                      </div>
                      <span className="text-[10px] text-[#64748B] text-center leading-tight">{step}</span>
                    </div>
                    {i < claimSteps.length - 1 && <div className={`h-0.5 flex-1 mb-6 ${i < current ? "bg-[#14B8A6]" : "bg-[#E2E8F0]"}`} />}
                  </div>
                ))}
              </div>
              <div className="bg-[#EFF6FF] rounded-xl p-3 mt-4">
                <p className="text-xs font-bold text-[#0EA5E9]">Docs Collected stage — agent is active</p>
                <p className="text-xs text-[#64748B] mt-0.5">Document Agent collecting discharge summary and hospital bills. Estimated 3 days to complete.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Area chart */}
          <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
            <p className="font-bold text-[#0F172A] text-sm mb-4">Coverage Usage This Year</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Amount used"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)" }} />
                <Area type="monotone" dataKey="amount" stroke="#0EA5E9" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: "#0EA5E9", r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
            <p className="font-bold text-[#0F172A] text-sm mb-1">Reimbursements Breakdown</p>
            <p className="text-xs text-[#64748B] mb-4">*Surgery is an estimate</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.04)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString()}`, "Amount"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)" }} />
                <Bar dataKey="amount" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Past claims table */}
        <div className="bg-white rounded-2xl border border-[rgba(15,23,42,0.06)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[rgba(15,23,42,0.06)]">
            <p className="font-bold text-[#0F172A] text-sm">Reimbursement History</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(15,23,42,0.04)]">
                {["Description", "Date", "Amount", "Submitted", "Status"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-[10px] font-black text-[#94A3B8] tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { desc: "Diagnostic & Imaging Tests",  date: "Jun 15, 2025", amount: "₹12,400", submitted: "Jun 17, 2025", status: "Paid"       },
                { desc: "Orthopedic Specialist Consult", date: "Jun 28, 2025", amount: "₹3,200",  submitted: "Jun 29, 2025", status: "Paid"       },
                { desc: "Pre-operative Blood Panel",   date: "Jul 5, 2025",  amount: "₹4,800",  submitted: "Jul 6, 2025",  status: "Processing" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-[rgba(15,23,42,0.04)] last:border-0 hover:bg-[#F8FAFF] transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-[#0F172A]">{r.desc}</td>
                  <td className="px-6 py-4 text-sm text-[#64748B] font-mono">{r.date}</td>
                  <td className="px-6 py-4 text-sm font-black text-[#0F172A] font-mono">{r.amount}</td>
                  <td className="px-6 py-4 text-sm text-[#64748B] font-mono">{r.submitted}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full tracking-wide ${r.status === "Paid" ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#FFFBEB] text-[#D97706]"}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Screen 6: Vault ─────────────────────────────────────────────────────────

// The must-have documents for the demo journey.
const REQUIRED_DOCS = [
  { label: "Insurance Policy",      type: "Insurance",     category: "insurance", icon: Shield,      color: "#0EA5E9" },
  { label: "Aadhaar Card",          type: "Government ID", category: "identity",  icon: ShieldCheck, color: "#8B5CF6" },
  { label: "PAN Card",              type: "Government ID", category: "identity",  icon: CreditCard,  color: "#14B8A6" },
  { label: "Doctor's Prescription", type: "Prescription",  category: "medical",   icon: Stethoscope, color: "#F59E0B" },
];

function VaultScreen() {
  const items = useQuery(api.vault.list);
  const generateUploadUrl = useMutation(api.vault.generateUploadUrl);
  const save = useMutation(api.vault.save);
  const remove = useMutation(api.vault.remove);
  const [uploading, setUploading] = useState<string | null>(null);

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
      <TopBar title="Document Vault" subtitle={`${uploadedCount} of ${REQUIRED_DOCS.length} required documents uploaded`} />
      <div className="p-8 flex flex-col gap-6">
        {/* Required documents */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {REQUIRED_DOCS.map((doc) => {
            const item = byLabel.get(doc.label);
            const ok = !!item;
            const isUp = uploading === doc.label;
            return (
              <div key={doc.label} className={`bg-white rounded-2xl p-5 border flex flex-col ${ok ? "border-[rgba(15,23,42,0.06)]" : "border-[#FCA5A5] bg-[#FFF8F8]"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${doc.color}18` }}>
                    <doc.icon size={18} style={{ color: doc.color }} />
                  </div>
                  {ok ? (
                    <div className="flex gap-1.5">
                      {item!.url && (
                        <a href={item!.url} target="_blank" rel="noreferrer" title="View" className="w-8 h-8 bg-[#F1F5F9] rounded-xl flex items-center justify-center hover:bg-[#E2E8F0] transition">
                          <Eye size={13} className="text-[#64748B]" />
                        </a>
                      )}
                      <button onClick={() => void remove({ id: item!._id })} title="Remove" className="w-8 h-8 bg-[#F1F5F9] rounded-xl flex items-center justify-center hover:bg-[#FEE2E2] transition">
                        <X size={13} className="text-[#64748B]" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[9px] font-black bg-[#FEE2E2] text-[#EF4444] px-2 py-0.5 rounded-full tracking-widest">MISSING</span>
                  )}
                </div>
                <p className="font-bold text-[#0F172A] text-sm mb-0.5">{doc.label}</p>
                <p className="text-xs text-[#64748B] mb-4">{doc.type}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[11px] text-[#94A3B8] font-mono">{ok ? "Uploaded" : "Not uploaded"}</span>
                  <label className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition ${ok ? "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]" : "bg-[#0EA5E9] text-white hover:bg-[#0284C7]"}`}>
                    <Upload size={11} /> {isUp ? "Uploading…" : ok ? "Replace" : "Upload"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={isUp}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f, doc); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Other uploaded documents */}
        {extras.length > 0 && (
          <div>
            <p className="font-bold text-[#0F172A] text-sm mb-3">Other documents</p>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {extras.map((item) => (
                <div key={item._id} className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)] flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#64748B18" }}>
                      <FileText size={18} style={{ color: "#64748B" }} />
                    </div>
                    <div className="flex gap-1.5">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noreferrer" title="View" className="w-8 h-8 bg-[#F1F5F9] rounded-xl flex items-center justify-center hover:bg-[#E2E8F0] transition">
                          <Eye size={13} className="text-[#64748B]" />
                        </a>
                      )}
                      <button onClick={() => void remove({ id: item._id })} title="Remove" className="w-8 h-8 bg-[#F1F5F9] rounded-xl flex items-center justify-center hover:bg-[#FEE2E2] transition">
                        <X size={13} className="text-[#64748B]" />
                      </button>
                    </div>
                  </div>
                  <p className="font-bold text-[#0F172A] text-sm mb-0.5 truncate">{item.label}</p>
                  <p className="text-xs text-[#64748B] capitalize">{item.category}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload any other document */}
        <label className="flex items-center justify-center gap-3 w-full py-6 border-2 border-dashed border-[#CBD5E1] rounded-2xl text-[#64748B] font-semibold hover:border-[#0EA5E9] hover:text-[#0EA5E9] hover:bg-[#EFF6FF] transition-all group cursor-pointer">
          <div className="w-10 h-10 bg-[#F1F5F9] group-hover:bg-[#DBEAFE] rounded-xl flex items-center justify-center transition-colors">
            <Upload size={18} className="text-[#64748B] group-hover:text-[#0EA5E9] transition-colors" />
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
  const [done, setDone] = useState<Set<string>>(new Set());

  const approvals = [
    { id: "1", title: "Approve Hospital Selection",  urgency: "high" as const,   agent: "Hospital Agent",  color: "#0EA5E9", action: "Confirm Hospital",
      detail: "Apollo Hospitals, Bandra is recommended for your father's Total Knee Replacement surgery. Star Health accepted, wait time 2 days, estimated out-of-pocket ₹28,000. Dr. Priya Sharma is available on Jul 14." },
    { id: "2", title: "Upload MRI Report",           urgency: "high" as const,   agent: "Document Agent",  color: "#F59E0B", action: "Upload Document",
      detail: "Insurance pre-authorization requires the MRI report dated Jun 25, 2025. This document is needed to proceed with the ₹5L coverage approval. Please upload it to the Document Vault." },
    { id: "3", title: "Confirm Surgery Slot",        urgency: "medium" as const, agent: "Planner Agent",   color: "#8B5CF6", action: "Confirm Slot",
      detail: "Surgery slot available: July 14, 2025 at 9:00 AM with Dr. Priya Sharma (Sr. Orthopedic Surgeon) at Apollo Hospitals, Bandra. Confirm to block the OT slot and trigger pre-op protocols." },
  ];

  const history = [
    { title: "Pre-authorization consent signed",   date: "Jul 1 · 3:40 PM",   approved: true  },
    { title: "GP referral letter accepted",         date: "Jun 28 · 11:20 AM", approved: true  },
    { title: "Alternate hospital declined",         date: "Jun 30 · 5:15 PM",  approved: false },
    { title: "Diagnostic test package approved",    date: "Jun 15 · 9:00 AM",  approved: true  },
  ];

  const remaining = approvals.filter((a) => !done.has(a.id)).length;

  return (
    <>
      <TopBar title="Approval Center" subtitle={remaining > 0 ? `Your decision needed on ${remaining} item${remaining !== 1 ? "s" : ""}` : "All approvals handled"} />
      <div className="p-8">
        <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 360px" }}>
          {/* Approval cards */}
          <div className="flex flex-col gap-4">
            {approvals.map((a) => {
              const approved = done.has(a.id);
              return (
                <div key={a.id} className={`bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)] transition-all ${approved ? "opacity-50 scale-[0.99]" : ""}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider ${a.urgency === "high" ? "bg-[#FEF2F2] text-[#EF4444]" : "bg-[#FFFBEB] text-[#D97706]"}`}>
                        {a.urgency.toUpperCase()} PRIORITY
                      </span>
                      <span className="text-xs text-[#94A3B8] font-medium">Requested by {a.agent}</span>
                    </div>
                    {approved && (
                      <div className="flex items-center gap-1.5 text-[#16A34A]">
                        <CheckCircle2 size={14} />
                        <span className="text-xs font-bold">Approved</span>
                      </div>
                    )}
                  </div>

                  <h3 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-xl font-bold text-[#0F172A] mb-2">{a.title}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed mb-5">{a.detail}</p>

                  {!approved ? (
                    <div className="flex gap-3">
                      <button onClick={() => setDone(new Set([...done, a.id]))}
                        className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-95 hover:opacity-90"
                        style={{ backgroundColor: a.color }}>
                        {a.action}
                      </button>
                      <button className="px-6 py-3 rounded-xl font-bold text-sm text-[#64748B] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition">
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-3 bg-[#F0FDF4] rounded-xl border border-[#D1FAE5]">
                      <CheckCircle2 size={16} className="text-[#16A34A]" />
                      <span className="text-sm font-bold text-[#16A34A]">Decision recorded — agents notified</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* History panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
              <p className="font-bold text-[#0F172A] text-sm mb-4">Decision History</p>
              <div className="flex flex-col gap-0">
                {history.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-[rgba(15,23,42,0.04)] last:border-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${d.approved ? "bg-[#F0FDF4]" : "bg-[#FEF2F2]"}`}>
                      {d.approved ? <Check size={13} className="text-[#16A34A]" /> : <X size={13} className="text-[#EF4444]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] leading-tight">{d.title}</p>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">{d.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#F8FAFF] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
              <p className="text-xs font-bold text-[#64748B] mb-3">HOW THIS WORKS</p>
              <div className="flex flex-col gap-3">
                {[
                  { icon: Zap,    text: "Agents work 24/7 without your input"  },
                  { icon: Bell,   text: "You're only asked when your decision matters" },
                  { icon: Shield, text: "All approvals are logged and auditable" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-[#EFF6FF] rounded-lg flex items-center justify-center flex-shrink-0">
                      <item.icon size={13} className="text-[#0EA5E9]" />
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">{item.text}</p>
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
  const [phase, setPhase] = useState<"idle" | "listening" | "processing" | "launched">("idle");

  useEffect(() => {
    if (phase === "listening") {
      const t = setTimeout(() => setPhase("processing"), 2800);
      return () => clearTimeout(t);
    }
    if (phase === "processing") {
      const t = setTimeout(() => setPhase("launched"), 1800);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <>
      <TopBar title="Voice Command" subtitle="Speak naturally — Astra will handle the rest" />
      <div className="p-8">
        <div className="grid gap-8" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* Left: mic */}
          <div className="bg-white rounded-3xl border border-[rgba(15,23,42,0.06)] flex flex-col items-center justify-center py-16 px-8">
            {phase !== "launched" ? (
              <>
                <div className="text-center mb-12">
                  <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-3xl font-black text-[#0F172A] tracking-tight mb-2">
                    {phase === "processing" ? "Launching your team…" : "Talk to Astra"}
                  </h2>
                  <p className="text-[#64748B]">
                    {phase === "idle"      && "Press the mic and describe your healthcare need"}
                    {phase === "listening" && "Listening — speak naturally"}
                    {phase === "processing" && "Astra understood — deploying agents"}
                  </p>
                </div>

                <div className="relative mb-12" onClick={() => phase === "idle" && setPhase("listening")}>
                  {phase !== "idle" && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-[#0EA5E9]" style={{ animation: "ripple2 1.6s ease-out infinite", opacity: 0.12, transform: "scale(1.8)" }} />
                      <div className="absolute inset-0 rounded-full bg-[#0EA5E9]" style={{ animation: "ripple2 1.6s ease-out 0.5s infinite", opacity: 0.08, transform: "scale(1.5)" }} />
                    </>
                  )}
                  <button className={`relative w-36 h-36 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                    phase === "idle"       ? "bg-[#0F172A] cursor-pointer hover:scale-105 hover:shadow-3xl active:scale-95"
                    : phase === "processing" ? "bg-[#14B8A6]"
                    :                        "bg-[#0EA5E9]"
                  }`}>
                    {phase === "processing"
                      ? <RefreshCw size={48} className="text-white animate-spin" />
                      : <Mic size={48} className="text-white" />}
                  </button>
                </div>

                {phase === "listening" && (
                  <div className="flex items-center gap-[3px] h-14 mb-8">
                    {[...Array(36)].map((_, i) => (
                      <div key={i} className="w-[3px] bg-[#0EA5E9] rounded-full"
                        style={{ animation: `waveBar2 0.7s ease-in-out ${i * 0.035}s infinite alternate`, minHeight: 3 }} />
                    ))}
                  </div>
                )}

                {phase === "idle" && (
                  <div className="flex flex-col gap-2.5 w-full max-w-sm">
                    <p className="text-xs text-[#94A3B8] font-semibold tracking-wider text-center mb-1">TRY SAYING</p>
                    {[
                      "\"My father needs knee surgery\"",
                      "\"Book a diabetes specialist in Mumbai\"",
                      "\"Check my insurance coverage for cardiac care\"",
                    ].map((phrase) => (
                      <button key={phrase} onClick={() => setPhase("listening")}
                        className="text-sm text-[#64748B] bg-[#F8FAFF] border border-[rgba(15,23,42,0.08)] rounded-xl px-5 py-3 text-left hover:border-[#0EA5E9] hover:text-[#0EA5E9] hover:bg-[#EFF6FF] transition-all font-medium">
                        {phrase}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full" style={{ animation: "fadeUp2 0.4s ease-out" }}>
                <div className="flex items-center gap-2 mb-2">
                  <PulseDot size="md" />
                  <span className="text-xs font-black text-[#0EA5E9] tracking-widest">ASTRA LAUNCHED</span>
                </div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif" }} className="text-2xl font-black text-[#0F172A] tracking-tight mb-1">Journey Created</h2>
                <p className="text-sm text-[#64748B] mb-6">"My father needs knee surgery" → 6-stage journey initiated</p>

                <div className="rounded-2xl p-5 text-white mb-5" style={{ background: "linear-gradient(135deg,#0EA5E9,#14B8A6)" }}>
                  <p className="text-xs opacity-70 font-black tracking-widest mb-1">ASTRA UNDERSTOOD</p>
                  <p className="font-black text-lg">Father · Knee Surgery Journey</p>
                  <p className="text-sm opacity-75">6 agents deployed · Running autonomously</p>
                </div>

                <button onClick={() => setPhase("idle")} className="w-full py-3 rounded-xl border border-[rgba(15,23,42,0.08)] text-sm font-semibold text-[#64748B] hover:bg-[#F8FAFF] transition">
                  Try another command
                </button>
              </div>
            )}
          </div>

          {/* Right: live deployment or how-it-works */}
          <div className="flex flex-col gap-4">
            {phase === "launched" ? (
              <>
                <p className="font-bold text-[#0F172A]">Agents Deployed</p>
                {[
                  { agent: "Planner Agent",   action: "Creating 6-stage surgery journey plan",          color: "#0EA5E9" },
                  { agent: "Insurance Agent", action: "Scanning Star Health policy for TKR coverage",   color: "#8B5CF6" },
                  { agent: "Hospital Agent",  action: "Searching TKR specialists within 10 km",         color: "#14B8A6" },
                  { agent: "Document Agent",  action: "Identifying 7 required documents for surgery",   color: "#F59E0B" },
                  { agent: "Claim Agent",     action: "Preparing post-surgery claim framework",         color: "#64748B" },
                  { agent: "Notification Agent", action: "Setting up patient & hospital communication", color: "#16A34A" },
                ].map((a, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-[rgba(15,23,42,0.06)] flex items-center gap-3" style={{ animation: `fadeUp2 ${0.3 + i * 0.1}s ease-out` }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${a.color}18` }}>
                      <Bot size={16} style={{ color: a.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#0F172A]">{a.agent}</p>
                      <p className="text-xs text-[#64748B]">{a.action}</p>
                    </div>
                    <PulseDot color={a.color} />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="bg-white rounded-2xl p-6 border border-[rgba(15,23,42,0.06)]">
                  <p className="font-bold text-[#0F172A] mb-4">How Voice Works</p>
                  <div className="flex flex-col gap-4">
                    {[
                      { step: "1", title: "You speak",     desc: "Say what your patient needs in plain language — no commands required",        color: "#0EA5E9" },
                      { step: "2", title: "Astra parses",  desc: "AI extracts intent, patient, condition, and urgency from your statement",    color: "#8B5CF6" },
                      { step: "3", title: "Team deploys",  desc: "6 specialist agents are automatically assigned and begin working instantly", color: "#14B8A6" },
                      { step: "4", title: "You watch",     desc: "The dashboard transforms into your healthcare execution center",              color: "#F59E0B" },
                    ].map((s) => (
                      <div key={s.step} className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm text-white" style={{ backgroundColor: s.color }}>
                          {s.step}
                        </div>
                        <div>
                          <p className="font-bold text-[#0F172A] text-sm">{s.title}</p>
                          <p className="text-xs text-[#64748B] leading-relaxed">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#F8FAFF] rounded-2xl p-5 border border-[rgba(15,23,42,0.06)]">
                  <p className="text-xs font-bold text-[#94A3B8] tracking-wider mb-3">SUPPORTED CONDITIONS</p>
                  <div className="flex flex-wrap gap-2">
                    {["Knee Surgery", "Heart Surgery", "Cancer Care", "Diabetes Management", "Maternity", "Physiotherapy", "Eye Surgery", "Neurology"].map((tag) => (
                      <span key={tag} className="text-xs font-semibold bg-white border border-[rgba(15,23,42,0.08)] text-[#64748B] px-3 py-1.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────

// "Scan inbox" — pulls "Health Report" emails from the last 30 minutes (Gmail).
function ScanInboxButton({ variant = "solid" }: { variant?: "solid" | "ghost" }) {
  const scan = useAction(api.inbox.scanInbox);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await scan();
      if (res.status === "no_gmail") setMsg("Connect Gmail first — set the GMAIL_* env vars.");
      else if (res.status === "auth_failed") setMsg("Gmail auth failed — check the credentials.");
      else if (res.status === "unauthenticated") setMsg("Please sign in again.");
      else if (res.status === "ok") setMsg(res.count ? `Found ${res.count} new report${res.count > 1 ? "s" : ""}.` : "No new health reports in the last 30 min.");
      else setMsg(res.status);
    } catch {
      setMsg("Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  const cls =
    variant === "solid"
      ? "bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
      : "bg-white border border-[rgba(15,23,42,0.1)] text-[#0F172A] hover:bg-[#F1F5F9]";

  return (
    <div className={`flex flex-col gap-1.5 ${variant === "ghost" ? "items-end" : "items-center"}`}>
      <button
        onClick={run}
        disabled={busy}
        className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition disabled:opacity-60 ${cls}`}
      >
        <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
        {busy ? "Scanning inbox…" : "Scan inbox"}
      </button>
      {msg && <p className="text-[11px] text-[#64748B]">{msg}</p>}
    </div>
  );
}

// Modal shown when a health report has produced a treatment suggestion to verify.
function SuggestionModal() {
  const proposed = useQuery(api.treatment.proposed);
  const approve = useMutation(api.treatment.approve);
  const reject = useMutation(api.treatment.reject);
  const [busy, setBusy] = useState(false);

  const entry = proposed?.[0];
  if (!entry) return null;
  const { plan, report, email } = entry;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(15,23,42,0.45)" }}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden" style={{ animation: "fadeUp2 0.25s ease" }}>
        {/* Header */}
        <div className="p-6 text-white" style={{ background: "linear-gradient(135deg,#0284C7,#0EA5E9 45%,#14B8A6)" }}>
          <div className="flex items-center gap-2 mb-2">
            <PulseDot color="white" />
            <span className="text-[11px] font-black tracking-widest opacity-90">NEW HEALTH REPORT DETECTED</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {report?.patientName ? `${report.patientName} · ` : ""}{report?.condition ?? "Report"}
          </h2>
          {email && <p className="text-xs opacity-80 mt-1">From {email.from} · {email.subject}</p>}
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-black text-[#94A3B8] tracking-widest mb-1">DIAGNOSIS</p>
            <p className="text-sm text-[#0F172A]">{report?.diagnosis ?? plan.summary}</p>
          </div>
          <div className="bg-[#F0F9FF] rounded-2xl p-4 border border-[#BAE6FD]">
            <div className="flex items-center gap-2 mb-1.5">
              <Bot size={15} className="text-[#0EA5E9]" />
              <p className="text-[11px] font-black text-[#0EA5E9] tracking-widest">ASTRA RECOMMENDS</p>
            </div>
            <p className="font-bold text-[#0F172A]">{plan.recommendedProcedure}</p>
            <p className="text-xs text-[#64748B] mt-1">{plan.summary}</p>
            <div className="flex gap-4 mt-3">
              {plan.estCostInr ? (
                <div>
                  <p className="text-[10px] text-[#94A3B8] font-semibold">EST. COST</p>
                  <p className="text-sm font-black text-[#0F172A]">{inr(plan.estCostInr)}</p>
                </div>
              ) : null}
              <div className="flex-1">
                <p className="text-[10px] text-[#94A3B8] font-semibold">COVERAGE</p>
                <p className="text-xs text-[#0F172A]">{plan.coverageNote}</p>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Approving starts an autonomous journey — Astra's agents will coordinate hospitals,
            insurance pre-auth and documents. You stay in control and approve key decisions.
          </p>

          <div className="flex gap-3 mt-1">
            <button
              onClick={async () => { setBusy(true); try { await reject({ id: plan._id }); } finally { setBusy(false); } }}
              disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-[#64748B] bg-[#F1F5F9] hover:bg-[#E2E8F0] transition disabled:opacity-60"
            >
              Dismiss
            </button>
            <button
              onClick={async () => { setBusy(true); try { await approve({ id: plan._id }); } finally { setBusy(false); } }}
              disabled={busy}
              className="flex-[2] py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg,#0EA5E9,#14B8A6)" }}
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

  return (
    <>
      <style>{`
        * { font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(15,23,42,0.12); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.22); }

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

      <div className="flex h-screen overflow-hidden bg-[#F8FAFF]">
        <Sidebar screen={screen} onNavigate={setScreen} />
        <main className="flex-1 overflow-y-auto">
          {screen === "home"      && <HomeScreen onNavigate={setScreen} />}
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
  );
}
