"use client";

import { useState, useEffect } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, Tabs, Tab,
} from "@mui/material";
import { Check, X, Send, Eye, EyeOff, Lock } from "lucide-react";

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

  // Reveal-then-fulfil: admin verifies the requester's own submitted secret, then
  // creates the record from it — the admin never types a secret in themselves.
  const [fulfilTarget, setFulfilTarget] = useState<any>(null);
  const [revealData, setRevealData] = useState<any>(null);
  const [revealing, setRevealing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [description, setDescription] = useState("");
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

  const openFulfil = async (r: any) => {
    setFulfilTarget(r);
    setRevealData(null);
    setShowSecret(false);
    setDescription("");
    setRevealing(true);
    try {
      const res = await fetch(`/api/vault-requests/${r.id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load submitted secret");
      setRevealData(data);
    } catch (e: any) { onError(e.message); setFulfilTarget(null); } finally { setRevealing(false); }
  };

  const handleFulfil = async () => {
    if (!fulfilTarget) return;
    setFulfilling(true);
    try {
      const isCredential = fulfilTarget.type === "REQUEST_ORG_CREDENTIAL";
      const res = await fetch(`/api/vault-requests/${fulfilTarget.id}/fulfil`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCredential ? { description: description || undefined } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fulfil request");
      onSuccess("Request fulfilled — the record has been created from the requester's submitted secret. Remember to share/assign it to them separately.");
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
                      <Button size="small" variant="outlined" onClick={() => openFulfil(r)} startIcon={<Eye size={14} />}>Review Secret</Button>
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
          {reviewAction === "REJECTED" && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>The requester&apos;s submitted secret will be permanently discarded on rejection.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setReviewTarget(null)}>Cancel</Button>
          <Button onClick={handleReview} variant="contained" color={reviewAction === "APPROVED" ? "success" : "error"} disabled={reviewing}>
            {reviewing ? <CircularProgress size={18} color="inherit" /> : reviewAction === "APPROVED" ? "Approve" : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reveal + Fulfil Dialog */}
      <Dialog open={!!fulfilTarget} onClose={() => setFulfilTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
          <Lock size={18} /> {fulfilTarget?.appName}
        </DialogTitle>
        <DialogContent dividers>
          {revealing ? (
            <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={24} /></Box>
          ) : revealData ? (
            <Stack spacing={3}>
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                This is the {fulfilTarget?.type === "REQUEST_ORG_CREDENTIAL" ? "credential" : "2FA secret"} the requester submitted with their request. Verify it, then create the vault record from it — nothing here is typed in by you.
              </Alert>
              {fulfilTarget?.type === "REQUEST_ORG_CREDENTIAL" ? (
                <>
                  <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>USERNAME</Typography><Typography variant="body2" sx={{ fontFamily: "monospace" }}>{revealData.username}</Typography></Box>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>PASSWORD</Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>{showSecret ? revealData.password : "••••••••••"}</Typography>
                      <Button size="small" onClick={() => setShowSecret((s) => !s)} startIcon={showSecret ? <EyeOff size={14} /> : <Eye size={14} />}>{showSecret ? "Hide" : "Show"}</Button>
                    </Stack>
                  </Box>
                  {fulfilTarget?.status === "APPROVED" && (
                    <TextField fullWidth label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                  )}
                </>
              ) : (
                <>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>SECRET</Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>{showSecret ? revealData.secret : "•".repeat(16)}</Typography>
                      <Button size="small" onClick={() => setShowSecret((s) => !s)} startIcon={showSecret ? <EyeOff size={14} /> : <Eye size={14} />}>{showSecret ? "Hide" : "Show"}</Button>
                    </Stack>
                  </Box>
                  <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>CONFIG</Typography><Typography variant="body2">{revealData.algorithm} · {revealData.digits} digits · {revealData.period}s</Typography></Box>
                </>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setFulfilTarget(null)}>Close</Button>
          {fulfilTarget?.status === "APPROVED" && (
            <Button onClick={handleFulfil} variant="contained" disabled={fulfilling || !revealData}>
              {fulfilling ? <CircularProgress size={18} color="inherit" /> : "Create Record"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
