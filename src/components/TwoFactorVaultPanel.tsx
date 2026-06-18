"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Select, MenuItem,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Alert, Tabs, Tab, List, ListItem, ListItemText,
  ListItemSecondaryAction, Grid, Autocomplete, TablePagination, InputAdornment,
  Divider, Switch, FormControlLabel, Tooltip, Checkbox,
} from "@mui/material";
import {
  Plus, X, Lock, Users, Search, Upload, ShieldCheck, Eye, EyeOff,
  RefreshCw, QrCode, Link2, KeyRound, Clock, ClipboardList, FileStack,
} from "lucide-react";
import { useApp } from "@/lib/app-context";

const PAGE_OPTIONS = [10, 25, 50];
const ENVIRONMENTS = ["production", "staging", "development"];
const ALGORITHMS = ["SHA1", "SHA256", "SHA512"];

const EMPTY_FORM = {
  appName: "", issuer: "", accountLabel: "", secret: "", algorithm: "SHA1",
  digits: "6", period: "30", category: "", environment: "production",
  notes: "", allowNotesForUsers: false, status: "active",
  resourceId: "", awsResourceId: "", credentialId: "",
};

export default function TwoFactorVaultPanel({
  onSuccess, onError,
}: {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { user } = useApp();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgMembers, setOrgMembers] = useState<any[]>([]);

  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // For association dropdowns
  const [orgResources, setOrgResources] = useState<any[]>([]);
  const [orgAwsResources, setOrgAwsResources] = useState<any[]>([]);
  const [orgCredentials, setOrgCredentials] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterEnv, setFilterEnv] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(PAGE_OPTIONS[0]);

  // Add / Edit dialog
  const [openForm, setOpenForm] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [inputMode, setInputMode] = useState<"manual" | "uri" | "qr">("qr");
  const [qrParsed, setQrParsed] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showSecret, setShowSecret] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [qrParsing, setQrParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage dialog
  const [manageEntry, setManageEntry] = useState<any>(null);
  const [manageTab, setManageTab] = useState(0);
  const [manageLoading, setManageLoading] = useState(false);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Assignment
  const [assignUser, setAssignUser] = useState<any>(null);
  const [assigning, setAssigning] = useState(false);
  const [bulkSelectAll, setBulkSelectAll] = useState(false);

  // Linked To tab state
  const [assocType, setAssocType] = useState<"resource" | "aws" | "credential">("resource");
  const [assocTarget, setAssocTarget] = useState<any>(null);
  const [associating, setAssociating] = useState(false);

  // Rotate secret dialog
  const [openRotate, setOpenRotate] = useState(false);
  const [rotateSecret, setRotateSecret] = useState("");
  const [showRotateSecret, setShowRotateSecret] = useState(false);
  const [rotating, setRotating] = useState(false);

  // Migration import dialog
  const [openMigration, setOpenMigration] = useState(false);
  const [migrationEntries, setMigrationEntries] = useState<any[]>([]);
  const [migrationSkipped, setMigrationSkipped] = useState(0);
  const [migrationSelected, setMigrationSelected] = useState<Set<number>>(new Set());
  const [migrationCategory, setMigrationCategory] = useState("");
  const [migrationEnvironment, setMigrationEnvironment] = useState("production");
  const [migrationNotes, setMigrationNotes] = useState("");
  const [migrationAllowNotes, setMigrationAllowNotes] = useState(false);
  const [migrationResourceId, setMigrationResourceId] = useState("");
  const [migrationAwsResourceId, setMigrationAwsResourceId] = useState("");
  const [migrationCredentialId, setMigrationCredentialId] = useState("");
  const [importingMigration, setImportingMigration] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);
  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) setSelectedOrgId(organizations[0].id);
  }, [organizations]);
  useEffect(() => {
    if (selectedOrgId) { fetchEntries(); fetchOrgMembers(); fetchOrgAssociables(); }
    setPage(0);
  }, [selectedOrgId, search, filterCategory, filterEnv, filterStatus, rowsPerPage]);
  useEffect(() => { if (selectedOrgId) fetchEntries(); }, [page]);

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      if (res.ok) setOrganizations(await res.json());
    } catch { /**/ }
  };

  const fetchOrgMembers = async () => {
    if (!selectedOrgId) return;
    try {
      const res = await fetch(`/api/admin/organizations/members?organizationId=${selectedOrgId}`);
      if (res.ok) setOrgMembers(await res.json());
    } catch { /**/ }
  };

  const fetchOrgAssociables = async () => {
    if (!selectedOrgId) return;
    try {
      const [webRes, awsRes, credRes] = await Promise.all([
        fetch(`/api/admin/apps?organizationId=${selectedOrgId}`),
        fetch(`/api/admin/aws/resources?organizationId=${selectedOrgId}`),
        fetch(`/api/admin/credentials?organizationId=${selectedOrgId}`),
      ]);
      if (webRes.ok) setOrgResources(await webRes.json());
      if (awsRes.ok) setOrgAwsResources(await awsRes.json());
      if (credRes.ok) setOrgCredentials(await credRes.json());
    } catch { /**/ }
  };

  const fetchEntries = async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        organizationId: selectedOrgId,
        page: String(page),
        pageSize: String(rowsPerPage),
        ...(search ? { search } : {}),
        ...(filterCategory ? { category: filterCategory } : {}),
        ...(filterEnv ? { environment: filterEnv } : {}),
        ...(filterStatus ? { status: filterStatus } : {}),
      });
      const res = await fetch(`/api/admin/2fa?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.items);
        setTotal(data.total);
      }
    } catch { /**/ } finally { setLoading(false); }
  };

  const openManage = async (id: string) => {
    setManageLoading(true);
    setManageTab(0);
    setAccessLogs([]);
    try {
      const res = await fetch(`/api/admin/2fa/${id}`);
      if (!res.ok) throw new Error("Failed to load entry");
      setManageEntry(await res.json());
    } catch (e: any) { onError(e.message); } finally { setManageLoading(false); }
  };

  const loadAccessLogs = async (id: string) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/admin/2fa/${id}/access-log`);
      if (res.ok) setAccessLogs(await res.json());
    } catch { /**/ } finally { setLogsLoading(false); }
  };

  const handleTabChange = (_: any, v: number) => {
    setManageTab(v);
    if (v === 2 && manageEntry) loadAccessLogs(manageEntry.id);
  };

  useEffect(() => {
    setAssocType("resource");
    setAssocTarget(null);
  }, [manageEntry?.id]);

  const openAdd = () => {
    setEditEntry(null);
    setForm({ ...EMPTY_FORM });
    setInputMode("qr");
    setQrParsed(false);
    setShowSecret(false);
    setOpenForm(true);
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setForm({
      appName: entry.appName, issuer: entry.issuer ?? "", accountLabel: entry.accountLabel ?? "",
      secret: "", algorithm: entry.algorithm, digits: String(entry.digits),
      period: String(entry.period), category: entry.category ?? "",
      environment: entry.environment ?? "production", notes: entry.notes ?? "",
      allowNotesForUsers: entry.allowNotesForUsers, status: entry.status,
      resourceId: entry.resourceId ?? "", awsResourceId: entry.awsResourceId ?? "",
      credentialId: entry.credentialId ?? "",
    });
    setInputMode("manual");
    setShowSecret(false);
    setOpenForm(true);
    setManageEntry(null);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrParsing(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/admin/2fa/qr-parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse QR code");

      if (data.type === "migration") {
        setMigrationEntries(data.entries);
        setMigrationSkipped(data.skippedHotp ?? 0);
        setMigrationSelected(new Set(data.entries.map((_: any, i: number) => i)));
        setOpenForm(false);
        setOpenMigration(true);
        return;
      }

      // Standard TOTP
      setForm(prev => ({
        ...prev,
        appName: data.issuer ?? data.accountLabel ?? prev.appName,
        secret: data.secret,
        issuer: data.issuer ?? prev.issuer,
        accountLabel: data.accountLabel ?? prev.accountLabel,
        algorithm: data.algorithm ?? "SHA1",
        digits: String(data.digits ?? 6),
        period: String(data.period ?? 30),
      }));
      setQrParsed(true);
      onSuccess("QR code parsed — review fields and save.");
    } catch (e: any) { onError(e.message); } finally {
      setQrParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUriPaste = async (uri: string) => {
    const trimmed = uri.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("otpauth-migration://")) {
      onError("Google Authenticator migration URIs can't be pasted as text — upload the QR code image instead.");
      return;
    }

    if (!trimmed.startsWith("otpauth://totp/")) return;
    try {
      const withoutScheme = trimmed.slice("otpauth://totp/".length);
      const qi = withoutScheme.indexOf("?");
      const label = decodeURIComponent(qi === -1 ? withoutScheme : withoutScheme.slice(0, qi));
      const qs = qi === -1 ? "" : withoutScheme.slice(qi + 1);
      const p = new URLSearchParams(qs);
      const ci = label.indexOf(":");
      setForm(prev => ({
        ...prev,
        secret: p.get("secret")?.toUpperCase() ?? prev.secret,
        issuer: p.get("issuer") ?? (ci !== -1 ? label.slice(0, ci).trim() : prev.issuer),
        accountLabel: ci !== -1 ? label.slice(ci + 1).trim() : label.trim(),
        algorithm: p.get("algorithm")?.toUpperCase() ?? "SHA1",
        digits: p.get("digits") ?? "6",
        period: p.get("period") ?? "30",
      }));
    } catch { /**/ }
  };

  const handleSave = async () => {
    if (!form.appName.trim()) { onError("App name is required"); return; }
    if (!editEntry && !form.secret.trim()) { onError("Secret is required"); return; }
    setSavingForm(true);
    try {
      const body: any = {
        organizationId: selectedOrgId,
        appName: form.appName,
        issuer: form.issuer || null,
        accountLabel: form.accountLabel || null,
        algorithm: form.algorithm,
        digits: parseInt(form.digits),
        period: parseInt(form.period),
        category: form.category || null,
        environment: form.environment || null,
        notes: form.notes || null,
        allowNotesForUsers: form.allowNotesForUsers,
        status: form.status,
        resourceId: form.resourceId || null,
        awsResourceId: form.awsResourceId || null,
        credentialId: form.credentialId || null,
      };
      if (editEntry) {
        const res = await fetch(`/api/admin/2fa/${editEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update entry");
        onSuccess(`"${form.appName}" updated.`);
      } else {
        body.inputMode = "manual";
        body.secret = form.secret.trim();
        const res = await fetch("/api/admin/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create entry");
        onSuccess(`"${form.appName}" added to vault.`);
      }
      setOpenForm(false);
      fetchEntries();
    } catch (e: any) { onError(e.message); } finally { setSavingForm(false); }
  };

  const handleToggleStatus = async (entry: any) => {
    const newStatus = entry.status === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/admin/2fa/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      onSuccess(`Entry ${newStatus === "active" ? "enabled" : "disabled"}.`);
      fetchEntries();
      if (manageEntry?.id === entry.id) openManage(entry.id);
    } catch (e: any) { onError(e.message); }
  };

  const handleDelete = async () => {
    if (!manageEntry) return;
    if (!confirm(`Delete "${manageEntry.appName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/2fa/${manageEntry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      onSuccess("Entry deleted.");
      setManageEntry(null);
      fetchEntries();
    } catch (e: any) { onError(e.message); }
  };

  const handleAssign = async () => {
    if (!assignUser && !bulkSelectAll) return;
    setAssigning(true);
    try {
      const userIds = bulkSelectAll
        ? orgMembers.map((m) => m.user.id)
        : [assignUser.user.id];

      const res = await fetch(`/api/admin/2fa/${manageEntry.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assignment failed");
      onSuccess(`Assigned to ${data.created} user(s).`);
      setAssignUser(null);
      setBulkSelectAll(false);
      openManage(manageEntry.id);
    } catch (e: any) { onError(e.message); } finally { setAssigning(false); }
  };

  const handleUnassign = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/2fa/${manageEntry.id}/assignments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });
      if (!res.ok) throw new Error("Failed to remove assignment");
      onSuccess("Assignment removed.");
      openManage(manageEntry.id);
    } catch (e: any) { onError(e.message); }
  };

  const handleAssociate = async () => {
    if (!assocTarget || !manageEntry) return;
    setAssociating(true);
    try {
      const body =
        assocType === "resource"
          ? { resourceId: assocTarget.id, awsResourceId: null, credentialId: null }
          : assocType === "aws"
          ? { resourceId: null, awsResourceId: assocTarget.id, credentialId: null }
          : { resourceId: null, awsResourceId: null, credentialId: assocTarget.id };
      const res = await fetch(`/api/admin/2fa/${manageEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save association");
      onSuccess("Association saved.");
      setAssocTarget(null);
      openManage(manageEntry.id);
    } catch (e: any) { onError(e.message); }
    finally { setAssociating(false); }
  };

  const handleUnlink = async () => {
    if (!manageEntry) return;
    try {
      const res = await fetch(`/api/admin/2fa/${manageEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: null, awsResourceId: null, credentialId: null }),
      });
      if (!res.ok) throw new Error("Failed to remove link");
      onSuccess("Association removed.");
      openManage(manageEntry.id);
    } catch (e: any) { onError(e.message); }
  };

  const handleRotateSecret = async () => {
    if (!rotateSecret.trim()) { onError("New secret is required"); return; }
    setRotating(true);
    try {
      const res = await fetch(`/api/admin/2fa/${manageEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSecret: rotateSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rotation failed");
      onSuccess("Secret rotated and archived.");
      setOpenRotate(false);
      setRotateSecret("");
    } catch (e: any) { onError(e.message); } finally { setRotating(false); }
  };

  const handleMigrationImport = async () => {
    if (!selectedOrgId || migrationSelected.size === 0) return;
    setImportingMigration(true);
    let imported = 0;
    let failed = 0;
    try {
      for (const idx of Array.from(migrationSelected)) {
        const entry = migrationEntries[idx];
        if (!entry) continue;
        try {
          const body = {
            organizationId: selectedOrgId,
            appName: entry.issuer || entry.accountLabel || `Imported Account ${idx + 1}`,
            issuer: entry.issuer,
            accountLabel: entry.accountLabel,
            algorithm: entry.algorithm,
            digits: entry.digits,
            period: entry.period,
            category: migrationCategory || null,
            environment: migrationEnvironment || null,
            notes: migrationNotes || null,
            allowNotesForUsers: migrationAllowNotes,
            resourceId: migrationResourceId || null,
            awsResourceId: migrationAwsResourceId || null,
            credentialId: migrationCredentialId || null,
            inputMode: "manual",
            secret: entry.secret,
          };
          const res = await fetch("/api/admin/2fa", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) { imported++; } else { failed++; }
        } catch { failed++; }
      }
      setOpenMigration(false);
      setMigrationEntries([]);
      setMigrationSelected(new Set());
      setMigrationNotes("");
      setMigrationAllowNotes(false);
      setMigrationResourceId("");
      setMigrationAwsResourceId("");
      setMigrationCredentialId("");
      fetchEntries();
      if (failed === 0) {
        onSuccess(`Imported ${imported} account${imported !== 1 ? "s" : ""} from migration QR.`);
      } else {
        onError(`Imported ${imported}, failed ${failed}. Check entries and retry.`);
      }
    } catch (e: any) {
      onError(e.message);
    } finally {
      setImportingMigration(false);
    }
  };

  const availableMembers = useMemo(
    () => orgMembers.filter((m) => !manageEntry?.assignments?.find((a: any) => a.assignedToUserId === m.user.id)),
    [orgMembers, manageEntry]
  );

  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category).filter(Boolean))] as string[],
    [entries]
  );

  return (
    <Box>
      {/* Header controls */}
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 250 }}>
          <InputLabel>Organization Scope</InputLabel>
          <Select label="Organization Scope" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
            {organizations.map((org) => (<MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<Plus size={16} />} onClick={openAdd} disabled={!selectedOrgId} sx={{ borderRadius: 3, fontWeight: 700 }}>
          Add 2FA Entry
        </Button>
      </Box>

      {/* Filters */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField fullWidth size="small" placeholder="Search by app name, issuer, category…"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          sx={{ "& .MuiInputBase-root": { borderRadius: 3 } }} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="disabled">Disabled</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Environment</InputLabel>
          <Select label="Environment" value={filterEnv} onChange={(e) => setFilterEnv(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            {ENVIRONMENTS.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {/* Entry list */}
      {loading ? (
        <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
      ) : entries.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          {search || filterCategory || filterEnv ? "No entries match your filters." : "No 2FA entries yet. Click \"Add 2FA Entry\" to get started."}
        </Alert>
      ) : (
        <>
          <Stack spacing={2}>
            {entries.map((entry) => (
              <Paper key={entry.id} onClick={() => openManage(entry.id)}
                sx={{ p: 3, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "all 0.2s", "&:hover": { borderColor: "primary.main" } }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
                    <Lock size={15} /> {entry.appName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                    {[entry.issuer, entry.accountLabel].filter(Boolean).join(" · ")}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75 }} flexWrap="wrap">
                    {entry.category && <Chip label={entry.category} size="small" variant="outlined" />}
                    {entry.environment && <Chip label={entry.environment} size="small" variant="outlined" color="info" />}
                    <Chip label={`${entry.assignmentCount} assigned`} size="small" icon={<Users size={12} />} />
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={entry.status}
                    size="small"
                    color={entry.status === "active" ? "success" : "default"}
                    variant={entry.status === "active" ? "filled" : "outlined"}
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={PAGE_OPTIONS}
            sx={{ mt: 1 }}
          />
        </>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editEntry ? `Edit: ${editEntry.appName}` : "Add 2FA Entry"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {!editEntry && (
              <>
                <Stack direction="row" spacing={1}>
                  {(["qr", "manual", "uri"] as const).map((mode) => (
                    <Button key={mode} size="small" variant={inputMode === mode ? "contained" : "outlined"}
                      onClick={() => setInputMode(mode)}
                      startIcon={mode === "qr" ? <QrCode size={14} /> : mode === "manual" ? <KeyRound size={14} /> : <Link2 size={14} />}
                      sx={{ borderRadius: 2, textTransform: "none" }}>
                      {mode === "qr" ? "Upload QR" : mode === "manual" ? "Manual" : "Paste URI"}
                    </Button>
                  ))}
                </Stack>

                {inputMode === "uri" && (
                  <TextField fullWidth multiline rows={3} label="otpauth:// URI"
                    placeholder="otpauth://totp/Issuer:account?secret=BASE32&issuer=…"
                    onChange={(e) => handleUriPaste(e.target.value)}
                    helperText="Paste your full otpauth URI — fields will auto-fill below." />
                )}

                {inputMode === "qr" && (
                  <Box>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleQrUpload} />
                    <Button fullWidth variant="outlined" startIcon={qrParsing ? <CircularProgress size={16} /> : <Upload size={16} />}
                      onClick={() => fileInputRef.current?.click()} disabled={qrParsing} sx={{ borderRadius: 3, py: 2, borderStyle: "dashed" }}>
                      {qrParsing ? "Parsing…" : qrParsed ? "Re-upload QR code image" : "Click to upload QR code image"}
                    </Button>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      PNG / JPEG / WebP — max 5 MB. Image is never stored.
                    </Typography>
                  </Box>
                )}

                {(inputMode !== "qr" || qrParsed) && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    Secret is encrypted with AES-256-GCM before storage and never returned by any API.
                  </Alert>
                )}
              </>
            )}

            {/* Form fields — always visible when editing, or when not in QR mode, or after QR has been parsed */}
            {(editEntry || inputMode !== "qr" || qrParsed) && (
              <>
                <TextField fullWidth required label="App Name" value={form.appName}
                  onChange={(e) => setForm((p) => ({ ...p, appName: e.target.value }))} />
                <TextField fullWidth label="Issuer" value={form.issuer}
                  onChange={(e) => setForm((p) => ({ ...p, issuer: e.target.value }))} />
                <TextField fullWidth label="Account Label" placeholder="user@example.com" value={form.accountLabel}
                  onChange={(e) => setForm((p) => ({ ...p, accountLabel: e.target.value }))} />

                {!editEntry && (
                  <TextField fullWidth required label="Secret (Base32)" type={showSecret ? "text" : "password"}
                    value={form.secret} onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowSecret((s) => !s)}>
                            {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Algorithm</InputLabel>
                      <Select label="Algorithm" value={form.algorithm} onChange={(e) => setForm((p) => ({ ...p, algorithm: e.target.value }))}>
                        {ALGORITHMS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Digits</InputLabel>
                      <Select label="Digits" value={form.digits} onChange={(e) => setForm((p) => ({ ...p, digits: e.target.value }))}>
                        <MenuItem value="6">6</MenuItem>
                        <MenuItem value="8">8</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Period (s)</InputLabel>
                      <Select label="Period (s)" value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}>
                        <MenuItem value="30">30</MenuItem>
                        <MenuItem value="60">60</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Divider />

                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth size="small" label="Category" placeholder="e.g. AWS, GitHub"
                      value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Environment</InputLabel>
                      <Select label="Environment" value={form.environment} onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value }))}>
                        {ENVIRONMENTS.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <TextField fullWidth multiline rows={2} label="Notes (optional)" value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

                <Divider />
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ASSOCIATE WITH (OPTIONAL)</Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>Web Resource</InputLabel>
                  <Select label="Web Resource" value={form.resourceId}
                    onChange={(e) => setForm((p) => ({ ...p, resourceId: e.target.value, awsResourceId: "", credentialId: "" }))}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {orgResources.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.environment})</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>AWS Resource</InputLabel>
                  <Select label="AWS Resource" value={form.awsResourceId}
                    onChange={(e) => setForm((p) => ({ ...p, awsResourceId: e.target.value, resourceId: "", credentialId: "" }))}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {orgAwsResources.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.environment})</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Credential</InputLabel>
                  <Select label="Credential" value={form.credentialId}
                    onChange={(e) => setForm((p) => ({ ...p, credentialId: e.target.value, resourceId: "", awsResourceId: "" }))}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {orgCredentials.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.appName}{c.username ? ` — ${c.username}` : ""}</MenuItem>)}
                  </Select>
                </FormControl>

                <FormControlLabel control={
                  <Switch checked={form.allowNotesForUsers} onChange={(e) => setForm((p) => ({ ...p, allowNotesForUsers: e.target.checked }))} />
                } label="Show notes to assigned users" />

                {editEntry && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="disabled">Disabled</MenuItem>
                    </Select>
                  </FormControl>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenForm(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={savingForm}>
            {savingForm ? <CircularProgress size={18} /> : editEntry ? "Save Changes" : "Add Entry"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Manage Entry Dialog ── */}
      <Dialog open={!!manageEntry} onClose={() => setManageEntry(null)} maxWidth="md" fullWidth>
        {manageLoading ? (
          <Box sx={{ p: 6, textAlign: "center" }}><CircularProgress /></Box>
        ) : manageEntry ? (
          <>
            <DialogTitle sx={{ fontWeight: 800, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Lock size={18} /> {manageEntry.appName}
              </Box>
              <Chip label={manageEntry.status} size="small" color={manageEntry.status === "active" ? "success" : "default"} />
            </DialogTitle>
            <Tabs value={manageTab} onChange={handleTabChange} sx={{ px: 3 }}>
              <Tab label="Details" />
              <Tab label={`Assignments (${manageEntry.assignments?.length ?? 0})`} icon={<Users size={14} />} iconPosition="start" />
              <Tab label="Access Log" icon={<ClipboardList size={14} />} iconPosition="start" />
              <Tab
                label="Linked To"
                icon={<Link2 size={14} />}
                iconPosition="start"
                sx={{ ...(manageEntry.resourceId || manageEntry.awsResourceId || manageEntry.credentialId
                  ? { color: "primary.main", fontWeight: 700 } : {}) }}
              />
            </Tabs>
            <Divider />
            <DialogContent>
              {/* Details Tab */}
              {manageTab === 0 && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ISSUER</Typography>
                    <Typography variant="body2">{manageEntry.issuer ?? "—"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ACCOUNT LABEL</Typography>
                    <Typography variant="body2">{manageEntry.accountLabel ?? "—"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ALGORITHM</Typography>
                    <Typography variant="body2">{manageEntry.algorithm}</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>DIGITS</Typography>
                    <Typography variant="body2">{manageEntry.digits}</Typography>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>PERIOD</Typography>
                    <Typography variant="body2">{manageEntry.period}s</Typography>
                  </Grid>
                  {manageEntry.category && (
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>CATEGORY</Typography>
                      <Typography variant="body2">{manageEntry.category}</Typography>
                    </Grid>
                  )}
                  {manageEntry.environment && (
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ENVIRONMENT</Typography>
                      <Typography variant="body2">{manageEntry.environment}</Typography>
                    </Grid>
                  )}
                  {manageEntry.notes && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>NOTES</Typography>
                      <Typography variant="body2">{manageEntry.notes}</Typography>
                    </Grid>
                  )}
                  {(manageEntry.resourceId || manageEntry.awsResourceId || manageEntry.credentialId) && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ASSOCIATED WITH</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                        {manageEntry.resourceId && (
                          <Chip label={`Web: ${manageEntry.resourceName ?? manageEntry.resourceId}`} size="small" color="primary" variant="outlined" icon={<Link2 size={12} />} />
                        )}
                        {manageEntry.awsResourceId && (
                          <Chip label={`AWS: ${manageEntry.awsResourceName ?? manageEntry.awsResourceId}`} size="small" color="warning" variant="outlined" icon={<Link2 size={12} />} />
                        )}
                        {manageEntry.credentialId && (
                          <Chip label={`Cred: ${manageEntry.credentialAppName ?? manageEntry.credentialId}`} size="small" color="info" variant="outlined" icon={<KeyRound size={12} />} />
                        )}
                      </Stack>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info" sx={{ borderRadius: 2 }} icon={<Lock size={16} />}>
                      The raw TOTP secret is stored encrypted and is never accessible through any interface.
                    </Alert>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Button variant="outlined" size="small" startIcon={<RefreshCw size={14} />} onClick={() => setOpenRotate(true)}>
                      Rotate Secret
                    </Button>
                  </Grid>
                </Grid>
              )}

              {/* Assignments Tab */}
              {manageTab === 1 && (
                <Box>
                  <Stack direction="row" spacing={1} mb={2} alignItems="center">
                    <Autocomplete size="small" fullWidth options={availableMembers}
                      getOptionLabel={(o) => `${o.user.name} (${o.user.email})`}
                      filterOptions={(opts, { inputValue }) => {
                        const q = inputValue.toLowerCase();
                        return opts.filter((o) => o.user.name?.toLowerCase().includes(q) || o.user.email?.toLowerCase().includes(q));
                      }}
                      value={assignUser} onChange={(_, v) => { setAssignUser(v); setBulkSelectAll(false); }}
                      renderInput={(params) => <TextField {...params} placeholder="Search member…" />} />
                    <Button variant="contained" onClick={handleAssign} disabled={assigning || (!assignUser && !bulkSelectAll)}>
                      {assigning ? <CircularProgress size={16} /> : "Assign"}
                    </Button>
                  </Stack>
                  <Button size="small" variant="outlined" onClick={() => { setBulkSelectAll(true); setAssignUser(null); }} sx={{ mb: 2 }}>
                    Select All Org Members ({orgMembers.length})
                  </Button>
                  {bulkSelectAll && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                      Will assign all {orgMembers.length} members. Click Assign to confirm.
                    </Alert>
                  )}
                  <List dense>
                    {manageEntry.assignments?.length === 0 && (
                      <Typography variant="caption" color="text.secondary">No assignments yet.</Typography>
                    )}
                    {manageEntry.assignments?.map((a: any) => (
                      <ListItem key={a.id} sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, mb: 1 }}>
                        <ListItemText primary={a.assignedToUser?.name ?? "Unknown"} secondary={a.assignedToUser?.email} />
                        <ListItemSecondaryAction>
                          <IconButton size="small" color="error" onClick={() => handleUnassign(a.assignedToUserId)}>
                            <X size={16} />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* Access Log Tab */}
              {manageTab === 2 && (
                <Box>
                  {logsLoading ? (
                    <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box>
                  ) : accessLogs.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">No access events recorded yet.</Typography>
                  ) : (
                    <List dense>
                      {accessLogs.map((log) => (
                        <ListItem key={log.id} sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, mb: 1 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                <Chip label={log.action.replace("_", " ")} size="small"
                                  color={log.outcome === "success" ? "success" : "error"} variant="outlined" />
                                <Typography variant="caption">{log.user?.name ?? "Unknown"} ({log.user?.email})</Typography>
                              </Box>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {new Date(log.timestamp).toLocaleString()} {log.ipAddress ? `· ${log.ipAddress}` : ""}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
              {/* Linked To Tab */}
              {manageTab === 3 && (
                <Box>
                  {/* Current association */}
                  {!manageEntry.resourceId && !manageEntry.awsResourceId && !manageEntry.credentialId ? (
                    <Alert severity="info" sx={{ borderRadius: 3, mb: 3 }}>
                      This 2FA entry is not linked to any resource or credential yet. Use the form below to associate it.
                    </Alert>
                  ) : (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 1 }}>
                        CURRENT ASSOCIATION
                      </Typography>
                      {manageEntry.resourceId && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Chip label="WEB APP" size="small" color="primary" sx={{ fontSize: "0.6rem", fontWeight: 900, borderRadius: 1.5 }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>{manageEntry.resource?.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{manageEntry.resource?.resourceKey}</Typography>
                            </Box>
                          </Box>
                          <Button size="small" color="error" variant="outlined" onClick={handleUnlink} sx={{ borderRadius: 2, flexShrink: 0 }}>
                            Remove
                          </Button>
                        </Paper>
                      )}
                      {manageEntry.awsResourceId && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Chip label="AWS" size="small" color="warning" sx={{ fontSize: "0.6rem", fontWeight: 900, borderRadius: 1.5 }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>{manageEntry.awsResource?.name}</Typography>
                              <Typography variant="caption" color="text.secondary">{manageEntry.awsResource?.resourceKey}</Typography>
                            </Box>
                          </Box>
                          <Button size="small" color="error" variant="outlined" onClick={handleUnlink} sx={{ borderRadius: 2, flexShrink: 0 }}>
                            Remove
                          </Button>
                        </Paper>
                      )}
                      {manageEntry.credentialId && (
                        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Chip label="CREDENTIAL" size="small" color="info" sx={{ fontSize: "0.6rem", fontWeight: 900, borderRadius: 1.5 }} />
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>{manageEntry.credential?.appName}</Typography>
                              <Typography variant="caption" color="text.secondary">credential</Typography>
                            </Box>
                          </Box>
                          <Button size="small" color="error" variant="outlined" onClick={handleUnlink} sx={{ borderRadius: 2, flexShrink: 0 }}>
                            Remove
                          </Button>
                        </Paper>
                      )}
                    </Box>
                  )}

                  <Divider sx={{ mb: 3 }} />

                  <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 2 }}>
                    {manageEntry.resourceId || manageEntry.awsResourceId || manageEntry.credentialId ? "CHANGE ASSOCIATION" : "LINK TO"}
                  </Typography>

                  {/* Type selector */}
                  <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                    {([
                      { key: "resource", label: "Web App", icon: <Link2 size={13} /> },
                      { key: "aws", label: "AWS Resource", icon: <ShieldCheck size={13} /> },
                      { key: "credential", label: "Credential", icon: <KeyRound size={13} /> },
                    ] as const).map(({ key, label, icon }) => (
                      <Button
                        key={key}
                        size="small"
                        variant={assocType === key ? "contained" : "outlined"}
                        startIcon={icon}
                        onClick={() => { setAssocType(key); setAssocTarget(null); }}
                        sx={{ borderRadius: 2, textTransform: "none", fontWeight: assocType === key ? 700 : 500 }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Stack>

                  {/* Searchable dropdown + associate button */}
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Autocomplete
                      fullWidth
                      size="small"
                      options={assocType === "resource" ? orgResources : assocType === "aws" ? orgAwsResources : orgCredentials}
                      value={assocTarget}
                      onChange={(_, v) => setAssocTarget(v)}
                      getOptionLabel={(o) => assocType === "credential" ? (o.appName ?? "") : (o.name ?? "")}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      filterOptions={(opts, { inputValue }) => {
                        const q = inputValue.toLowerCase();
                        if (!q) return opts;
                        if (assocType === "resource") {
                          return opts.filter(r =>
                            r.name?.toLowerCase().includes(q) ||
                            r.appHost?.toLowerCase().includes(q) ||
                            r.environment?.toLowerCase().includes(q) ||
                            r.description?.toLowerCase().includes(q)
                          );
                        }
                        if (assocType === "aws") {
                          return opts.filter(r =>
                            r.name?.toLowerCase().includes(q) ||
                            r.awsAccountId?.includes(q) ||
                            r.region?.toLowerCase().includes(q) ||
                            r.environment?.toLowerCase().includes(q) ||
                            r.roleArn?.toLowerCase().includes(q)
                          );
                        }
                        return opts.filter(c =>
                          c.appName?.toLowerCase().includes(q) ||
                          c.username?.toLowerCase().includes(q) ||
                          c.loginUrl?.toLowerCase().includes(q) ||
                          c.description?.toLowerCase().includes(q)
                        );
                      }}
                      renderOption={(props, option) => {
                        const { key, ...rest } = props as any;
                        if (assocType === "resource") {
                          return (
                            <Box component="li" key={key} {...rest} sx={{ py: "10px !important" }}>
                              <Box sx={{ width: "100%" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{option.name}</Typography>
                                  <Chip label={(option.environment ?? "").toUpperCase()} size="small"
                                    color={option.environment === "production" ? "success" : option.environment === "staging" ? "info" : "warning"}
                                    sx={{ fontSize: "0.55rem", height: 16, borderRadius: 1 }} />
                                  {option.loginAdapter && (
                                    <Chip label={option.loginAdapter.replace("_", " ")} size="small" variant="outlined"
                                      sx={{ fontSize: "0.55rem", height: 16, borderRadius: 1 }} />
                                  )}
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>
                                  {option.appHost}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        }
                        if (assocType === "aws") {
                          const roleName = option.roleArn?.split("/").pop() ?? option.roleArn;
                          const shortAccount = option.awsAccountId?.length === 12
                            ? `${option.awsAccountId.slice(0, 4)}…${option.awsAccountId.slice(-4)}`
                            : option.awsAccountId;
                          return (
                            <Box component="li" key={key} {...rest} sx={{ py: "10px !important" }}>
                              <Box sx={{ width: "100%" }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{option.name}</Typography>
                                  <Chip label={(option.environment ?? "").toUpperCase()} size="small"
                                    color={option.environment === "production" ? "success" : option.environment === "staging" ? "info" : "warning"}
                                    sx={{ fontSize: "0.55rem", height: 16, borderRadius: 1 }} />
                                </Box>
                                <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>
                                  {shortAccount} · {option.region} · {roleName}
                                </Typography>
                              </Box>
                            </Box>
                          );
                        }
                        // credential
                        return (
                          <Box component="li" key={key} {...rest} sx={{ py: "10px !important" }}>
                            <Box sx={{ width: "100%" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{option.appName}</Typography>
                                {option.username && (
                                  <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>
                                    {option.username}
                                  </Typography>
                                )}
                              </Box>
                              {option.loginUrl && (
                                <Typography variant="caption" sx={{ color: "primary.light", fontFamily: "monospace" }}>
                                  {option.loginUrl}
                                </Typography>
                              )}
                              {option.description && !option.loginUrl && (
                                <Typography variant="caption" color="text.secondary">{option.description}</Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={
                            assocType === "resource"
                              ? "Search by app name, host, or environment…"
                              : assocType === "aws"
                              ? "Search by name, account ID, region, or role…"
                              : "Search by app name, username, or login URL…"
                          }
                        />
                      )}
                      noOptionsText={
                        assocType === "resource"
                          ? "No web resources found for this org"
                          : assocType === "aws"
                          ? "No AWS resources found for this org"
                          : "No credentials found for this org"
                      }
                    />
                    <Button
                      variant="contained"
                      onClick={handleAssociate}
                      disabled={!assocTarget || associating}
                      sx={{ flexShrink: 0, height: 40 }}
                    >
                      {associating ? <CircularProgress size={16} /> : "Link"}
                    </Button>
                  </Stack>

                  {assocTarget && (
                    <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
                      Linking this 2FA code will replace any existing association. Click <strong>Link</strong> to confirm.
                    </Alert>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 3, display: "flex", justifyContent: "space-between" }}>
              <Stack direction="row" spacing={1}>
                <Button color="error" variant="text" onClick={handleDelete}>Delete</Button>
                <Button variant="outlined" onClick={() => { handleToggleStatus(manageEntry); }}>
                  {manageEntry.status === "active" ? "Disable" : "Enable"}
                </Button>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => openEdit(manageEntry)} variant="outlined">Edit Metadata</Button>
                <Button onClick={() => setManageEntry(null)} variant="contained">Close</Button>
              </Stack>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      {/* ── Migration Import Dialog ── */}
      <Dialog open={openMigration} onClose={() => { if (!importingMigration) setOpenMigration(false); }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
          <FileStack size={20} /> Import from Google Authenticator
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Found <strong>{migrationEntries.length}</strong> TOTP account{migrationEntries.length !== 1 ? "s" : ""} in this migration QR.
              {migrationSkipped > 0 && ` (${migrationSkipped} HOTP/unsupported entr${migrationSkipped !== 1 ? "ies" : "y"} skipped.)`}
            </Alert>

            {/* Select all / deselect all */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Checkbox
                checked={migrationSelected.size === migrationEntries.length && migrationEntries.length > 0}
                indeterminate={migrationSelected.size > 0 && migrationSelected.size < migrationEntries.length}
                onChange={(e) => {
                  setMigrationSelected(e.target.checked ? new Set(migrationEntries.map((_, i) => i)) : new Set());
                }}
              />
              <Typography variant="body2">
                {migrationSelected.size === migrationEntries.length ? "Deselect all" : "Select all"}
              </Typography>
            </Box>

            {/* Entry list with checkboxes */}
            <List dense disablePadding>
              {migrationEntries.map((entry: any, idx: number) => (
                <ListItem key={idx}
                  sx={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, mb: 1, py: 1 }}
                  onClick={() => setMigrationSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
                    return next;
                  })}
                  style={{ cursor: "pointer" }}>
                  <Checkbox
                    edge="start"
                    checked={migrationSelected.has(idx)}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => setMigrationSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
                      return next;
                    })}
                  />
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {entry.issuer || entry.accountLabel || `Account ${idx + 1}`}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {[entry.issuer && entry.accountLabel ? entry.accountLabel : null, `${entry.algorithm} · ${entry.digits} digits · ${entry.period}s`].filter(Boolean).join("  ·  ")}
                      </Typography>
                    }
                  />
                  <Chip
                    label={`${entry.digits}d`}
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1, fontSize: "0.65rem", height: 20 }}
                  />
                </ListItem>
              ))}
            </List>

            <Divider />

            {/* Shared metadata for all imported entries */}
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
              APPLY TO ALL IMPORTED ENTRIES
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth size="small" label="Category (optional)" placeholder="e.g. Google, Personal"
                  value={migrationCategory}
                  onChange={(e) => setMigrationCategory(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Environment</InputLabel>
                  <Select label="Environment" value={migrationEnvironment} onChange={(e) => setMigrationEnvironment(e.target.value)}>
                    {ENVIRONMENTS.map((env) => <MenuItem key={env} value={env}>{env}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField fullWidth size="small" multiline rows={2} label="Notes (optional)"
              value={migrationNotes} onChange={(e) => setMigrationNotes(e.target.value)} />

            <Divider />
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>ASSOCIATE WITH (OPTIONAL)</Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Web Resource</InputLabel>
              <Select label="Web Resource" value={migrationResourceId}
                onChange={(e) => { setMigrationResourceId(e.target.value); setMigrationAwsResourceId(""); setMigrationCredentialId(""); }}>
                <MenuItem value=""><em>None</em></MenuItem>
                {orgResources.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.environment})</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>AWS Resource</InputLabel>
              <Select label="AWS Resource" value={migrationAwsResourceId}
                onChange={(e) => { setMigrationAwsResourceId(e.target.value); setMigrationResourceId(""); setMigrationCredentialId(""); }}>
                <MenuItem value=""><em>None</em></MenuItem>
                {orgAwsResources.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.name} ({r.environment})</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Credential</InputLabel>
              <Select label="Credential" value={migrationCredentialId}
                onChange={(e) => { setMigrationCredentialId(e.target.value); setMigrationResourceId(""); setMigrationAwsResourceId(""); }}>
                <MenuItem value=""><em>None</em></MenuItem>
                {orgCredentials.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.appName}{c.username ? ` — ${c.username}` : ""}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControlLabel control={
              <Switch checked={migrationAllowNotes} onChange={(e) => setMigrationAllowNotes(e.target.checked)} />
            } label="Show notes to assigned users" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, display: "flex", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">
            {migrationSelected.size} of {migrationEntries.length} selected
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setOpenMigration(false)} disabled={importingMigration}>Cancel</Button>
            <Button
              variant="contained"
              startIcon={importingMigration ? <CircularProgress size={16} /> : <FileStack size={16} />}
              onClick={handleMigrationImport}
              disabled={importingMigration || migrationSelected.size === 0}
            >
              {importingMigration ? "Importing…" : `Import ${migrationSelected.size} Account${migrationSelected.size !== 1 ? "s" : ""}`}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* ── Rotate Secret Dialog ── */}
      <Dialog open={openRotate} onClose={() => setOpenRotate(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Rotate TOTP Secret</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              The existing secret will be archived and replaced. All assigned users will immediately generate OTPs from the new secret.
            </Alert>
            <TextField fullWidth required label="New Secret (Base32)"
              type={showRotateSecret ? "text" : "password"}
              value={rotateSecret} onChange={(e) => setRotateSecret(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowRotateSecret((s) => !s)}>
                      {showRotateSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => { setOpenRotate(false); setRotateSecret(""); }}>Cancel</Button>
          <Button onClick={handleRotateSecret} variant="contained" color="warning" disabled={rotating}>
            {rotating ? <CircularProgress size={18} /> : "Rotate Secret"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
