"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, Alert, FormControl, InputLabel,
  Select, MenuItem, Grid, Tabs, Tab, IconButton, InputAdornment, Divider,
} from "@mui/material";
import { Plus, Send, Eye, EyeOff, Camera, Upload, Keyboard, X, Lock } from "lucide-react";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  PENDING: "warning", APPROVED: "info", REJECTED: "error", COMPLETED: "success",
};

const EMPTY_FORM = {
  type: "REQUEST_ORG_CREDENTIAL", organizationId: "", resourceId: "", awsResourceId: "",
  appName: "", loginUrl: "", justification: "", username: "", password: "",
  secret: "", algorithm: "SHA1", digits: "6", period: "30",
};

export default function UserVaultRequests({ onSuccess, onError }: { onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [awsResources, setAwsResources] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // 2FA secret-input sub-mode
  const [faMode, setFaMode] = useState<"scan" | "upload" | "manual">("scan");
  const [qrParsed, setQrParsed] = useState(false);
  const [qrParsing, setQrParsing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reveal (view submitted secret on an existing request)
  const [revealTarget, setRevealTarget] = useState<any>(null);
  const [revealData, setRevealData] = useState<any>(null);
  const [revealing, setRevealing] = useState(false);

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
    setFaMode("scan");
    setQrParsed(false);
    setCameraError(null);
    setShowSecret(false);
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

  // ── Camera scan (mirrors the admin 2FA add flow, posts frames to the member-facing qr-parse endpoint) ──
  const stopScan = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (scanLoopRef.current) { clearTimeout(scanLoopRef.current); scanLoopRef.current = null; }
  };

  const applyQrData = (data: any) => {
    setForm((prev) => ({
      ...prev,
      appName: prev.appName || data.issuer || data.accountLabel || "",
      secret: data.secret,
      algorithm: data.algorithm ?? "SHA1",
      digits: String(data.digits ?? 6),
      period: String(data.period ?? 30),
    }));
    setQrParsed(true);
    setFaMode("manual");
  };

  const scheduleScanFrame = useCallback(() => {
    if (!streamRef.current) return;
    scanLoopRef.current = setTimeout(async () => {
      const video = videoRef.current, canvas = canvasRef.current;
      if (!streamRef.current || !video || !canvas) return;
      if (video.readyState < 2) { scheduleScanFrame(); return; }
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      if ("BarcodeDetector" in window) {
        try {
          const BD = (window as any).BarcodeDetector;
          const detector = new BD({ formats: ["qr_code"] });
          const codes: any[] = await detector.detect(canvas);
          if (codes.length > 0) {
            const raw: string = codes[0].rawValue;
            if (raw.startsWith("otpauth://totp/")) {
              stopScan();
              setQrParsing(true);
              try {
                const fd = new FormData();
                canvas.toBlob(async (blob) => {
                  if (!blob) { setQrParsing(false); return; }
                  fd.append("image", blob, "scan.png");
                  const res = await fetch("/api/vault-requests/qr-parse", { method: "POST", body: fd });
                  const d = await res.json();
                  setQrParsing(false);
                  if (!res.ok) { setCameraError(d.error || "Failed to decode QR"); return; }
                  applyQrData(d);
                }, "image/png");
              } catch { setQrParsing(false); }
              return;
            }
            scheduleScanFrame();
            return;
          }
        } catch { /* fall through */ }
        if (streamRef.current) scheduleScanFrame();
        return;
      }

      canvas.toBlob(async (blob) => {
        if (!blob || !streamRef.current) return;
        try {
          const fd = new FormData(); fd.append("image", blob, "scan.jpg");
          const res = await fetch("/api/vault-requests/qr-parse", { method: "POST", body: fd });
          if (res.ok) { stopScan(); applyQrData(await res.json()); }
          else if (streamRef.current) scheduleScanFrame();
        } catch { if (streamRef.current) scheduleScanFrame(); }
      }, "image/jpeg", 0.8);
    }, 500);
  }, []);

  const startScan = useCallback(async () => {
    if (streamRef.current) return;
    setCameraError(null);
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      scheduleScanFrame();
    } catch (e: any) {
      setCameraError(e.name === "NotAllowedError" ? "Camera permission denied. Allow camera access and try again." : (e.message || "Could not start camera."));
    } finally { setCameraStarting(false); }
  }, [scheduleScanFrame]);

  useEffect(() => {
    if (open && form.type === "REQUEST_ORG_2FA" && faMode === "scan" && !qrParsed) startScan();
    else stopScan();
    return stopScan;
  }, [open, form.type, faMode, qrParsed, startScan]);

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrParsing(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/vault-requests/qr-parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse QR code");
      applyQrData(data);
    } catch (e: any) { onError(e.message); } finally {
      setQrParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!form.organizationId || !form.appName.trim()) { onError("Organization and app name are required."); return; }
    if (form.type === "REQUEST_ORG_CREDENTIAL" && (!form.username.trim() || !form.password)) {
      onError("Username and password are required."); return;
    }
    if (form.type === "REQUEST_ORG_2FA" && !form.secret.trim()) {
      onError("A 2FA secret is required — scan a QR code or enter it manually."); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/vault-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, digits: parseInt(form.digits), period: parseInt(form.period) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");
      onSuccess("Request submitted. The organization admin will review it.");
      setOpen(false);
      fetchRequests();
    } catch (e: any) { onError(e.message); } finally { setSaving(false); }
  };

  const openReveal = async (r: any) => {
    setRevealTarget(r);
    setRevealData(null);
    setRevealing(true);
    try {
      const res = await fetch(`/api/vault-requests/${r.id}/reveal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reveal");
      setRevealData(data);
    } catch (e: any) { onError(e.message); setRevealTarget(null); } finally { setRevealing(false); }
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
                <Stack direction="row" spacing={1} alignItems="center">
                  {(r.status === "PENDING" || r.status === "APPROVED") && (
                    <Button size="small" startIcon={<Eye size={14} />} onClick={() => openReveal(r)}>View submitted</Button>
                  )}
                  <Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} />
                </Stack>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Request Credential / 2FA</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={0.5}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              You are vouching for a credential/2FA code you already have — the admin reviews and approves it, they do not create a new secret for you.
            </Alert>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select label="Type" value={form.type} onChange={(e) => setForm((p) => ({ ...EMPTY_FORM, type: e.target.value, organizationId: p.organizationId, appName: p.appName }))}>
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

            {form.type === "REQUEST_ORG_CREDENTIAL" ? (
              <>
                <TextField fullWidth label="Login URL (optional)" value={form.loginUrl} onChange={(e) => setForm((p) => ({ ...p, loginUrl: e.target.value }))} />
                <TextField fullWidth required label="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
                <TextField
                  fullWidth required label="Password" type={showSecret ? "text" : "password"}
                  value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
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
              </>
            ) : (
              <Box>
                <Tabs value={faMode} onChange={(_, v) => { setFaMode(v); setCameraError(null); }} sx={{ mb: 2 }}>
                  <Tab value="scan" label="Scan QR" icon={<Camera size={14} />} iconPosition="start" />
                  <Tab value="upload" label="Upload Image" icon={<Upload size={14} />} iconPosition="start" />
                  <Tab value="manual" label="Manual Entry" icon={<Keyboard size={14} />} iconPosition="start" />
                </Tabs>

                {faMode === "scan" && !qrParsed && (
                  <Box sx={{ textAlign: "center" }}>
                    <canvas ref={canvasRef} style={{ display: "none" }} />
                    <Box sx={{ position: "relative", borderRadius: 3, overflow: "hidden", bgcolor: "black", aspectRatio: "4/3", maxWidth: 320, mx: "auto" }}>
                      <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {(cameraStarting || qrParsing) && (
                        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.4)" }}>
                          <CircularProgress size={28} sx={{ color: "white" }} />
                        </Box>
                      )}
                    </Box>
                    {cameraError && (
                      <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }} action={<Button size="small" color="error" onClick={() => { setCameraError(null); startScan(); }}>Retry</Button>}>
                        {cameraError}
                      </Alert>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Point your camera at the otpauth QR code.
                    </Typography>
                  </Box>
                )}

                {faMode === "upload" && !qrParsed && (
                  <Box sx={{ textAlign: "center", py: 3, border: "2px dashed", borderColor: "divider", borderRadius: 3 }}>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleQrUpload} />
                    <Button variant="outlined" startIcon={qrParsing ? <CircularProgress size={16} /> : <Upload size={16} />} disabled={qrParsing} onClick={() => fileInputRef.current?.click()}>
                      {qrParsing ? "Parsing…" : "Choose QR Image"}
                    </Button>
                  </Box>
                )}

                {(faMode === "manual" || qrParsed) && (
                  <Stack spacing={2}>
                    {qrParsed && (
                      <Alert severity="success" sx={{ borderRadius: 2 }} action={<Button size="small" onClick={() => { setQrParsed(false); setForm((p) => ({ ...p, secret: "" })); setFaMode("scan"); }}>Rescan</Button>}>
                        QR code scanned — review the fields below.
                      </Alert>
                    )}
                    <TextField
                      fullWidth required label="Secret (Base32)" type={showSecret ? "text" : "password"}
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
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 4 }}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Algorithm</InputLabel>
                          <Select label="Algorithm" value={form.algorithm} onChange={(e) => setForm((p) => ({ ...p, algorithm: e.target.value }))}>
                            <MenuItem value="SHA1">SHA1</MenuItem>
                            <MenuItem value="SHA256">SHA256</MenuItem>
                            <MenuItem value="SHA512">SHA512</MenuItem>
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
                          <InputLabel>Period</InputLabel>
                          <Select label="Period" value={form.period} onChange={(e) => setForm((p) => ({ ...p, period: e.target.value }))}>
                            <MenuItem value="30">30</MenuItem>
                            <MenuItem value="60">60</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  </Stack>
                )}
              </Box>
            )}

            <Divider />
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

      {/* View submitted secret */}
      <Dialog open={!!revealTarget} onClose={() => setRevealTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}><Lock size={18} /> Submitted Secret</DialogTitle>
        <DialogContent dividers>
          {revealing ? (
            <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={24} /></Box>
          ) : revealData ? (
            revealTarget?.type === "REQUEST_ORG_CREDENTIAL" ? (
              <Stack spacing={2}>
                <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>USERNAME</Typography><Typography variant="body2" sx={{ fontFamily: "monospace" }}>{revealData.username}</Typography></Box>
                <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>PASSWORD</Typography><Typography variant="body2" sx={{ fontFamily: "monospace" }}>{revealData.password}</Typography></Box>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>SECRET</Typography><Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>{revealData.secret}</Typography></Box>
                <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>CONFIG</Typography><Typography variant="body2">{revealData.algorithm} · {revealData.digits} digits · {revealData.period}s</Typography></Box>
              </Stack>
            )
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRevealTarget(null)} startIcon={<X size={14} />}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
