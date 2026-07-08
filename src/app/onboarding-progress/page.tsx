"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  Button,
  Tooltip,
  Collapse,
} from "@mui/material";
import {
  Search,
  RefreshCw,
  Download,
  Building2,
  Users,
  Shield,
  Key,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  BarChart2,
  PieChart,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStatus = "not_started" | "in_progress" | "mostly_completed" | "completed" | "blocked";
type MemberStatus = "fully_onboarded" | "partially_onboarded" | "pending" | "blocked";
type AssignmentStatus = "assigned" | "partially_assigned" | "not_assigned" | "not_required";

interface Summary {
  totalOrganizations: number;
  totalTeams: number;
  totalMembers: number;
  totalTeamMembersTarget: number;
  totalResources: number;
  totalCredentials: number;
  totalTotpEntries: number;
  fullyOnboardedMembers: number;
  partiallyOnboardedMembers: number;
  pendingMembers: number;
  blockedMembers: number;
  overallProgressPercent: number;
  lastUpdatedAt: string;
}

interface OrgRow {
  organizationId: string;
  organizationName: string;
  teamsCount: number;
  membersCount: number;
  resourcesCount: number;
  credentialsCount: number;
  totpCount: number;
  fullyOnboardedMembers: number;
  partiallyOnboardedMembers: number;
  pendingMembers: number;
  blockedMembers: number;
  progressPercent: number;
  status: OnboardingStatus;
  lastUpdatedAt: string;
}

interface OrgDetail {
  organizationId: string;
  organizationName: string;
  teamsCount: number;
  membersCount: number;
  resourcesCount: number;
  credentialsCount: number;
  totpCount: number;
  membersWithResources: number;
  membersWithCredentials: number;
  membersWithTotp: number;
  unassignedMembers: number;
  fullyOnboardedMembers: number;
  partiallyOnboardedMembers: number;
  pendingMembers: number;
  blockedMembers: number;
  progressPercent: number;
  status: OnboardingStatus;
}

interface MemberRow {
  memberId: string;
  displayLabel: string;
  teamName: string | null;
  roleInOrg: string;
  deviceStatus: string;
  loginStatus: string;
  resourceStatus: AssignmentStatus;
  credentialStatus: AssignmentStatus;
  totpStatus: AssignmentStatus;
  overallStatus: MemberStatus;
  publicMissingItems: string[];
  lastUpdatedAt: string;
}

interface ResourceRow { category: string; count: number; assignedMembersCount: number; status: string; }
interface CredentialRow { category: string; total: number; assigned: number; unassigned: number; membersWithCredentials: number; membersMissingCredentials: number; status: string; }
interface TotpRow { category: string; total: number; assigned: number; unassigned: number; membersWithTotp: number; membersMissingTotp: number; status: string; }
interface MatrixRow {
  memberId: string; displayLabel: string; teamName: string | null;
  requiredResources: number; assignedResources: number; resourceStatus: AssignmentStatus;
  requiredCredentials: number; assignedCredentials: number; credentialStatus: AssignmentStatus;
  requiredTotp: number; assignedTotp: number; totpStatus: AssignmentStatus;
  overallStatus: MemberStatus; publicMissingItems: string[];
}
interface BlockerRow {
  organizationName: string; teamName: string | null; displayLabel: string;
  blockerType: string; description: string; priority: "high" | "medium" | "low"; status: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusColor(s: OnboardingStatus): "success" | "warning" | "error" | "default" {
  if (s === "completed") return "success";
  if (s === "mostly_completed" || s === "in_progress") return "warning";
  if (s === "blocked") return "error";
  return "default";
}
function statusLabel(s: OnboardingStatus): string {
  return { not_started: "Not Started", in_progress: "In Progress", mostly_completed: "Mostly Completed", completed: "Completed", blocked: "Blocked" }[s] ?? s;
}
function memberStatusColor(s: MemberStatus): "success" | "warning" | "error" | "default" {
  if (s === "fully_onboarded") return "success";
  if (s === "partially_onboarded") return "warning";
  if (s === "blocked") return "error";
  return "default";
}
function memberStatusLabel(s: MemberStatus): string {
  return { fully_onboarded: "Fully Onboarded", partially_onboarded: "Partial", pending: "Pending", blocked: "Blocked" }[s] ?? s;
}
function assignmentColor(s: AssignmentStatus): "success" | "warning" | "error" | "default" {
  if (s === "assigned") return "success";
  if (s === "partially_assigned") return "warning";
  if (s === "not_assigned") return "error";
  return "default";
}
function assignmentLabel(s: AssignmentStatus): string {
  return { assigned: "Assigned", partially_assigned: "Partial", not_assigned: "Missing", not_required: "N/A" }[s] ?? s;
}
function priorityColor(p: "high" | "medium" | "low"): "error" | "warning" | "default" {
  if (p === "high") return "error";
  if (p === "medium") return "warning";
  return "default";
}

// ─── SVG Chart components ─────────────────────────────────────────────────────

const CHART_COLORS = {
  success: "#22c55e",
  warning: "#f59e0b",
  pending: "#6366f1",
  error: "#ef4444",
  info: "#3b82f6",
  muted: "#475569",
};

function DonutChart({ data, size = 180, label, sublabel }: {
  data: { value: number; color: string; label: string }[];
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.42, ir = r * 0.58;

  if (total === 0) {
    return (
      <Box sx={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="caption" color="text.disabled">No data</Typography>
      </Box>
    );
  }

  let angle = -Math.PI / 2;
  const segments = data.filter((d) => d.value > 0).map((seg) => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const gapHalf = total > 1 ? 0.025 : 0;
    const a0 = angle + gapHalf, a1 = angle + sweep - gapHalf;
    angle += sweep;
    const largeArc = sweep - 2 * gapHalf > Math.PI ? 1 : 0;
    const d = [
      `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`,
      `L ${cx + ir * Math.cos(a1)} ${cy + ir * Math.sin(a1)}`,
      `A ${ir} ${ir} 0 ${largeArc} 0 ${cx + ir * Math.cos(a0)} ${cy + ir * Math.sin(a0)}`,
      "Z",
    ].join(" ");
    return { d, color: seg.color, label: seg.label, value: seg.value };
  });

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} opacity={0.9} />
        ))}
      </svg>
      {(label || sublabel) && (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          {label && <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1 }}>{label}</Typography>}
          {sublabel && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>{sublabel}</Typography>}
        </Box>
      )}
    </Box>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string; value: number; pct?: number }[] }) {
  return (
    <Stack spacing={0.75}>
      {items.map((item, i) => (
        <Stack key={i} direction="row" alignItems="center" gap={1}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: item.color, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontWeight: 600 }}>{item.label}</Typography>
          <Typography variant="caption" sx={{ fontWeight: 800 }}>{item.value}</Typography>
          {item.pct !== undefined && (
            <Typography variant="caption" color="text.disabled" sx={{ minWidth: 32, textAlign: "right" }}>{item.pct}%</Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function HorizontalBar({ label, value, max, color = CHART_COLORS.info }: {
  label: string; value: number; max: number; color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Stack spacing={0.4}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 800, color }}>{pct}%</Typography>
      </Stack>
      <Box sx={{ height: 8, borderRadius: 4, bgcolor: "action.hover", overflow: "hidden" }}>
        <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </Box>
    </Stack>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, sub, color = "#3b82f6" }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; color?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box sx={{ color, display: "flex" }}>{icon}</Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.08em", fontSize: "0.65rem" }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1, color }}>
          {value}
        </Typography>
        {sub && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value, label, color = "primary" }: { value: number; label: string; color?: "primary" | "success" | "warning" | "error" | "info" }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>{label}</Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>{value}%</Typography>
      </Stack>
      <LinearProgress variant="determinate" value={value} color={color} sx={{ height: 8, borderRadius: 4 }} />
    </Box>
  );
}



function exportCsv(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingProgressPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<BlockerRow[]>([]);

  // Org table filters
  const [orgSearch, setOrgSearch] = useState("");
  const [orgStatusFilter, setOrgStatusFilter] = useState("all");

  // Stats view toggle
  const [statsView, setStatsView] = useState<"progress" | "bar" | "pie">("progress");

  // Inline org expand
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [orgDetailMap, setOrgDetailMap] = useState<Record<string, {
    detail: OrgDetail | null;
    members: MemberRow[];
    resources: { totalResources: number; totalAssignedMembers: number; totalMembers: number; rows: ResourceRow[] } | null;
    credentials: { rows: CredentialRow[] } | null;
    totp: { rows: TotpRow[] } | null;
    matrix: MatrixRow[];
    loading: boolean;
    tab: number;
  }>>({});

  const fetchSummary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sumRes, orgsRes, blockRes] = await Promise.all([
        fetch("/api/public/onboarding/summary"),
        fetch("/api/public/onboarding/organizations"),
        fetch("/api/public/onboarding/blockers"),
      ]);
      if (sumRes.status === 404) { setError("Public onboarding report is not enabled."); return; }
      if (!sumRes.ok || !orgsRes.ok) throw new Error("Failed to load data");
      const [sumData, orgsData, blockData] = await Promise.all([sumRes.json(), orgsRes.json(), blockRes.json()]);
      setSummary(sumData);
      setOrgs(orgsData);
      setBlockers(Array.isArray(blockData) ? blockData : []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load onboarding data");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const loadOrgDetail = useCallback(async (orgId: string) => {
    setOrgDetailMap((prev) => ({
      ...prev,
      [orgId]: { ...(prev[orgId] ?? { detail: null, members: [], resources: null, credentials: null, totp: null, matrix: [], tab: 0 }), loading: true },
    }));
    try {
      const [detRes, membersRes, resRes, credRes, totpRes, matrixRes] = await Promise.all([
        fetch(`/api/public/onboarding/organizations/${orgId}`),
        fetch(`/api/public/onboarding/organizations/${orgId}/members`),
        fetch(`/api/public/onboarding/organizations/${orgId}/resources`),
        fetch(`/api/public/onboarding/organizations/${orgId}/credentials`),
        fetch(`/api/public/onboarding/organizations/${orgId}/totp`),
        fetch(`/api/public/onboarding/organizations/${orgId}/assignment-matrix`),
      ]);
      const [det, members, res, cred, totp, matrix] = await Promise.all([
        detRes.json(), membersRes.json(), resRes.json(), credRes.json(), totpRes.json(), matrixRes.json(),
      ]);
      setOrgDetailMap((prev) => ({
        ...prev,
        [orgId]: { detail: det, members: Array.isArray(members) ? members : [], resources: res, credentials: cred, totp: totp, matrix: Array.isArray(matrix) ? matrix : [], loading: false, tab: prev[orgId]?.tab ?? 0 },
      }));
    } catch {
      setOrgDetailMap((prev) => ({ ...prev, [orgId]: { ...(prev[orgId] ?? { detail: null, members: [], resources: null, credentials: null, totp: null, matrix: [], tab: 0 }), loading: false } }));
    }
  }, []);

  const toggleOrg = useCallback((orgId: string) => {
    setExpandedOrgId((prev) => {
      if (prev === orgId) return null;
      if (!orgDetailMap[orgId]) loadOrgDetail(orgId);
      return orgId;
    });
  }, [orgDetailMap, loadOrgDetail]);

  // Filtered data
  const filteredOrgs = orgs
    .filter((o) => {
      const matchSearch = o.organizationName.toLowerCase().includes(orgSearch.toLowerCase());
      const matchStatus = orgStatusFilter === "all" || o.status === orgStatusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => b.progressPercent - a.progressPercent);

  // Blockers — exclude Login Pending since we don't track logins
  const activeBlockers = blockers.filter((b) => b.blockerType !== "Login Pending");

  // Stats data
  const totalMembers = summary?.totalMembers ?? 0;
  const totalTarget = summary?.totalTeamMembersTarget ?? totalMembers;
  const statusDonutData = summary ? [
    { value: summary.fullyOnboardedMembers, color: CHART_COLORS.success, label: "Fully Onboarded" },
    { value: summary.partiallyOnboardedMembers, color: CHART_COLORS.warning, label: "Partial" },
    { value: summary.pendingMembers, color: CHART_COLORS.pending, label: "Pending" },
    { value: summary.blockedMembers, color: CHART_COLORS.error, label: "Blocked" },
  ] : [];

  const blockerTypeCount = activeBlockers.reduce<Record<string, number>>((acc, b) => {
    acc[b.blockerType] = (acc[b.blockerType] ?? 0) + 1;
    return acc;
  }, {});
  const blockerDonutData = Object.entries(blockerTypeCount).map(([type, count], i) => ({
    value: count,
    color: [CHART_COLORS.error, CHART_COLORS.warning, CHART_COLORS.pending, CHART_COLORS.info][i % 4],
    label: type,
  }));

  const overallStatusValue: OnboardingStatus =
    !summary ? "not_started"
      : summary.overallProgressPercent === 100 ? "completed"
        : summary.overallProgressPercent >= 80 ? "mostly_completed"
          : summary.overallProgressPercent > 0 ? "in_progress"
            : "not_started";

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={48} />
          <Typography color="text.secondary">Loading onboarding data…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
        <Container maxWidth="sm">
          <Alert severity="error" action={<Button onClick={fetchSummary} size="small">Retry</Button>}>{error}</Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ── Header ── */}
      <Box sx={{
        background: "linear-gradient(135deg, #0f172a 0%, #1a2744 60%, #0f2027 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        py: 3.5,
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""', position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 15% 50%, rgba(59,130,246,0.12) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(99,102,241,0.08) 0%, transparent 50%)",
          pointerEvents: "none",
        },
      }}>
        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.75 }}>
                <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: "rgba(59,130,246,0.15)", display: "flex" }}>
                  <TrendingUp size={20} color="#60a5fa" />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.01em" }}>
                  Access Migration Progress
                </Typography>
                <Chip label={statusLabel(overallStatusValue)} color={statusColor(overallStatusValue)} size="small" sx={{ fontWeight: 700, fontSize: "0.7rem" }} />
              </Stack>
              <Typography variant="body2" sx={{ color: "rgba(148,163,184,0.9)", pl: 0.5 }}>
                Public progress overview for{" "}
                <Box component="span" sx={{ color: "#93c5fd", fontWeight: 600 }}>access.codingcops.com</Box>{" "}
                onboarding
              </Typography>
              {summary && (
                <Typography variant="caption" sx={{ mt: 0.5, display: "block", color: "rgba(100,116,139,0.8)", pl: 0.5 }}>
                  Last updated: {new Date(summary.lastUpdatedAt).toLocaleString()}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1.5}>
              <Tooltip title="Refresh data">
                <Button variant="outlined" size="small" startIcon={<RefreshCw size={14} />} onClick={fetchSummary}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none", borderColor: "rgba(255,255,255,0.15)", color: "#cbd5e1", "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.06)" } }}>
                  Refresh
                </Button>
              </Tooltip>
              <Tooltip title="Export summary as CSV">
                <Button variant="contained" size="small" startIcon={<Download size={14} />}
                  onClick={() => exportCsv("onboarding-summary.csv",
                    orgs.map((o) => [o.organizationName, String(o.membersCount), String(o.resourcesCount), String(o.credentialsCount), String(o.totpCount), String(o.fullyOnboardedMembers), String(o.pendingMembers), String(o.progressPercent) + "%", statusLabel(o.status)]),
                    ["Organization", "Members", "Resources", "Credentials", "2FA", "Fully Onboarded", "Pending", "Progress", "Status"]
                  )}
                  sx={{ borderRadius: 2, fontWeight: 700, textTransform: "none", bgcolor: "rgba(59,130,246,0.85)", "&:hover": { bgcolor: "rgba(59,130,246,1)" }, boxShadow: "0 0 20px rgba(59,130,246,0.25)" }}>
                  Export CSV
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* ── Summary Cards ── */}
        {summary && (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Building2 size={18} />} label="ORGANIZATIONS" value={summary.totalOrganizations} color="#3b82f6" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Users size={18} />} label="TEAM MEMBERS" value={`${summary.totalMembers} / ${totalTarget}`} sub={`${totalTarget - summary.totalMembers} not yet added`} color="#3b82f6" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Shield size={18} />} label="RESOURCES" value={summary.totalResources} color="#0ea5e9" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Key size={18} />} label="CREDENTIALS" value={summary.totalCredentials} color="#0ea5e9" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Shield size={18} />} label="2FA ENTRIES" value={summary.totalTotpEntries} color="#0ea5e9" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<CheckCircle2 size={18} />} label="OVERALL PROGRESS" value={`${summary.overallProgressPercent}%`} color="#22c55e" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard icon={<CheckCircle2 size={18} />} label="FULLY ONBOARDED" value={summary.fullyOnboardedMembers}
                  sub={`${totalTarget > 0 ? Math.round((summary.fullyOnboardedMembers / totalTarget) * 100) : 0}% of ${totalTarget} team members`} color="#22c55e" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard icon={<Clock size={18} />} label="PARTIALLY ONBOARDED" value={summary.partiallyOnboardedMembers} color="#f59e0b" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard icon={<AlertTriangle size={18} />} label="PENDING" value={summary.pendingMembers} color="#f59e0b" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard icon={<XCircle size={18} />} label="BLOCKED" value={summary.blockedMembers} color="#ef4444" />
              </Grid>
            </Grid>

            {/* ── Overall Migration Progress — toggleable ── */}
            <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: "0.05em", color: "text.secondary" }}>
                    OVERALL MIGRATION PROGRESS
                  </Typography>
                  <Stack direction="row" spacing={0.5}>
                    {([
                      { view: "progress" as const, icon: <TrendingUp size={14} />, label: "Progress" },
                    ]).map(({ view, icon, label }) => (
                      <Button
                        key={view}
                        size="small"
                        variant={statsView === view ? "contained" : "outlined"}
                        startIcon={icon}
                        onClick={() => setStatsView(view)}
                        sx={{
                          borderRadius: 2, textTransform: "none", fontWeight: 700, fontSize: "0.72rem", py: 0.5, px: 1.25,
                          ...(statsView === view ? { bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" } } : { borderColor: "divider", color: "text.secondary" })
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Stack>
                </Stack>

                {/* Progress bars view */}
                {statsView === "progress" && (
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={2}>
                        <ProgressBar value={summary.overallProgressPercent} label="Overall Progress" color="primary" />
                        <ProgressBar value={totalTarget > 0 ? Math.round((summary.fullyOnboardedMembers / totalTarget) * 100) : 0} label="Team Members Fully Onboarded" color="success" />
                        <ProgressBar value={totalTarget > 0 ? Math.round((summary.partiallyOnboardedMembers / totalTarget) * 100) : 0} label="Team Members Partially Onboarded" color="warning" />
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Stack spacing={2}>
                        <ProgressBar value={totalTarget > 0 ? Math.round((summary.pendingMembers / totalTarget) * 100) : 0} label="Team Members Pending" color="warning" />
                        <ProgressBar value={totalTarget > 0 ? Math.round((summary.blockedMembers / totalTarget) * 100) : 0} label="Team Members Blocked" color="error" />
                        <ProgressBar value={Math.round((orgs.filter((o) => o.status === "completed").length / Math.max(orgs.length, 1)) * 100)} label="Organizations Completed" color="success" />
                      </Stack>
                    </Grid>
                  </Grid>
                )}

                {/* Bar chart view — per-org progress */}
                {statsView === "bar" && (
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 7 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em", display: "block", mb: 1.5 }}>
                        PROGRESS BY ORGANIZATION
                      </Typography>
                      <Stack spacing={1.5}>
                        {[...orgs].sort((a, b) => b.progressPercent - a.progressPercent).map((org) => (
                          <HorizontalBar
                            key={org.organizationId}
                            label={org.organizationName}
                            value={org.progressPercent}
                            max={100}
                            color={org.progressPercent === 100 ? CHART_COLORS.success : org.progressPercent >= 50 ? CHART_COLORS.warning : CHART_COLORS.error}
                          />
                        ))}
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em", display: "block", mb: 1.5 }}>
                        PENDING / BLOCKED BY ORGANIZATION
                      </Typography>
                      <Stack spacing={1.5}>
                        {[...orgs].filter((o) => o.pendingMembers + o.blockedMembers > 0).sort((a, b) => (b.pendingMembers + b.blockedMembers) - (a.pendingMembers + a.blockedMembers)).map((org) => (
                          <Box key={org.organizationId}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{org.organizationName}</Typography>
                              <Stack direction="row" spacing={1}>
                                {org.pendingMembers > 0 && <Typography variant="caption" sx={{ color: CHART_COLORS.warning, fontWeight: 700 }}>{org.pendingMembers} pending</Typography>}
                                {org.blockedMembers > 0 && <Typography variant="caption" sx={{ color: CHART_COLORS.error, fontWeight: 700 }}>{org.blockedMembers} blocked</Typography>}
                              </Stack>
                            </Stack>
                            <Box sx={{ height: 8, borderRadius: 4, bgcolor: "action.hover", overflow: "hidden", display: "flex" }}>
                              <Box sx={{ height: "100%", width: `${org.membersCount > 0 ? (org.pendingMembers / org.membersCount) * 100 : 0}%`, bgcolor: CHART_COLORS.warning }} />
                              <Box sx={{ height: "100%", width: `${org.membersCount > 0 ? (org.blockedMembers / org.membersCount) * 100 : 0}%`, bgcolor: CHART_COLORS.error }} />
                            </Box>
                          </Box>
                        ))}
                        {orgs.every((o) => o.pendingMembers + o.blockedMembers === 0) && (
                          <Stack alignItems="center" sx={{ py: 2 }}>
                            <CheckCircle2 size={28} color="#22c55e" />
                            <Typography variant="caption" color="success.main" sx={{ mt: 0.5, fontWeight: 700 }}>All members onboarded</Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                )}

                {/* Pie chart view — member status + blocker distribution */}
                {statsView === "pie" && (
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em", display: "block", mb: 2 }}>
                        MEMBER ONBOARDING STATUS
                      </Typography>
                      <Stack direction="row" alignItems="center" gap={4}>
                        <DonutChart data={statusDonutData} size={180} label={`${summary.fullyOnboardedMembers}/${totalTarget}`} sublabel="onboarded" />
                        <Box sx={{ flex: 1 }}>
                          <ChartLegend items={[
                            { color: CHART_COLORS.success, label: "Fully Onboarded", value: summary.fullyOnboardedMembers, pct: totalTarget > 0 ? Math.round((summary.fullyOnboardedMembers / totalTarget) * 100) : 0 },
                            { color: CHART_COLORS.warning, label: "Partial", value: summary.partiallyOnboardedMembers, pct: totalTarget > 0 ? Math.round((summary.partiallyOnboardedMembers / totalTarget) * 100) : 0 },
                            { color: CHART_COLORS.pending, label: "Pending", value: summary.pendingMembers, pct: totalTarget > 0 ? Math.round((summary.pendingMembers / totalTarget) * 100) : 0 },
                            { color: CHART_COLORS.error, label: "Blocked", value: summary.blockedMembers, pct: totalTarget > 0 ? Math.round((summary.blockedMembers / totalTarget) * 100) : 0 },
                          ]} />
                        </Box>
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.05em", display: "block", mb: 2 }}>
                        BLOCKER DISTRIBUTION
                      </Typography>
                      {blockerDonutData.length === 0 ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ height: 180 }}>
                          <CheckCircle2 size={40} color="#22c55e" />
                          <Typography variant="body2" color="success.main" sx={{ mt: 1, fontWeight: 700 }}>No open blockers</Typography>
                        </Stack>
                      ) : (
                        <Stack direction="row" alignItems="center" gap={4}>
                          <DonutChart data={blockerDonutData} size={180} label={String(activeBlockers.length)} sublabel="blockers" />
                          <Box sx={{ flex: 1 }}>
                            <ChartLegend items={blockerDonutData.map((d) => ({ color: d.color, label: d.label, value: d.value }))} />
                          </Box>
                        </Stack>
                      )}
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Organizations Table ── */}
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: "0.05em", color: "text.secondary" }}>
                ORGANIZATIONS / PROJECTS
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField size="small" placeholder="Search organization…" value={orgSearch} onChange={(e) => setOrgSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                  sx={{ width: 200, "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Status</InputLabel>
                  <Select value={orgStatusFilter} label="Status" onChange={(e) => setOrgStatusFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="not_started">Not Started</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="mostly_completed">Mostly Completed</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="blocked">Blocked</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", letterSpacing: "0.06em", bgcolor: "action.hover" } }}>
                  <TableCell sx={{ width: 32 }} />
                  <TableCell>ORGANIZATION</TableCell>
                  <TableCell align="center">MEMBERS</TableCell>
                  <TableCell align="center">RESOURCES</TableCell>
                  <TableCell align="center">CREDENTIALS</TableCell>
                  <TableCell align="center">2FA</TableCell>
                  <TableCell align="center">FULLY ONBOARDED</TableCell>
                  <TableCell align="center">PENDING</TableCell>
                  <TableCell>PROGRESS</TableCell>
                  <TableCell align="center">STATUS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrgs.map((org) => {
                  const isExpanded = expandedOrgId === org.organizationId;
                  const detail = orgDetailMap[org.organizationId];

                  return (
                    <React.Fragment key={org.organizationId}>
                      <TableRow
                        hover
                        onClick={() => toggleOrg(org.organizationId)}
                        sx={{
                          cursor: "pointer",
                          bgcolor: isExpanded ? "rgba(59,130,246,0.06)" : undefined,
                          borderLeft: isExpanded ? "3px solid #3b82f6" : "3px solid transparent",
                        }}
                      >
                        <TableCell sx={{ color: "text.secondary", py: 1 }}>
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{org.organizationName}</Typography>
                        </TableCell>
                        <TableCell align="center">{org.membersCount}</TableCell>
                        <TableCell align="center">{org.resourcesCount}</TableCell>
                        <TableCell align="center">{org.credentialsCount}</TableCell>
                        <TableCell align="center">{org.totpCount}</TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ color: "success.main", fontWeight: 700 }}>{org.fullyOnboardedMembers}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ color: org.pendingMembers > 0 ? "warning.main" : "text.secondary", fontWeight: 700 }}>{org.pendingMembers}</Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 130 }}>
                          <Stack spacing={0.5}>
                            <LinearProgress variant="determinate" value={org.progressPercent}
                              color={statusColor(org.status) === "default" ? "primary" : (statusColor(org.status) as any)}
                              sx={{ height: 6, borderRadius: 3 }} />
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{org.progressPercent}%</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={statusLabel(org.status)} color={statusColor(org.status)} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} />
                        </TableCell>
                      </TableRow>

                      {/* ── Inline org detail ── */}
                      <TableRow sx={{ "& td": { p: 0, border: 0 } }}>
                        <TableCell colSpan={10}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 3, bgcolor: "rgba(59,130,246,0.03)", borderBottom: "1px solid", borderColor: "divider" }}>
                              {detail?.loading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>
                              ) : detail?.detail ? (
                                <OrgDetailPanel
                                  org={org}
                                  detail={detail.detail}
                                  members={detail.members}
                                  resources={detail.resources}
                                  credentials={detail.credentials}
                                  totp={detail.totp}
                                  matrix={detail.matrix}
                                  tab={detail.tab}
                                  onTabChange={(t) => setOrgDetailMap((prev) => ({ ...prev, [org.organizationId]: { ...prev[org.organizationId], tab: t } }))}
                                  blockers={activeBlockers.filter((b) => b.organizationName === org.organizationName)}
                                />
                              ) : (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} /></Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
                {filteredOrgs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No organizations match the filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        {/* Footer */}
        <Box sx={{ mt: 4, py: 2, textAlign: "center" }}>
          <Typography variant="caption" color="text.disabled">
            access.codingcops.com · Public Onboarding Progress Report · Read-only · No sensitive data exposed
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

// ─── Inline Org Detail Panel ──────────────────────────────────────────────────

function OrgDetailPanel({ org, detail, members, resources, credentials, totp, matrix, blockers, tab, onTabChange }: {
  org: OrgRow;
  detail: OrgDetail;
  members: MemberRow[];
  resources: any;
  credentials: any;
  totp: any;
  matrix: MatrixRow[];
  blockers: BlockerRow[];
  tab: number;
  onTabChange: (t: number) => void;
}) {
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");

  const filteredMembers = members.filter((m) => {
    const matchSearch = m.displayLabel.toLowerCase().includes(memberSearch.toLowerCase());
    const matchStatus = memberFilter === "all" || m.overallStatus === memberFilter;
    return matchSearch && matchStatus;
  });

  // Matrix lookup by memberId for counts
  const matrixByMember = new Map(matrix.map((r) => [r.memberId, r]));

  // Exclude login-related missing items
  const cleanMissingItems = (items: string[]) => items.filter((i) => !i.toLowerCase().includes("login"));

  return (
    <Box>
      {/* Mini stats */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: "Members", value: detail.membersCount, color: "#3b82f6" },
          { label: "Resources", value: detail.resourcesCount, color: "#0ea5e9" },
          { label: "Credentials", value: detail.credentialsCount, color: "#0ea5e9" },
          { label: "2FA Entries", value: detail.totpCount, color: "#0ea5e9" },
          { label: "With Resources", value: detail.membersWithResources, color: "#22c55e" },
          { label: "With Credentials", value: detail.membersWithCredentials, color: "#22c55e" },
          { label: "With 2FA", value: detail.membersWithTotp, color: "#22c55e" },
          { label: "Fully Onboarded", value: detail.fullyOnboardedMembers, color: "#22c55e" },
          { label: "Pending", value: detail.pendingMembers, color: "#f59e0b" },
          { label: "Blocked", value: detail.blockedMembers, color: "#ef4444" },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 6, sm: 4, md: 2 }}>
            <Box sx={{ p: 1.5, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, textAlign: "center" }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: card.color }}>{card.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: "0.6rem" }}>{card.label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>Progress</Typography>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{detail.progressPercent}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={detail.progressPercent} sx={{ height: 8, borderRadius: 4 }} />
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <Tabs value={tab} onChange={(_, v) => onTabChange(v)} sx={{ mb: 2, "& .MuiTab-root": { textTransform: "none", fontWeight: 700, fontSize: "0.78rem", minHeight: 36 } }} variant="scrollable" scrollButtons="auto">
        <Tab label={`Members (${members.length})`} />
        <Tab label="Resources" />
        <Tab label="Credentials" />
        <Tab label="2FA" />
        <Tab label="Assignment Matrix" />
        <Tab label={`Blockers (${blockers.length})`} />
      </Tabs>

      {/* Members */}
      {tab === 0 && (
        <>
          <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
            <TextField size="small" placeholder="Search member…" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search size={13} /></InputAdornment> }}
              sx={{ width: 200, "& .MuiOutlinedInput-root": { borderRadius: 2 } }} />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={memberFilter} label="Status" onChange={(e) => setMemberFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="fully_onboarded">Fully Onboarded</MenuItem>
                <MenuItem value="partially_onboarded">Partially Onboarded</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="blocked">Blocked</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720, "& .MuiTableCell-root": { py: 1.5 } }}>
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover", whiteSpace: "nowrap" } }}>
                  <TableCell sx={{ minWidth: 150 }}>MEMBER</TableCell>
                  <TableCell sx={{ minWidth: 90 }}>ROLE</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>RESOURCES</TableCell>
                  <TableCell align="center" sx={{ minWidth: 120 }}>CREDENTIALS</TableCell>
                  <TableCell align="center" sx={{ minWidth: 100 }}>2FA</TableCell>
                  <TableCell align="center" sx={{ minWidth: 130 }}>STATUS</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>MISSING ITEMS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredMembers.map((m) => {
                  const mx = matrixByMember.get(m.memberId);
                  return (
                    <TableRow key={m.memberId} hover>
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Tooltip title={m.displayLabel} placement="top-start">
                          <Typography variant="body2" sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.displayLabel}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip label={m.roleInOrg} size="small" variant="outlined" sx={{ fontSize: "0.65rem", fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Stack alignItems="center" spacing={0.25}>
                          {mx && mx.requiredResources > 0 && (
                            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: mx.assignedResources === mx.requiredResources ? "success.main" : mx.assignedResources > 0 ? "warning.main" : "error.main" }}>
                              {mx.assignedResources} / {mx.requiredResources}
                            </Typography>
                          )}
                          <Chip label={assignmentLabel(m.resourceStatus)} color={assignmentColor(m.resourceStatus)} size="small" sx={{ fontSize: "0.6rem", fontWeight: 700, height: 18 }} />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Stack alignItems="center" spacing={0.25}>
                          {mx && mx.requiredCredentials > 0 && (
                            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: mx.assignedCredentials === mx.requiredCredentials ? "success.main" : mx.assignedCredentials > 0 ? "warning.main" : "error.main" }}>
                              {mx.assignedCredentials} / {mx.requiredCredentials}
                            </Typography>
                          )}
                          <Chip label={assignmentLabel(m.credentialStatus)} color={assignmentColor(m.credentialStatus)} size="small" sx={{ fontSize: "0.6rem", fontWeight: 700, height: 18 }} />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Stack alignItems="center" spacing={0.25}>
                          {mx && mx.requiredTotp > 0 && (
                            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, color: mx.assignedTotp === mx.requiredTotp ? "success.main" : mx.assignedTotp > 0 ? "warning.main" : "error.main" }}>
                              {mx.assignedTotp} / {mx.requiredTotp}
                            </Typography>
                          )}
                          <Chip label={assignmentLabel(m.totpStatus)} color={assignmentColor(m.totpStatus)} size="small" sx={{ fontSize: "0.6rem", fontWeight: 700, height: 18 }} />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={memberStatusLabel(m.overallStatus)} color={memberStatusColor(m.overallStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        {cleanMissingItems(m.publicMissingItems).length === 0
                          ? <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>✓ Complete</Typography>
                          : <Stack spacing={0.25}>{cleanMissingItems(m.publicMissingItems).map((item) => <Typography key={item} variant="caption" color="warning.main" sx={{ fontSize: "0.65rem" }}>· {item}</Typography>)}</Stack>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredMembers.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: "text.secondary" }}>No members match the filter.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Resources */}
      {tab === 1 && (!resources || resources.rows?.length === 0 ? (
        <Alert severity="info">No resources configured.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 520, "& .MuiTableCell-root": { py: 1.5 } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover", whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 180 }}>CATEGORY</TableCell>
                <TableCell align="center">ITEMS</TableCell>
                <TableCell align="center" sx={{ minWidth: 180 }}>MEMBERS ASSIGNED</TableCell>
                <TableCell align="center" sx={{ minWidth: 140 }}>COVERAGE</TableCell>
                <TableCell align="center">STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.rows.map((r: ResourceRow) => {
                const total = detail.membersCount;
                const pct = total > 0 ? Math.round((r.assignedMembersCount / total) * 100) : 0;
                const chipColor = r.status === "Fully Assigned" ? "success" : r.status === "Partially Assigned" ? "warning" : "default";
                return (
                  <TableRow key={r.category} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.category}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.count}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Stack alignItems="center" spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: pct === 100 ? "success.main" : pct > 0 ? "warning.main" : "error.main" }}>
                          {r.assignedMembersCount} / {total}
                        </Typography>
                        <Box sx={{ width: 80, height: 4, borderRadius: 2, bgcolor: "action.hover", overflow: "hidden" }}>
                          <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: pct === 100 ? "success.main" : pct > 0 ? "warning.main" : "error.main", borderRadius: 2 }} />
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: pct === 100 ? "success.main" : pct > 0 ? "warning.main" : "error.main" }}>
                        {pct}%
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={r.status} size="small" color={chipColor} sx={{ fontWeight: 700, fontSize: "0.65rem" }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {/* Credentials */}
      {tab === 2 && (!credentials || credentials.rows?.length === 0 ? (
        <Alert severity="info">No credentials configured.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640, "& .MuiTableCell-root": { py: 1.5 } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover", whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 160 }}>CATEGORY</TableCell><TableCell align="center">TOTAL</TableCell><TableCell align="center">ASSIGNED</TableCell><TableCell align="center">UNASSIGNED</TableCell><TableCell align="center">MEMBERS WITH</TableCell><TableCell align="center">MEMBERS MISSING</TableCell><TableCell align="center">STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {credentials.rows.map((r: CredentialRow) => (
                <TableRow key={r.category} hover>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.category}</Typography></TableCell>
                  <TableCell align="center">{r.total}</TableCell>
                  <TableCell align="center"><Typography sx={{ color: "success.main", fontWeight: 700 }}>{r.assigned}</Typography></TableCell>
                  <TableCell align="center"><Typography sx={{ color: r.unassigned > 0 ? "warning.main" : "text.secondary", fontWeight: 700 }}>{r.unassigned}</Typography></TableCell>
                  <TableCell align="center">{r.membersWithCredentials}</TableCell>
                  <TableCell align="center"><Typography sx={{ color: r.membersMissingCredentials > 0 ? "error.main" : "text.secondary", fontWeight: 700 }}>{r.membersMissingCredentials}</Typography></TableCell>
                  <TableCell align="center"><Chip label={r.status} size="small" color={r.status === "Active" ? "success" : r.status === "Not Assigned" ? "error" : "warning"} sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {/* 2FA */}
      {tab === 3 && (!totp || totp.rows?.length === 0 ? (
        <Alert severity="info">No 2FA entries configured.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 680, "& .MuiTableCell-root": { py: 1.5 } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover", whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 160 }}>CATEGORY</TableCell><TableCell align="center">TOTAL</TableCell><TableCell align="center">ACTIVE</TableCell><TableCell align="center">ASSIGNED</TableCell><TableCell align="center">UNASSIGNED</TableCell><TableCell align="center">MEMBERS WITH</TableCell><TableCell align="center">MEMBERS MISSING</TableCell><TableCell align="center">STATUS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {totp.rows.map((r: any) => (
                <TableRow key={r.category} hover>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.category}</Typography></TableCell>
                  <TableCell align="center">{r.total}</TableCell>
                  <TableCell align="center">{r.active}</TableCell>
                  <TableCell align="center"><Typography sx={{ color: "success.main", fontWeight: 700 }}>{r.assigned}</Typography></TableCell>
                  <TableCell align="center"><Typography sx={{ color: r.unassigned > 0 ? "warning.main" : "text.secondary", fontWeight: 700 }}>{r.unassigned}</Typography></TableCell>
                  <TableCell align="center">{r.membersWithTotp}</TableCell>
                  <TableCell align="center"><Typography sx={{ color: r.membersMissingTotp > 0 ? "error.main" : "text.secondary", fontWeight: 700 }}>{r.membersMissingTotp}</Typography></TableCell>
                  <TableCell align="center"><Chip label={r.status} size="small" color={r.status === "Active" ? "success" : r.status === "Not Assigned" ? "error" : "warning"} sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ))}

      {/* Assignment Matrix */}
      {tab === 4 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820, "& .MuiTableCell-root": { py: 1.5 } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover", whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 150 }}>MEMBER</TableCell><TableCell align="center" sx={{ minWidth: 100 }}>RESOURCES</TableCell><TableCell align="center">RES. STATUS</TableCell><TableCell align="center" sx={{ minWidth: 110 }}>CREDENTIALS</TableCell><TableCell align="center">CRED. STATUS</TableCell><TableCell align="center" sx={{ minWidth: 80 }}>2FA</TableCell><TableCell align="center">2FA STATUS</TableCell><TableCell align="center">OVERALL</TableCell><TableCell sx={{ minWidth: 160 }}>MISSING</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {matrix.map((r) => (
                <TableRow key={r.memberId} hover>
                  <TableCell sx={{ maxWidth: 180 }}>
                    <Tooltip title={r.displayLabel} placement="top-start">
                      <Typography variant="body2" sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.displayLabel}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center"><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.assignedResources}/{r.requiredResources}</Typography></TableCell>
                  <TableCell align="center"><Chip label={assignmentLabel(r.resourceStatus)} color={assignmentColor(r.resourceStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                  <TableCell align="center"><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.assignedCredentials}/{r.requiredCredentials}</Typography></TableCell>
                  <TableCell align="center"><Chip label={assignmentLabel(r.credentialStatus)} color={assignmentColor(r.credentialStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                  <TableCell align="center"><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.assignedTotp}/{r.requiredTotp}</Typography></TableCell>
                  <TableCell align="center"><Chip label={assignmentLabel(r.totpStatus)} color={assignmentColor(r.totpStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                  <TableCell align="center"><Chip label={memberStatusLabel(r.overallStatus)} color={memberStatusColor(r.overallStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                  <TableCell>
                    {cleanMissingItems(r.publicMissingItems).length === 0
                      ? <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>✓</Typography>
                      : <Stack spacing={0.25}>{cleanMissingItems(r.publicMissingItems).map((item) => <Typography key={item} variant="caption" color="warning.dark" sx={{ fontSize: "0.65rem" }}>· {item}</Typography>)}</Stack>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Blockers */}
      {tab === 5 && (blockers.length === 0 ? (
        <Alert severity="success">No open blockers for this organization.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 520, "& .MuiTableCell-root": { py: 1.5 } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover", whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 150 }}>MEMBER</TableCell><TableCell sx={{ minWidth: 160 }}>BLOCKER TYPE</TableCell><TableCell>DESCRIPTION</TableCell><TableCell align="center">PRIORITY</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {blockers.map((b, i) => (
                <TableRow key={i} hover>
                  <TableCell sx={{ maxWidth: 180 }}>
                    <Tooltip title={b.displayLabel} placement="top-start">
                      <Typography variant="body2" sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.displayLabel}</Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{b.blockerType}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{b.description}</Typography></TableCell>
                  <TableCell align="center"><Chip label={b.priority.toUpperCase()} color={priorityColor(b.priority)} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ))}
    </Box>
  );
}

function cleanMissingItems(items: string[]): string[] {
  return items.filter((i) => !i.toLowerCase().includes("login"));
}
