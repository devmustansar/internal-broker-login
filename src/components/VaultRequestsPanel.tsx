"use client";

import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, FormControl, InputLabel,
  Select, MenuItem, Tabs, Tab,
} from "@mui/material";
import { Check, X, Send, Eye, EyeOff } from "lucide-react";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  PENDING: "warning", APPROVED: "info", REJECTED: "error", COMPLETED: "success",
};

const STATUS_TABS = ["PENDING", "APPROVED", "REJECTED", "COMPLETED"];

export default function VaultRequestsPanel({ onSuccess, onError }: { onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [tab, setTab] = useState(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const [fulfilTarget, setFulfilTarget] = useState<any>(null);
  const [credForm, setCredForm] = useState({ username: "", password: "", description: "" });
  const [faForm, setFaForm] = useState({ secret: "", algorithm: "SHA1", digits: "6", period: "30" });
  const [showSecret, setShowSecret] = useState(false);
  const [fulfilling, setFulfilling] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vault-requests?scope=queue&status=${STATUS_TABS[tab]}`);
      if (res.ok) setRequests(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, [tab]);

  const openReview = (r: any, action: "APPROVED" | "REJECTED") => {
    setReviewTarget(r);
    setReviewAction(action);
    setReviewNote("");
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/vault-requests/${reviewTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewAction, reviewNote: reviewNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update request");
      onSuccess(`Request ${reviewAction === "APPROVED" ? "approved" : "rejected"}.`);
      setReviewTarget(null);
      fetchRequests();
    } catch (e: any) { onError(e.message); } finally { setReviewing(false); }
  };

  const openFulfil = (r: any) => {
    setFulfilTarget(r);
    setCredForm({ username: "", password: "", description: "" });
    setFaForm({ secret: "", algorithm: "SHA1", digits: "6", period: "30" });
    setShowSecret(false);
  };

  const handleFulfil = async () => {
    if (!fulfilTarget) return;
    setFulfilling(true);
    try {
      const isCredential = fulfilTarget.type === "REQUEST_ORG_CREDENTIAL";
      const body = isCredential
        ? credForm
        : { secret: faForm.secret, algorithm: faForm.algorithm, digits: parseInt(faForm.digits), period: parseInt(faForm.period) };

      if (isCredential && (!credForm.username || !credForm.password)) { onError("Username and password are required."); setFulfilling(false); return; }
      if (!isCredential && !faForm.secret.trim()) { onError("Secret is required."); setFulfilling(false); return; }

      const res = await fetch(`/api/vault-requests/${fulfilTarget.id}/fulfil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fulfil request");
      onSuccess("Request fulfilled — the record has been created. Remember to share/assign it to the requester separately.");
      setFulfilTarget(null);
      fetchRequests();
    } catch (e: any) { onError(e.message); } finally { setFulfilling(false); }
  };

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        {STATUS_TABS.map((s) => <Tab key={s} label={s} />)}
      </Tabs>

      {loading ? (
        <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
      ) : requests.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>No {STATUS_TABS[tab].toLowerCase()} requests.</Alert>
      ) : (
        <Stack spacing={2}>
          {requests.map((r) => (
            <Paper key={r.id} sx={{ p: 3, borderRadius: 4 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{r.appName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.type === "REQUEST_ORG_CREDENTIAL" ? "Credential" : "2FA"} · {r.organization?.name} · requested by {r.requestedBy?.name} ({r.requestedBy?.email})
                  </Typography>
                  {r.resource && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Resource: {r.resource.name}</Typography>}
                  {r.awsResource && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>AWS Resource: {r.awsResource.name}</Typography>}
                  {r.justification && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{r.justification}</Typography>}
                  {r.reviewNote && <Typography variant="caption" sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}>Note: {r.reviewNote}</Typography>}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                  <Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} />
                  {r.status === "PENDING" && (
                    <>
                      <Button size="small" variant="outlined" color="success" startIcon={<Check size={14} />} onClick={() => openReview(r, "APPROVED")}>Approve</Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<X size={14} />} onClick={() => openReview(r, "REJECTED")}>Reject</Button>
                    </>
                  )}
                  {r.status === "APPROVED" && (
                    <Button size="small" variant="contained" startIcon={<Send size={14} />} onClick={() => openFulfil(r)}>Fulfil</Button>
                  )}
                </Stack>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Approve / Reject Dialog */}
      <Dialog open={!!reviewTarget} onClose={() => setReviewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{reviewAction === "APPROVED" ? "Approve" : "Reject"} Request</DialogTitle>
        <DialogContent dividers>
          <TextField fullWidth multiline rows={3} label="Note (optional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setReviewTarget(null)}>Cancel</Button>
          <Button onClick={handleReview} variant="contained" color={reviewAction === "APPROVED" ? "success" : "error"} disabled={reviewing}>
            {reviewing ? <CircularProgress size={18} color="inherit" /> : reviewAction === "APPROVED" ? "Approve" : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fulfil Dialog */}
      <Dialog open={!!fulfilTarget} onClose={() => setFulfilTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Fulfil Request: {fulfilTarget?.appName}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ borderRadius: 2, mb: 3 }}>
            This creates the real {fulfilTarget?.type === "REQUEST_ORG_CREDENTIAL" ? "credential" : "2FA entry"} in the vault. It will not be shared with the requester automatically — do that separately from the vault panel.
          </Alert>
          {fulfilTarget?.type === "REQUEST_ORG_CREDENTIAL" ? (
            <Stack spacing={3}>
              <TextField fullWidth required label="Username" value={credForm.username} onChange={(e) => setCredForm((p) => ({ ...p, username: e.target.value }))} />
              <TextField fullWidth required label="Password" type={showSecret ? "text" : "password"} value={credForm.password} onChange={(e) => setCredForm((p) => ({ ...p, password: e.target.value }))}
                InputProps={{ endAdornment: <Button size="small" onClick={() => setShowSecret((s) => !s)}>{showSecret ? <EyeOff size={14} /> : <Eye size={14} />}</Button> }} />
              <TextField fullWidth label="Description (optional)" value={credForm.description} onChange={(e) => setCredForm((p) => ({ ...p, description: e.target.value }))} />
            </Stack>
          ) : (
            <Stack spacing={3}>
              <TextField fullWidth required label="Secret (Base32)" type={showSecret ? "text" : "password"} value={faForm.secret} onChange={(e) => setFaForm((p) => ({ ...p, secret: e.target.value }))}
                InputProps={{ endAdornment: <Button size="small" onClick={() => setShowSecret((s) => !s)}>{showSecret ? <EyeOff size={14} /> : <Eye size={14} />}</Button> }} />
              <Stack direction="row" spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Algorithm</InputLabel>
                  <Select label="Algorithm" value={faForm.algorithm} onChange={(e) => setFaForm((p) => ({ ...p, algorithm: e.target.value }))}>
                    <MenuItem value="SHA1">SHA1</MenuItem>
                    <MenuItem value="SHA256">SHA256</MenuItem>
                    <MenuItem value="SHA512">SHA512</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Digits</InputLabel>
                  <Select label="Digits" value={faForm.digits} onChange={(e) => setFaForm((p) => ({ ...p, digits: e.target.value }))}>
                    <MenuItem value="6">6</MenuItem>
                    <MenuItem value="8">8</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Period</InputLabel>
                  <Select label="Period" value={faForm.period} onChange={(e) => setFaForm((p) => ({ ...p, period: e.target.value }))}>
                    <MenuItem value="30">30</MenuItem>
                    <MenuItem value="60">60</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setFulfilTarget(null)}>Cancel</Button>
          <Button onClick={handleFulfil} variant="contained" disabled={fulfilling}>
            {fulfilling ? <CircularProgress size={18} color="inherit" /> : "Create Record"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
