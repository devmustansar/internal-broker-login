"use client";

import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, FormControl, InputLabel,
  Select, MenuItem, Grid,
} from "@mui/material";
import { Plus, Send } from "lucide-react";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  PENDING: "warning", APPROVED: "info", REJECTED: "error", COMPLETED: "success",
};

const EMPTY_FORM = { type: "REQUEST_ORG_CREDENTIAL", organizationId: "", resourceId: "", awsResourceId: "", appName: "", loginUrl: "", justification: "" };

export default function UserVaultRequests({ onSuccess, onError }: { onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [awsResources, setAwsResources] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vault-requests?scope=mine");
      if (res.ok) setRequests(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const openDialog = async () => {
    setForm(EMPTY_FORM);
    setOpen(true);
    try {
      const [orgsRes, appsRes] = await Promise.all([fetch("/api/organizations"), fetch("/api/apps")]);
      if (orgsRes.ok) setOrganizations(await orgsRes.json());
      if (appsRes.ok) {
        const apps = await appsRes.json();
        const res2: any[] = [], aws: any[] = [];
        for (const r of apps) {
          if ("awsAccountId" in r) aws.push(r); else res2.push(r);
        }
        setResources(res2);
        setAwsResources(aws);
      }
    } catch { /* best-effort */ }
  };

  const handleSubmit = async () => {
    if (!form.organizationId || !form.appName.trim()) { onError("Organization and app name are required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/vault-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      onSuccess("Request submitted. The organization admin will review it.");
      setOpen(false);
      fetchRequests();
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h3" sx={{ fontSize: "1.1rem", fontWeight: 800 }}>My Requests</Typography>
        <Button variant="contained" startIcon={<Send size={16} />} onClick={openDialog} sx={{ borderRadius: 3, fontWeight: 700 }}>
          Request Credential / 2FA
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
      ) : requests.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>No requests yet. Use the button above to request an organization credential or 2FA entry.</Alert>
      ) : (
        <Stack spacing={2}>
          {requests.map((r) => (
            <Paper key={r.id} sx={{ p: 3, borderRadius: 4 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{r.appName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.type === "REQUEST_ORG_CREDENTIAL" ? "Credential" : "2FA"} · {r.organization?.name}
                  </Typography>
                  {r.justification && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{r.justification}</Typography>}
                  {r.reviewNote && <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}>Reviewer note: {r.reviewNote}</Typography>}
                </Box>
                <Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} />
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request Credential / 2FA</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={0.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                <MenuItem value="REQUEST_ORG_CREDENTIAL">Organization Credential</MenuItem>
                <MenuItem value="REQUEST_ORG_2FA">Organization 2FA</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Organization</InputLabel>
              <Select label="Organization" value={form.organizationId} onChange={(e) => setForm((p) => ({ ...p, organizationId: e.target.value, resourceId: "", awsResourceId: "" }))}>
                {organizations.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Web Resource (optional)</InputLabel>
                  <Select label="Web Resource (optional)" value={form.resourceId} onChange={(e) => setForm((p) => ({ ...p, resourceId: e.target.value, awsResourceId: "" }))}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {resources.filter((r) => !form.organizationId || r.organizationId === form.organizationId).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>AWS Resource (optional)</InputLabel>
                  <Select label="AWS Resource (optional)" value={form.awsResourceId} onChange={(e) => setForm((p) => ({ ...p, awsResourceId: e.target.value, resourceId: "" }))}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {awsResources.filter((r) => !form.organizationId || r.organizationId === form.organizationId).map((r) => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField fullWidth required label="App / Service Name" value={form.appName} onChange={(e) => setForm((p) => ({ ...p, appName: e.target.value }))} />
            <TextField fullWidth label="Login URL (optional)" value={form.loginUrl} onChange={(e) => setForm((p) => ({ ...p, loginUrl: e.target.value }))} />
            <TextField fullWidth multiline rows={2} label="Justification (optional)" value={form.justification} onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Plus size={16} />}>
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
