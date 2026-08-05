"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, CircularProgress, Alert, Tabs, Tab,
  Grid, InputAdornment, Tooltip, LinearProgress, alpha, useTheme,
} from "@mui/material";
import { Plus, Lock, AppWindow, Search, Trash2, Eye, EyeOff, Copy, Check, Pencil } from "lucide-react";

function PersonalOtpCard({ entry, onEdit, onDelete }: { entry: any; onEdit: () => void; onDelete: () => void }) {
  const theme = useTheme();
  const [otp, setOtp] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(entry.period);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fetching = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOtp = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/personal-vault/totp/${entry.id}/otp`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load OTP");
      const data = await res.json();
      setOtp(data.otp);
      setRemaining(data.remainingSeconds);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
      fetching.current = false;
    }
  }, [entry.id]);

  useEffect(() => {
    if (loading || err) return;
    if (remaining <= 0) { fetchOtp(); return; }
    timer.current = setTimeout(() => setRemaining((r: number) => Math.max(0, r - 1)), 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [remaining, loading, err, fetchOtp]);

  useEffect(() => { fetchOtp(); }, [fetchOtp]);

  const handleCopy = () => {
    if (!otp) return;
    navigator.clipboard.writeText(otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = remaining / entry.period;
  const color = remaining > 10 ? "success" : remaining > 5 ? "warning" : "error";

  return (
    <Paper sx={{ p: 3, borderRadius: 4, height: "100%", border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 0.75 }}>
            <Lock size={14} /> {entry.appName}
          </Typography>
          {(entry.issuer || entry.accountLabel) && (
            <Typography variant="caption" color="text.secondary">
              {[entry.issuer, entry.accountLabel].filter(Boolean).join(" · ")}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={onEdit}><Pencil size={14} /></IconButton>
          <IconButton size="small" color="error" onClick={onDelete}><Trash2 size={14} /></IconButton>
        </Stack>
      </Box>
      <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.6), borderRadius: 3, p: 2, textAlign: "center" }}>
        {loading ? <CircularProgress size={20} /> : err ? (
          <Typography variant="caption" color="error">{err}</Typography>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <Typography variant="h4" sx={{ fontFamily: "monospace", fontWeight: 800, letterSpacing: "0.15em" }}>
              {otp}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy"}>
              <IconButton size="small" onClick={handleCopy} color={copied ? "success" : "default"}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {!err && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress variant="determinate" value={progress * 100} color={color as any} sx={{ height: 4, borderRadius: 2 }} />
            <Typography variant="caption" color="text.secondary">{loading ? "Loading…" : `${remaining}s`}</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

const EMPTY_CRED = { appName: "", loginUrl: "", description: "", username: "", password: "" };
const EMPTY_2FA = { appName: "", issuer: "", accountLabel: "", secret: "", algorithm: "SHA1", digits: "6", period: "30", notes: "" };

export default function PersonalVaultPanel({ onSuccess, onError }: { onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [tab, setTab] = useState(0);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [credForm, setCredForm] = useState(EMPTY_CRED);
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [openCredForm, setOpenCredForm] = useState(false);
  const [savingCred, setSavingCred] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, { username: string; password: string }>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});

  const [faForm, setFaForm] = useState(EMPTY_2FA);
  const [editingFaId, setEditingFaId] = useState<string | null>(null);
  const [openFaForm, setOpenFaForm] = useState(false);
  const [savingFa, setSavingFa] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [credRes, faRes] = await Promise.all([
        fetch("/api/personal-vault/credentials"),
        fetch("/api/personal-vault/totp"),
      ]);
      if (credRes.ok) setCredentials(await credRes.json());
      if (faRes.ok) setEntries(await faRes.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredCreds = credentials.filter((c) => !search.trim() || c.appName?.toLowerCase().includes(search.toLowerCase()));
  const filteredEntries = entries.filter((e) => !search.trim() || e.appName?.toLowerCase().includes(search.toLowerCase()));

  const openAddCred = () => { setEditingCredId(null); setCredForm(EMPTY_CRED); setOpenCredForm(true); };
  const openEditCred = (c: any) => { setEditingCredId(c.id); setCredForm({ appName: c.appName, loginUrl: c.loginUrl || "", description: c.description || "", username: c.username || "", password: "" }); setOpenCredForm(true); };

  const handleSaveCred = async () => {
    if (!credForm.appName || !credForm.username || (!editingCredId && !credForm.password)) { onError("App name, username, and password are required."); return; }
    setSavingCred(true);
    try {
      const url = editingCredId ? `/api/personal-vault/credentials/${editingCredId}` : "/api/personal-vault/credentials";
      const res = await fetch(url, { method: editingCredId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save credential");
      onSuccess(editingCredId ? "Credential updated." : "Personal credential created.");
      setOpenCredForm(false);
      fetchAll();
    } catch (e: any) { onError(e.message); } finally { setSavingCred(false); }
  };

  const handleDeleteCred = async (id: string) => {
    if (!confirm("Delete this personal credential? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/personal-vault/credentials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete credential");
      onSuccess("Credential deleted.");
      fetchAll();
    } catch (e: any) { onError(e.message); }
  };

  const handleReveal = async (id: string) => {
    if (revealed[id]) { setShowPw((p) => ({ ...p, [id]: !p[id] })); return; }
    try {
      const res = await fetch(`/api/personal-vault/credentials/${id}/reveal`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reveal credential");
      const data = await res.json();
      setRevealed((p) => ({ ...p, [id]: data }));
      setShowPw((p) => ({ ...p, [id]: true }));
    } catch (e: any) { onError(e.message); }
  };

  const openAddFa = () => { setEditingFaId(null); setFaForm(EMPTY_2FA); setOpenFaForm(true); };
  const openEditFa = (e: any) => { setEditingFaId(e.id); setFaForm({ appName: e.appName, issuer: e.issuer || "", accountLabel: e.accountLabel || "", secret: "", algorithm: e.algorithm, digits: String(e.digits), period: String(e.period), notes: e.notes || "" }); setOpenFaForm(true); };

  const handleSaveFa = async () => {
    if (!faForm.appName.trim()) { onError("App name is required"); return; }
    if (!editingFaId && !faForm.secret.trim()) { onError("Secret is required"); return; }
    setSavingFa(true);
    try {
      const body: any = {
        appName: faForm.appName, issuer: faForm.issuer || null, accountLabel: faForm.accountLabel || null,
        algorithm: faForm.algorithm, digits: parseInt(faForm.digits), period: parseInt(faForm.period), notes: faForm.notes || null,
      };
      let res;
      if (editingFaId) {
        if (faForm.secret.trim()) body.newSecret = faForm.secret.trim();
        res = await fetch(`/api/personal-vault/totp/${editingFaId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        body.inputMode = "manual";
        body.secret = faForm.secret.trim();
        res = await fetch("/api/personal-vault/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save 2FA entry");
      onSuccess(editingFaId ? "2FA entry updated." : "Personal 2FA entry added.");
      setOpenFaForm(false);
      fetchAll();
    } catch (e: any) { onError(e.message); } finally { setSavingFa(false); }
  };

  const handleDeleteFa = async (id: string) => {
    if (!confirm("Delete this 2FA entry? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/personal-vault/totp/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      onSuccess("2FA entry deleted.");
      fetchAll();
    } catch (e: any) { onError(e.message); }
  };

  return (
    <Box>
      <Alert severity="info" sx={{ borderRadius: 3, mb: 3 }}>
        Your personal vault is private — no org admin, owner, or super admin can see these entries.
      </Alert>

      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="My Credentials" />
          <Tab label="My 2FA" />
        </Tabs>
        <Stack direction="row" spacing={2}>
          <TextField size="small" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
            sx={{ minWidth: 220, "& .MuiInputBase-root": { borderRadius: 3 } }} />
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={tab === 0 ? openAddCred : openAddFa} sx={{ borderRadius: 3, fontWeight: 700 }}>
            {tab === 0 ? "Add Credential" : "Add 2FA"}
          </Button>
        </Stack>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
      ) : tab === 0 ? (
        filteredCreds.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>No personal credentials yet. Add one to get started.</Alert>
        ) : (
          <Stack spacing={2}>
            {filteredCreds.map((cred) => (
              <Paper key={cred.id} sx={{ p: 3, borderRadius: 4 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
                      <AppWindow size={16} /> {cred.appName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", display: "block", mt: 0.25 }}>
                      {cred.username}
                    </Typography>
                    {showPw[cred.id] && revealed[cred.id] && (
                      <Typography variant="caption" sx={{ color: "warning.main", fontFamily: "monospace", display: "block", mt: 0.25 }}>
                        {revealed[cred.id].password}
                      </Typography>
                    )}
                    {cred.loginUrl && <Typography variant="caption" sx={{ fontFamily: "monospace", color: "primary.main", display: "block", mt: 0.5 }}>{cred.loginUrl}</Typography>}
                    {cred.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{cred.description}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Tooltip title={showPw[cred.id] ? "Hide password" : "Reveal password"}>
                      <IconButton size="small" onClick={() => handleReveal(cred.id)}>
                        {showPw[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => openEditCred(cred)}><Pencil size={14} /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteCred(cred.id)}><Trash2 size={14} /></IconButton>
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Stack>
        )
      ) : filteredEntries.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>No personal 2FA entries yet. Add one to get started.</Alert>
      ) : (
        <Grid container spacing={3}>
          {filteredEntries.map((e) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={e.id}>
              <PersonalOtpCard entry={e} onEdit={() => openEditFa(e)} onDelete={() => handleDeleteFa(e.id)} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Credential Form Dialog */}
      <Dialog open={openCredForm} onClose={() => setOpenCredForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingCredId ? "Edit Personal Credential" : "Add Personal Credential"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={0.5}>
            <TextField fullWidth label="App Name" required value={credForm.appName} onChange={(e) => setCredForm((p) => ({ ...p, appName: e.target.value }))} />
            <TextField fullWidth label="Login URL (optional)" value={credForm.loginUrl} onChange={(e) => setCredForm((p) => ({ ...p, loginUrl: e.target.value }))} />
            <TextField fullWidth label="Username / Identifier" required value={credForm.username} onChange={(e) => setCredForm((p) => ({ ...p, username: e.target.value }))} />
            <TextField fullWidth label={editingCredId ? "New Password (leave blank to keep current)" : "Password"} type="password" required={!editingCredId} value={credForm.password} onChange={(e) => setCredForm((p) => ({ ...p, password: e.target.value }))} />
            <TextField fullWidth label="Description (optional)" multiline rows={2} value={credForm.description} onChange={(e) => setCredForm((p) => ({ ...p, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenCredForm(false)}>Cancel</Button>
          <Button onClick={handleSaveCred} variant="contained" disabled={savingCred}>{savingCred ? <CircularProgress size={18} /> : "Save"}</Button>
        </DialogActions>
      </Dialog>

      {/* 2FA Form Dialog */}
      <Dialog open={openFaForm} onClose={() => setOpenFaForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{editingFaId ? "Edit Personal 2FA" : "Add Personal 2FA"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={0.5}>
            <TextField fullWidth required label="App Name" value={faForm.appName} onChange={(e) => setFaForm((p) => ({ ...p, appName: e.target.value }))} />
            <TextField fullWidth label="Issuer" value={faForm.issuer} onChange={(e) => setFaForm((p) => ({ ...p, issuer: e.target.value }))} />
            <TextField fullWidth label="Account Label" value={faForm.accountLabel} onChange={(e) => setFaForm((p) => ({ ...p, accountLabel: e.target.value }))} />
            <TextField fullWidth required={!editingFaId} label={editingFaId ? "New Secret (leave blank to keep current)" : "Secret (Base32)"} value={faForm.secret} onChange={(e) => setFaForm((p) => ({ ...p, secret: e.target.value }))} />
            <TextField fullWidth multiline rows={2} label="Notes (optional)" value={faForm.notes} onChange={(e) => setFaForm((p) => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenFaForm(false)}>Cancel</Button>
          <Button onClick={handleSaveFa} variant="contained" disabled={savingFa}>{savingFa ? <CircularProgress size={18} /> : "Save"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
