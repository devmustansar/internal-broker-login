"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import {
  Building2,
  ChevronDown,
  Database,
  ExternalLink,
  KeyRound,
  Search,
  Settings2,
  ShieldEllipsis,
  Users,
  Zap,
} from "lucide-react";

interface OverviewUser { id: string; name: string; email: string }
interface OverviewResource {
  id: string; kind: "web" | "aws"; resourceKey: string; name: string;
  environment: string; isActive: boolean; detail: string; users: OverviewUser[];
}
interface OverviewCredential {
  id: string; appName: string; loginUrl: string | null; groups: string[]; users: OverviewUser[];
}
interface OverviewTwoFactor {
  id: string; appName: string; issuer: string | null; accountLabel: string | null; users: OverviewUser[];
}
interface OverviewOrg {
  id: string; name: string; description: string | null;
  members: (OverviewUser & { role: string })[];
  resources: OverviewResource[]; credentials: OverviewCredential[]; twoFactor: OverviewTwoFactor[];
}
interface OverviewData {
  totals: { organizations: number; resources: number; credentials: number; twoFactor: number; users: number };
  organizations: OverviewOrg[];
}

/** Admin console tab indices (see AdminPanel). */
export type AdminTarget = "resources" | "identities" | "organizations" | "credentials" | "2fa";

function UserChips({ users }: { users: OverviewUser[] }) {
  if (users.length === 0) {
    return <Typography variant="caption" sx={{ color: "text.secondary" }}>No one has access</Typography>;
  }
  return (
    <Stack direction="row" flexWrap="wrap" gap={0.75}>
      {users.map((u) => (
        <Tooltip key={u.id} title={u.email}>
          <Chip size="small" label={u.name || u.email} variant="outlined" sx={{ fontSize: "0.7rem", fontWeight: 600 }} />
        </Tooltip>
      ))}
    </Stack>
  );
}

function Row({ title, subtitle, chips, actions, users }: {
  title: string; subtitle?: string | null; chips?: React.ReactNode; actions?: React.ReactNode; users: OverviewUser[];
}) {
  const theme = useTheme();
  return (
    <Box sx={{ p: 2, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.35) }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 1.25 }}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 800 }}>{title}</Typography>
            {chips}
          </Stack>
          {subtitle && <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{subtitle}</Typography>}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">{actions}</Stack>
      </Box>
      <Typography variant="caption" sx={{ display: "block", mb: 0.75, fontWeight: 800, color: "text.secondary", letterSpacing: "0.08em" }}>
        {users.length} {users.length === 1 ? "USER" : "USERS"} WITH ACCESS
      </Typography>
      <UserChips users={users} />
    </Box>
  );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        {icon}
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{title}</Typography>
        <Chip size="small" label={count} sx={{ height: 20, fontWeight: 800 }} />
      </Stack>
      {count === 0 ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>None</Typography>
      ) : (
        <Stack spacing={1.5}>{children}</Stack>
      )}
    </Box>
  );
}

export default function SuperAdminOverview({ onManage }: { onManage: (target: AdminTarget) => void }) {
  const theme = useTheme();
  const { openApp, launchAwsConsole } = useApp();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Failed to load overview");
        setData(body);
      })
      .catch((e) => setError(e.message));
  }, []);

  const handleOpen = async (r: OverviewResource) => {
    setLaunching(r.id);
    setLaunchError(null);
    try {
      if (r.kind === "aws") {
        const res = await launchAwsConsole(r.resourceKey);
        window.open(res.loginUrl, "_blank");
      } else {
        const res = await openApp(r.resourceKey);
        if (res.redirectUrl) window.open(res.redirectUrl, "_blank");
      }
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : "Failed to open resource");
    } finally {
      setLaunching(null);
    }
  };

  // Search matches org, item names and the people with access.
  const orgs = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.organizations;
    const hitUser = (u: OverviewUser) => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return data.organizations
      .map((o) => {
        if (o.name.toLowerCase().includes(q)) return o;
        const resources = o.resources.filter((r) => r.name.toLowerCase().includes(q) || r.resourceKey.toLowerCase().includes(q) || r.users.some(hitUser));
        const credentials = o.credentials.filter((c) => c.appName.toLowerCase().includes(q) || c.users.some(hitUser));
        const twoFactor = o.twoFactor.filter((t) => t.appName.toLowerCase().includes(q) || t.users.some(hitUser));
        return resources.length || credentials.length || twoFactor.length ? { ...o, resources, credentials, twoFactor } : null;
      })
      .filter(Boolean) as OverviewOrg[];
  }, [data, search]);

  if (error) return <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>;
  if (!data) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={90} sx={{ borderRadius: 4 }} />
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: 4 }} />
      </Stack>
    );
  }

  const stats = [
    { label: "Organizations", value: data.totals.organizations, icon: <Building2 size={18} /> },
    { label: "Resources", value: data.totals.resources, icon: <Zap size={18} /> },
    { label: "Shared credentials", value: data.totals.credentials, icon: <KeyRound size={18} /> },
    { label: "2FA entries", value: data.totals.twoFactor, icon: <ShieldEllipsis size={18} /> },
    { label: "Users", value: data.totals.users, icon: <Users size={18} /> },
  ];

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {stats.map((s) => (
          <Grid size={{ xs: 6, md: 12 / 5 }} key={s.label}>
            <Paper elevation={1} sx={{ p: 2.5, borderRadius: 4 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary", mb: 1 }}>
                {s.icon}
                <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: "0.08em" }}>{s.label.toUpperCase()}</Typography>
              </Stack>
              <Typography variant="h3" sx={{ fontWeight: 800 }}>{s.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <TextField
        fullWidth
        size="small"
        placeholder="Search organizations, resources, credentials, 2FA or a person…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment> }}
        sx={{ mb: 3, "& .MuiInputBase-root": { borderRadius: 3 } }}
      />

      {launchError && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }} onClose={() => setLaunchError(null)}>{launchError}</Alert>}

      {orgs.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 6 }}>Nothing matches your search.</Typography>
      ) : (
        orgs.map((o) => (
          <Accordion key={o.id} disableGutters defaultExpanded={orgs.length === 1 || !!search.trim()} sx={{ mb: 2, borderRadius: "16px !important", "&:before": { display: "none" }, border: `1px solid ${theme.palette.divider}` }}>
            <AccordionSummary expandIcon={<ChevronDown size={18} />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", width: "100%", pr: 2 }}>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{o.name}</Typography>
                  {o.description && <Typography variant="caption" sx={{ color: "text.secondary" }}>{o.description}</Typography>}
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" icon={<Users size={13} />} label={`${o.members.length} members`} />
                  <Chip size="small" icon={<Zap size={13} />} label={`${o.resources.length} resources`} />
                  <Chip size="small" icon={<KeyRound size={13} />} label={`${o.credentials.length} credentials`} />
                  <Chip size="small" icon={<ShieldEllipsis size={13} />} label={`${o.twoFactor.length} 2FA`} />
                </Stack>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Section icon={<Zap size={16} />} title="Resources" count={o.resources.length}>
                {o.resources.map((r) => (
                  <Row
                    key={r.id}
                    title={r.name}
                    subtitle={`${r.resourceKey} · ${r.detail}`}
                    users={r.users}
                    chips={
                      <>
                        <Chip size="small" label={r.kind === "aws" ? "AWS" : "Web"} sx={{ height: 20, fontSize: "0.65rem", fontWeight: 800 }} />
                        <Chip size="small" variant="outlined" label={r.environment} sx={{ height: 20, fontSize: "0.65rem" }} />
                        {!r.isActive && <Chip size="small" color="warning" label="Inactive" sx={{ height: 20, fontSize: "0.65rem" }} />}
                      </>
                    }
                    actions={
                      <>
                        <Button size="small" variant="outlined" disabled={!r.isActive || launching === r.id} startIcon={<ExternalLink size={13} />} onClick={() => handleOpen(r)}>
                          {launching === r.id ? "Opening…" : "Open"}
                        </Button>
                        <Button size="small" startIcon={<Settings2 size={13} />} onClick={() => onManage("resources")}>Manage</Button>
                      </>
                    }
                  />
                ))}
              </Section>

              <Section icon={<Database size={16} />} title="Shared credentials" count={o.credentials.length}>
                {o.credentials.map((c) => (
                  <Row
                    key={c.id}
                    title={c.appName}
                    subtitle={c.loginUrl}
                    users={c.users}
                    chips={c.groups.map((g) => <Chip key={g} size="small" variant="outlined" label={g} sx={{ height: 20, fontSize: "0.65rem" }} />)}
                    actions={<Button size="small" startIcon={<Settings2 size={13} />} onClick={() => onManage("credentials")}>Manage</Button>}
                  />
                ))}
              </Section>

              <Section icon={<ShieldEllipsis size={16} />} title="2FA entries" count={o.twoFactor.length}>
                {o.twoFactor.map((t) => (
                  <Row
                    key={t.id}
                    title={t.appName}
                    subtitle={[t.issuer, t.accountLabel].filter(Boolean).join(" · ") || null}
                    users={t.users}
                    actions={<Button size="small" startIcon={<Settings2 size={13} />} onClick={() => onManage("2fa")}>Manage</Button>}
                  />
                ))}
              </Section>

              {o.id !== "__unassigned__" && (
                <Section icon={<Users size={16} />} title="Members" count={o.members.length}>
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {o.members.map((m) => (
                      <Tooltip key={m.id} title={m.email}>
                        <Chip size="small" label={`${m.name || m.email} · ${m.role}`} variant="outlined" sx={{ fontSize: "0.7rem", fontWeight: 600 }} />
                      </Tooltip>
                    ))}
                  </Stack>
                </Section>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </Box>
  );
}
