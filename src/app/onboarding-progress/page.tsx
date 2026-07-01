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
} from "@mui/material";
import {
  Search,
  RefreshCw,
  Download,
  Building2,
  Users,
  Shield,
  Key,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "mostly_completed"
  | "completed"
  | "blocked";

type MemberStatus = "fully_onboarded" | "partially_onboarded" | "pending" | "blocked";
type AssignmentStatus = "assigned" | "partially_assigned" | "not_assigned" | "not_required";

interface Summary {
  totalOrganizations: number;
  totalTeams: number;
  totalMembers: number;
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

interface TeamRow {
  teamId: string;
  teamName: string;
  totalMembers: number;
  membersWithResources: number;
  membersWithCredentials: number;
  membersWithTotp: number;
  fullyOnboardedMembers: number;
  pendingMembers: number;
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

interface ResourceRow {
  category: string;
  count: number;
  assignedMembersCount: number;
  status: string;
}

interface CredentialRow {
  category: string;
  total: number;
  assigned: number;
  unassigned: number;
  membersWithCredentials: number;
  membersMissingCredentials: number;
  status: string;
}

interface TotpRow {
  category: string;
  total: number;
  assigned: number;
  unassigned: number;
  membersWithTotp: number;
  membersMissingTotp: number;
  status: string;
}

interface MatrixRow {
  memberId: string;
  displayLabel: string;
  teamName: string | null;
  requiredResources: number;
  assignedResources: number;
  resourceStatus: AssignmentStatus;
  requiredCredentials: number;
  assignedCredentials: number;
  credentialStatus: AssignmentStatus;
  requiredTotp: number;
  assignedTotp: number;
  totpStatus: AssignmentStatus;
  overallStatus: MemberStatus;
  publicMissingItems: string[];
}

interface BlockerRow {
  organizationName: string;
  teamName: string | null;
  displayLabel: string;
  blockerType: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: string;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function statusColor(s: OnboardingStatus): "success" | "warning" | "error" | "default" {
  if (s === "completed") return "success";
  if (s === "mostly_completed") return "warning";
  if (s === "in_progress") return "warning";
  if (s === "blocked") return "error";
  return "default";
}

function statusLabel(s: OnboardingStatus): string {
  const map: Record<OnboardingStatus, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    mostly_completed: "Mostly Completed",
    completed: "Completed",
    blocked: "Blocked",
  };
  return map[s] ?? s;
}

function memberStatusColor(s: MemberStatus): "success" | "warning" | "error" | "default" {
  if (s === "fully_onboarded") return "success";
  if (s === "partially_onboarded") return "warning";
  if (s === "blocked") return "error";
  return "default";
}

function memberStatusLabel(s: MemberStatus): string {
  const map: Record<MemberStatus, string> = {
    fully_onboarded: "Fully Onboarded",
    partially_onboarded: "Partial",
    pending: "Pending",
    blocked: "Blocked",
  };
  return map[s] ?? s;
}

function assignmentColor(s: AssignmentStatus): "success" | "warning" | "error" | "default" {
  if (s === "assigned") return "success";
  if (s === "partially_assigned") return "warning";
  if (s === "not_assigned") return "error";
  return "default";
}

function assignmentLabel(s: AssignmentStatus): string {
  const map: Record<AssignmentStatus, string> = {
    assigned: "Assigned",
    partially_assigned: "Partial",
    not_assigned: "Missing",
    not_required: "N/A",
  };
  return map[s] ?? s;
}

function priorityColor(p: "high" | "medium" | "low"): "error" | "warning" | "default" {
  if (p === "high") return "error";
  if (p === "medium") return "warning";
  return "default";
}

function loginStatusColor(s: string): "success" | "warning" | "error" | "default" {
  if (s === "logged_in") return "success";
  if (s === "invited") return "warning";
  if (s === "failed") return "error";
  return "default";
}

function loginStatusLabel(s: string): string {
  const map: Record<string, string> = {
    logged_in: "Active",
    not_logged_in: "Not Logged In",
    invited: "Invited",
    failed: "Failed",
  };
  return map[s] ?? s;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sub,
  color = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  color?: "primary" | "success" | "warning" | "error" | "info";
}) {
  const colorMap = {
    primary: "#1976d2",
    success: "#2e7d32",
    warning: "#ed6c02",
    error: "#d32f2f",
    info: "#0288d1",
  };
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box sx={{ color: colorMap[color], display: "flex" }}>{icon}</Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: "0.08em", fontSize: "0.65rem" }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1, color: colorMap[color] }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressBar({ value, label, color = "primary" }: { value: number; label: string; color?: "primary" | "success" | "warning" | "error" | "info" }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {value}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        color={color}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportCsv(filename: string, rows: string[][], headers: string[]) {
  const lines = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingProgressPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [orgTeams, setOrgTeams] = useState<TeamRow[]>([]);
  const [orgMembers, setOrgMembers] = useState<MemberRow[]>([]);
  const [orgResources, setOrgResources] = useState<{ totalResources: number; totalAssignedMembers: number; totalMembers: number; rows: ResourceRow[] } | null>(null);
  const [orgCredentials, setOrgCredentials] = useState<{ rows: CredentialRow[] } | null>(null);
  const [orgTotp, setOrgTotp] = useState<{ rows: TotpRow[] } | null>(null);
  const [orgMatrix, setOrgMatrix] = useState<MatrixRow[]>([]);
  const [blockers, setBlockers] = useState<BlockerRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState(0);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgStatusFilter, setOrgStatusFilter] = useState("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const loadOrgDetail = useCallback(async (orgId: string) => {
    setDetailLoading(true);
    setDetailTab(0);
    setOrgTeams([]);
    setOrgMembers([]);
    setOrgResources(null);
    setOrgCredentials(null);
    setOrgTotp(null);
    setOrgMatrix([]);
    try {
      const [detRes, teamsRes, membersRes, resRes, credRes, totpRes, matrixRes] = await Promise.all([
        fetch(`/api/public/onboarding/organizations/${orgId}`),
        fetch(`/api/public/onboarding/organizations/${orgId}/teams`),
        fetch(`/api/public/onboarding/organizations/${orgId}/members`),
        fetch(`/api/public/onboarding/organizations/${orgId}/resources`),
        fetch(`/api/public/onboarding/organizations/${orgId}/credentials`),
        fetch(`/api/public/onboarding/organizations/${orgId}/totp`),
        fetch(`/api/public/onboarding/organizations/${orgId}/assignment-matrix`),
      ]);
      const [det, teams, members, res, cred, totp, matrix] = await Promise.all([
        detRes.json(), teamsRes.json(), membersRes.json(),
        resRes.json(), credRes.json(), totpRes.json(), matrixRes.json(),
      ]);
      setOrgDetail(det);
      setOrgTeams(Array.isArray(teams) ? teams : []);
      setOrgMembers(Array.isArray(members) ? members : []);
      setOrgResources(res);
      setOrgCredentials(cred);
      setOrgTotp(totp);
      setOrgMatrix(Array.isArray(matrix) ? matrix : []);
    } catch {
      // keep previous detail
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrgId) loadOrgDetail(selectedOrgId);
  }, [selectedOrgId, loadOrgDetail]);

  const filteredOrgs = orgs.filter((o) => {
    const matchSearch = o.organizationName.toLowerCase().includes(orgSearch.toLowerCase());
    const matchStatus = orgStatusFilter === "all" || o.status === orgStatusFilter;
    return matchSearch && matchStatus;
  });

  const filteredMembers = orgMembers.filter((m) => {
    const matchSearch =
      m.displayLabel.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.teamName ?? "").toLowerCase().includes(memberSearch.toLowerCase());
    const matchStatus = memberStatusFilter === "all" || m.overallStatus === memberStatusFilter;
    return matchSearch && matchStatus;
  });

  const selectedOrg = orgs.find((o) => o.organizationId === selectedOrgId);

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover" }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={48} />
          <Typography color="text.secondary">Loading onboarding data…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "action.hover" }}>
        <Container maxWidth="sm">
          <Alert severity="error" action={<Button onClick={fetchSummary} size="small">Retry</Button>}>{error}</Alert>
        </Container>
      </Box>
    );
  }

  const overallStatusValue: OnboardingStatus =
    !summary ? "not_started"
    : summary.overallProgressPercent === 100 ? "completed"
    : summary.overallProgressPercent >= 80 ? "mostly_completed"
    : summary.overallProgressPercent > 0 ? "in_progress"
    : "not_started";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ── Header ── */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #0f172a 0%, #1a2744 60%, #0f2027 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          py: 3.5,
          position: "relative",
          overflow: "hidden",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 15% 50%, rgba(59,130,246,0.12) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(99,102,241,0.08) 0%, transparent 50%)",
            pointerEvents: "none",
          },
        }}
      >
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
                <Chip
                  label={statusLabel(overallStatusValue)}
                  color={statusColor(overallStatusValue)}
                  size="small"
                  sx={{ fontWeight: 700, fontSize: "0.7rem" }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: "rgba(148,163,184,0.9)", pl: 0.5 }}>
                Public progress overview for{" "}
                <Box component="span" sx={{ color: "#93c5fd", fontWeight: 600 }}>
                  access.codingcops.com
                </Box>{" "}
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
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshCw size={14} />}
                  onClick={fetchSummary}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: "none",
                    borderColor: "rgba(255,255,255,0.15)",
                    color: "#cbd5e1",
                    "&:hover": { borderColor: "rgba(255,255,255,0.3)", bgcolor: "rgba(255,255,255,0.06)" },
                  }}
                >
                  Refresh
                </Button>
              </Tooltip>
              <Tooltip title="Export summary as CSV">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Download size={14} />}
                  onClick={() => {
                    exportCsv(
                      "onboarding-summary.csv",
                      orgs.map((o) => [
                        o.organizationName,
                        String(o.membersCount),
                        String(o.resourcesCount),
                        String(o.credentialsCount),
                        String(o.totpCount),
                        String(o.fullyOnboardedMembers),
                        String(o.pendingMembers),
                        String(o.progressPercent) + "%",
                        statusLabel(o.status),
                      ]),
                      ["Organization", "Members", "Resources", "Credentials", "2FA", "Fully Onboarded", "Pending", "Progress", "Status"]
                    );
                  }}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: "none",
                    bgcolor: "rgba(59,130,246,0.85)",
                    "&:hover": { bgcolor: "rgba(59,130,246,1)" },
                    boxShadow: "0 0 20px rgba(59,130,246,0.25)",
                  }}
                >
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
                <MetricCard icon={<Building2 size={18} />} label="ORGANIZATIONS" value={summary.totalOrganizations} color="primary" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Layers size={18} />} label="TEAMS" value={summary.totalTeams} color="info" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Users size={18} />} label="MEMBERS" value={summary.totalMembers} color="primary" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Shield size={18} />} label="RESOURCES" value={summary.totalResources} color="info" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Key size={18} />} label="CREDENTIALS" value={summary.totalCredentials} color="info" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                <MetricCard icon={<Shield size={18} />} label="2FA ENTRIES" value={summary.totalTotpEntries} color="info" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard
                  icon={<CheckCircle2 size={18} />}
                  label="FULLY ONBOARDED"
                  value={summary.fullyOnboardedMembers}
                  sub={`${summary.totalMembers > 0 ? Math.round((summary.fullyOnboardedMembers / summary.totalMembers) * 100) : 0}% of members`}
                  color="success"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard
                  icon={<Clock size={18} />}
                  label="PARTIALLY ONBOARDED"
                  value={summary.partiallyOnboardedMembers}
                  color="warning"
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard icon={<AlertTriangle size={18} />} label="PENDING" value={summary.pendingMembers} color="warning" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 3 }}>
                <MetricCard icon={<XCircle size={18} />} label="BLOCKED" value={summary.blockedMembers} color="error" />
              </Grid>
            </Grid>

            {/* ── Overall Progress ── */}
            <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2.5, letterSpacing: "0.05em", color: "text.secondary" }}>
                  OVERALL MIGRATION PROGRESS
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={2}>
                      <ProgressBar value={summary.overallProgressPercent} label="Overall Progress" color="primary" />
                      <ProgressBar
                        value={summary.totalMembers > 0 ? Math.round((summary.fullyOnboardedMembers / summary.totalMembers) * 100) : 0}
                        label="Members Fully Onboarded"
                        color="success"
                      />
                      <ProgressBar
                        value={summary.totalMembers > 0 ? Math.round((summary.partiallyOnboardedMembers / summary.totalMembers) * 100) : 0}
                        label="Members Partially Onboarded"
                        color="warning"
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack spacing={2}>
                      <ProgressBar
                        value={summary.totalMembers > 0 ? Math.round(((summary.totalMembers - summary.pendingMembers) / summary.totalMembers) * 100) : 0}
                        label="Setup Started"
                        color="info"
                      />
                      <ProgressBar
                        value={summary.totalMembers > 0 ? Math.round((summary.pendingMembers / summary.totalMembers) * 100) : 0}
                        label="Members Pending"
                        color="warning"
                      />
                      <ProgressBar
                        value={summary.totalMembers > 0 ? Math.round((summary.blockedMembers / summary.totalMembers) * 100) : 0}
                        label="Members Blocked"
                        color="error"
                      />
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Organizations Table ── */}
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: "0.05em", color: "text.secondary" }}>
                ORGANIZATIONS / PROJECTS
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  size="small"
                  placeholder="Search organization…"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                  sx={{ width: 220, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                />
                <FormControl size="small" sx={{ minWidth: 140 }}>
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
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", letterSpacing: "0.06em", bgcolor: "action.hover" } }}>
                    <TableCell>ORGANIZATION</TableCell>
                    <TableCell align="center">TEAMS</TableCell>
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
                  {filteredOrgs.map((org) => (
                    <TableRow
                      key={org.organizationId}
                      hover
                      selected={selectedOrgId === org.organizationId}
                      onClick={() => setSelectedOrgId(org.organizationId === selectedOrgId ? null : org.organizationId)}
                      sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "rgba(59,130,246,0.10)" }, "&.Mui-selected:hover": { bgcolor: "rgba(59,130,246,0.14)" } }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {org.organizationName}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{org.teamsCount}</TableCell>
                      <TableCell align="center">{org.membersCount}</TableCell>
                      <TableCell align="center">{org.resourcesCount}</TableCell>
                      <TableCell align="center">{org.credentialsCount}</TableCell>
                      <TableCell align="center">{org.totpCount}</TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ color: "success.main", fontWeight: 700 }}>
                          {org.fullyOnboardedMembers}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ color: org.pendingMembers > 0 ? "warning.main" : "text.secondary", fontWeight: 700 }}>
                          {org.pendingMembers}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        <Stack spacing={0.5}>
                          <LinearProgress variant="determinate" value={org.progressPercent} color={statusColor(org.status) === "default" ? "primary" : (statusColor(org.status) as "success" | "warning" | "error")} sx={{ height: 6, borderRadius: 3 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>{org.progressPercent}%</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={statusLabel(org.status)} color={statusColor(org.status)} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} />
                      </TableCell>
                    </TableRow>
                  ))}
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
          </CardContent>
        </Card>

        {/* ── Organization Detail ── */}
        {selectedOrg && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {selectedOrg.organizationName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Organization detail — click a row above to change selection
                  </Typography>
                </Box>
                {orgDetail && (
                  <Chip
                    label={statusLabel(orgDetail.status)}
                    color={statusColor(orgDetail.status)}
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Stack>

              {detailLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : orgDetail ? (
                <>
                  {/* Mini summary cards */}
                  <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                    {[
                      { label: "Teams", value: orgDetail.teamsCount, color: "info" as const },
                      { label: "Members", value: orgDetail.membersCount, color: "primary" as const },
                      { label: "Resources", value: orgDetail.resourcesCount, color: "info" as const },
                      { label: "Credentials", value: orgDetail.credentialsCount, color: "info" as const },
                      { label: "2FA Entries", value: orgDetail.totpCount, color: "info" as const },
                      { label: "With Resources", value: orgDetail.membersWithResources, color: "success" as const },
                      { label: "With Credentials", value: orgDetail.membersWithCredentials, color: "success" as const },
                      { label: "With 2FA", value: orgDetail.membersWithTotp, color: "success" as const },
                      { label: "Unassigned", value: orgDetail.unassignedMembers, color: "warning" as const },
                      { label: "Blocked", value: orgDetail.blockedMembers, color: "error" as const },
                    ].map((card) => (
                      <Grid key={card.label} size={{ xs: 6, sm: 4, md: 2 }}>
                        <Box sx={{ p: 1.5, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, textAlign: "center" }}>
                          <Typography
                            variant="h5"
                            sx={{
                              fontWeight: 800,
                              color: card.color === "success" ? "success.main" : card.color === "warning" ? "warning.main" : card.color === "error" ? "error.main" : card.color === "info" ? "info.main" : "primary.main",
                            }}
                          >
                            {card.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: "0.6rem" }}>
                            {card.label}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Overall progress */}
                  <Box sx={{ mb: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        Onboarding Progress
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{orgDetail.progressPercent}%</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={orgDetail.progressPercent} sx={{ height: 10, borderRadius: 5 }} />
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  <Tabs
                    value={detailTab}
                    onChange={(_, v) => setDetailTab(v)}
                    sx={{ mb: 2, "& .MuiTab-root": { textTransform: "none", fontWeight: 700, fontSize: "0.8rem" } }}
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    <Tab label={`Teams (${orgTeams.length})`} />
                    <Tab label={`Members (${orgMembers.length})`} />
                    <Tab label="Resources" />
                    <Tab label="Credentials" />
                    <Tab label="2FA" />
                    <Tab label="Assignment Matrix" />
                    <Tab label={`Blockers (${blockers.filter((b) => b.organizationName === selectedOrg.organizationName).length})`} />
                  </Tabs>

                  {/* ── Teams Tab ── */}
                  <TabPanel value={detailTab} index={0}>
                    {orgTeams.length === 0 ? (
                      <Alert severity="info">No teams configured for this organization.</Alert>
                    ) : (
                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                              <TableCell>TEAM</TableCell>
                              <TableCell align="center">MEMBERS</TableCell>
                              <TableCell align="center">WITH RESOURCES</TableCell>
                              <TableCell align="center">WITH CREDENTIALS</TableCell>
                              <TableCell align="center">WITH 2FA</TableCell>
                              <TableCell align="center">FULLY ONBOARDED</TableCell>
                              <TableCell align="center">PENDING</TableCell>
                              <TableCell>PROGRESS</TableCell>
                              <TableCell align="center">STATUS</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {orgTeams.map((t) => (
                              <TableRow key={t.teamId} hover>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{t.teamName}</Typography></TableCell>
                                <TableCell align="center">{t.totalMembers}</TableCell>
                                <TableCell align="center">{t.membersWithResources}</TableCell>
                                <TableCell align="center">{t.membersWithCredentials}</TableCell>
                                <TableCell align="center">{t.membersWithTotp}</TableCell>
                                <TableCell align="center"><Typography variant="body2" sx={{ color: "success.main", fontWeight: 700 }}>{t.fullyOnboardedMembers}</Typography></TableCell>
                                <TableCell align="center"><Typography variant="body2" sx={{ color: "warning.main", fontWeight: 700 }}>{t.pendingMembers}</Typography></TableCell>
                                <TableCell sx={{ minWidth: 120 }}>
                                  <Stack spacing={0.25}>
                                    <LinearProgress variant="determinate" value={t.progressPercent} sx={{ height: 6, borderRadius: 3 }} />
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{t.progressPercent}%</Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell align="center"><Chip label={statusLabel(t.status)} color={statusColor(t.status)} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </TabPanel>

                  {/* ── Members Tab ── */}
                  <TabPanel value={detailTab} index={1}>
                    <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
                      <TextField
                        size="small"
                        placeholder="Search member or team…"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                        sx={{ width: 240, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                      />
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel>Status</InputLabel>
                        <Select value={memberStatusFilter} label="Status" onChange={(e) => setMemberStatusFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                          <MenuItem value="all">All</MenuItem>
                          <MenuItem value="fully_onboarded">Fully Onboarded</MenuItem>
                          <MenuItem value="partially_onboarded">Partially Onboarded</MenuItem>
                          <MenuItem value="pending">Pending</MenuItem>
                          <MenuItem value="blocked">Blocked</MenuItem>
                        </Select>
                      </FormControl>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download size={13} />}
                        onClick={() =>
                          exportCsv(
                            `members-${selectedOrg.organizationName}.csv`,
                            filteredMembers.map((m) => [
                              m.displayLabel,
                              m.teamName ?? "—",
                              m.roleInOrg,
                              loginStatusLabel(m.loginStatus),
                              assignmentLabel(m.resourceStatus),
                              assignmentLabel(m.credentialStatus),
                              assignmentLabel(m.totpStatus),
                              memberStatusLabel(m.overallStatus),
                              m.publicMissingItems.join("; "),
                            ]),
                            ["Member", "Team", "Role", "Login", "Resources", "Credentials", "2FA", "Status", "Missing Items"]
                          )
                        }
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                            <TableCell>MEMBER</TableCell>
                            <TableCell>TEAM</TableCell>
                            <TableCell>ROLE</TableCell>
                            <TableCell align="center">LOGIN</TableCell>
                            <TableCell align="center">RESOURCES</TableCell>
                            <TableCell align="center">CREDENTIALS</TableCell>
                            <TableCell align="center">2FA</TableCell>
                            <TableCell align="center">STATUS</TableCell>
                            <TableCell>MISSING ITEMS</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredMembers.map((m) => (
                            <TableRow key={m.memberId} hover>
                              <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{m.displayLabel}</Typography></TableCell>
                              <TableCell><Typography variant="body2" color="text.secondary">{m.teamName ?? "—"}</Typography></TableCell>
                              <TableCell><Chip label={m.roleInOrg} size="small" variant="outlined" sx={{ fontSize: "0.65rem", fontWeight: 600 }} /></TableCell>
                              <TableCell align="center"><Chip label={loginStatusLabel(m.loginStatus)} color={loginStatusColor(m.loginStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center"><Chip label={assignmentLabel(m.resourceStatus)} color={assignmentColor(m.resourceStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center"><Chip label={assignmentLabel(m.credentialStatus)} color={assignmentColor(m.credentialStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center"><Chip label={assignmentLabel(m.totpStatus)} color={assignmentColor(m.totpStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center"><Chip label={memberStatusLabel(m.overallStatus)} color={memberStatusColor(m.overallStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell>
                                {m.publicMissingItems.length === 0 ? (
                                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>✓ Complete</Typography>
                                ) : (
                                  <Stack spacing={0.25}>
                                    {m.publicMissingItems.map((item) => (
                                      <Typography key={item} variant="caption" color="warning.dark" sx={{ fontSize: "0.65rem" }}>
                                        · {item}
                                      </Typography>
                                    ))}
                                  </Stack>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredMembers.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>No members match the filter.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </TabPanel>

                  {/* ── Resources Tab ── */}
                  <TabPanel value={detailTab} index={2}>
                    {!orgResources || orgResources.rows.length === 0 ? (
                      <Alert severity="info">No resources configured.</Alert>
                    ) : (
                      <>
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                          <Chip label={`${orgResources.totalResources} total resources`} variant="outlined" />
                          <Chip label={`${orgResources.totalAssignedMembers} of ${orgResources.totalMembers} members assigned`} color={orgResources.totalAssignedMembers === orgResources.totalMembers ? "success" : "warning"} />
                        </Stack>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                                <TableCell>CATEGORY</TableCell>
                                <TableCell align="center">COUNT</TableCell>
                                <TableCell align="center">ASSIGNED MEMBERS</TableCell>
                                <TableCell align="center">STATUS</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {orgResources.rows.map((r) => (
                                <TableRow key={r.category} hover>
                                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.category}</Typography></TableCell>
                                  <TableCell align="center">{r.count}</TableCell>
                                  <TableCell align="center">{r.assignedMembersCount}</TableCell>
                                  <TableCell align="center"><Chip label={r.status} size="small" color={r.status === "Fully Assigned" ? "success" : r.status === "Partially Assigned" ? "warning" : "default"} sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </>
                    )}
                  </TabPanel>

                  {/* ── Credentials Tab ── */}
                  <TabPanel value={detailTab} index={3}>
                    {!orgCredentials || orgCredentials.rows.length === 0 ? (
                      <Alert severity="info">No credentials configured.</Alert>
                    ) : (
                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                              <TableCell>CATEGORY</TableCell>
                              <TableCell align="center">TOTAL</TableCell>
                              <TableCell align="center">ASSIGNED</TableCell>
                              <TableCell align="center">UNASSIGNED</TableCell>
                              <TableCell align="center">MEMBERS WITH</TableCell>
                              <TableCell align="center">MEMBERS MISSING</TableCell>
                              <TableCell align="center">STATUS</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {orgCredentials.rows.map((r) => (
                              <TableRow key={r.category} hover>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.category}</Typography></TableCell>
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
                    )}
                  </TabPanel>

                  {/* ── 2FA Tab ── */}
                  <TabPanel value={detailTab} index={4}>
                    {!orgTotp || orgTotp.rows.length === 0 ? (
                      <Alert severity="info">No 2FA entries configured.</Alert>
                    ) : (
                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                              <TableCell>CATEGORY</TableCell>
                              <TableCell align="center">TOTAL</TableCell>
                              <TableCell align="center">ACTIVE</TableCell>
                              <TableCell align="center">ASSIGNED</TableCell>
                              <TableCell align="center">UNASSIGNED</TableCell>
                              <TableCell align="center">MEMBERS WITH</TableCell>
                              <TableCell align="center">MEMBERS MISSING</TableCell>
                              <TableCell align="center">STATUS</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {orgTotp.rows.map((r: any) => (
                              <TableRow key={r.category} hover>
                                <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.category}</Typography></TableCell>
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
                    )}
                  </TabPanel>

                  {/* ── Assignment Matrix Tab ── */}
                  <TabPanel value={detailTab} index={5}>
                    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download size={13} />}
                        onClick={() =>
                          exportCsv(
                            `matrix-${selectedOrg.organizationName}.csv`,
                            orgMatrix.map((r) => [
                              r.displayLabel,
                              r.teamName ?? "—",
                              String(r.assignedResources) + "/" + String(r.requiredResources),
                              assignmentLabel(r.resourceStatus),
                              String(r.assignedCredentials) + "/" + String(r.requiredCredentials),
                              assignmentLabel(r.credentialStatus),
                              String(r.assignedTotp) + "/" + String(r.requiredTotp),
                              assignmentLabel(r.totpStatus),
                              memberStatusLabel(r.overallStatus),
                              r.publicMissingItems.join("; "),
                            ]),
                            ["Member", "Team", "Resources", "Resource Status", "Credentials", "Cred Status", "2FA", "2FA Status", "Overall", "Missing"]
                          )
                        }
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }}
                      >
                        Export CSV
                      </Button>
                    </Stack>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                            <TableCell>MEMBER</TableCell>
                            <TableCell>TEAM</TableCell>
                            <TableCell align="center">RESOURCES</TableCell>
                            <TableCell align="center">RES. STATUS</TableCell>
                            <TableCell align="center">CREDENTIALS</TableCell>
                            <TableCell align="center">CRED. STATUS</TableCell>
                            <TableCell align="center">2FA</TableCell>
                            <TableCell align="center">2FA STATUS</TableCell>
                            <TableCell align="center">OVERALL</TableCell>
                            <TableCell>MISSING</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {orgMatrix.map((r) => (
                            <TableRow key={r.memberId} hover>
                              <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{r.displayLabel}</Typography></TableCell>
                              <TableCell><Typography variant="body2" color="text.secondary">{r.teamName ?? "—"}</Typography></TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {r.assignedResources}/{r.requiredResources}
                                </Typography>
                              </TableCell>
                              <TableCell align="center"><Chip label={assignmentLabel(r.resourceStatus)} color={assignmentColor(r.resourceStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {r.assignedCredentials}/{r.requiredCredentials}
                                </Typography>
                              </TableCell>
                              <TableCell align="center"><Chip label={assignmentLabel(r.credentialStatus)} color={assignmentColor(r.credentialStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {r.assignedTotp}/{r.requiredTotp}
                                </Typography>
                              </TableCell>
                              <TableCell align="center"><Chip label={assignmentLabel(r.totpStatus)} color={assignmentColor(r.totpStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell align="center"><Chip label={memberStatusLabel(r.overallStatus)} color={memberStatusColor(r.overallStatus)} size="small" sx={{ fontSize: "0.65rem", fontWeight: 700 }} /></TableCell>
                              <TableCell>
                                {r.publicMissingItems.length === 0 ? (
                                  <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>✓</Typography>
                                ) : (
                                  <Stack spacing={0.25}>
                                    {r.publicMissingItems.map((item) => (
                                      <Typography key={item} variant="caption" color="warning.dark" sx={{ fontSize: "0.65rem" }}>· {item}</Typography>
                                    ))}
                                  </Stack>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </TabPanel>

                  {/* ── Blockers Tab ── */}
                  <TabPanel value={detailTab} index={6}>
                    {(() => {
                      const orgBlockers = blockers.filter((b) => b.organizationName === selectedOrg.organizationName);
                      return orgBlockers.length === 0 ? (
                        <Alert severity="success">No open blockers for this organization.</Alert>
                      ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                                <TableCell>MEMBER</TableCell>
                                <TableCell>TEAM</TableCell>
                                <TableCell>BLOCKER TYPE</TableCell>
                                <TableCell>DESCRIPTION</TableCell>
                                <TableCell align="center">PRIORITY</TableCell>
                                <TableCell align="center">STATUS</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {orgBlockers.map((b, i) => (
                                <TableRow key={i} hover>
                                  <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{b.displayLabel}</Typography></TableCell>
                                  <TableCell><Typography variant="body2" color="text.secondary">{b.teamName ?? "—"}</Typography></TableCell>
                                  <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{b.blockerType}</Typography></TableCell>
                                  <TableCell><Typography variant="body2" color="text.secondary">{b.description}</Typography></TableCell>
                                  <TableCell align="center"><Chip label={b.priority.toUpperCase()} color={priorityColor(b.priority)} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                                  <TableCell align="center"><Chip label="Open" color="warning" size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      );
                    })()}
                  </TabPanel>
                </>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* ── All Blockers Summary ── */}
        {blockers.length > 0 && !selectedOrgId && (
          <Card variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, letterSpacing: "0.05em", color: "text.secondary" }}>
                ALL OPEN BLOCKERS ({blockers.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.7rem", color: "text.secondary", bgcolor: "action.hover" } }}>
                      <TableCell>ORGANIZATION</TableCell>
                      <TableCell>TEAM</TableCell>
                      <TableCell>MEMBER</TableCell>
                      <TableCell>BLOCKER TYPE</TableCell>
                      <TableCell>DESCRIPTION</TableCell>
                      <TableCell align="center">PRIORITY</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {blockers.slice(0, 25).map((b, i) => (
                      <TableRow key={i} hover>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{b.organizationName}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{b.teamName ?? "—"}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{b.displayLabel}</Typography></TableCell>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{b.blockerType}</Typography></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{b.description}</Typography></TableCell>
                        <TableCell align="center"><Chip label={b.priority.toUpperCase()} color={priorityColor(b.priority)} size="small" sx={{ fontWeight: 700, fontSize: "0.65rem" }} /></TableCell>
                      </TableRow>
                    ))}
                    {blockers.length > 25 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 1.5 }}>
                          + {blockers.length - 25} more blockers — select an organization above to see its full list
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

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
