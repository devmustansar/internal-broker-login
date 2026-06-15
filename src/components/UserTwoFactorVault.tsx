"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box, Typography, Paper, Grid, Chip, IconButton, Tooltip, Skeleton, Alert,
  Stack, TextField, InputAdornment, LinearProgress, alpha, useTheme,
} from "@mui/material";
import { Search, Copy, Check, RefreshCw, Lock, ShieldAlert } from "lucide-react";

interface AssignedEntry {
  id: string;
  assignmentId: string;
  appName: string;
  issuer: string | null;
  accountLabel: string | null;
  algorithm: string;
  digits: number;
  period: number;
  category: string | null;
  environment: string | null;
  notes: string | null;
  organization: { id: string; name: string };
  assignedAt: string;
}

interface OtpState {
  otp: string | null;
  remainingSeconds: number;
  expiresAt: string | null;
  loading: boolean;
  error: string | null;
}

function OtpCard({ entry }: { entry: AssignedEntry }) {
  const theme = useTheme();
  const [otpState, setOtpState] = useState<OtpState>({
    otp: null, remainingSeconds: entry.period, expiresAt: null, loading: true, error: null,
  });
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);

  const fetchOtp = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setOtpState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/2fa/${entry.id}/otp`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setOtpState({
        otp: data.otp,
        remainingSeconds: data.remainingSeconds,
        expiresAt: data.expiresAt,
        loading: false,
        error: null,
      });
    } catch (e: any) {
      setOtpState((prev) => ({ ...prev, otp: null, loading: false, error: e.message }));
    } finally {
      fetchingRef.current = false;
    }
  }, [entry.id]);

  // Countdown tick — schedules a refetch when the timer hits 0
  useEffect(() => {
    if (otpState.loading || otpState.error) return;
    if (otpState.remainingSeconds <= 0) { fetchOtp(); return; }

    timerRef.current = setTimeout(() => {
      setOtpState((prev) => ({ ...prev, remainingSeconds: Math.max(0, prev.remainingSeconds - 1) }));
    }, 1000);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [otpState.remainingSeconds, otpState.loading, otpState.error, fetchOtp]);

  // Initial fetch
  useEffect(() => { fetchOtp(); }, [fetchOtp]);

  const handleCopy = async () => {
    if (!otpState.otp) return;
    await navigator.clipboard.writeText(otpState.otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    fetch(`/api/2fa/${entry.id}/log-copy`, { method: "POST" }).catch(() => {});
  };

  const progress = otpState.remainingSeconds / entry.period;
  const progressColor =
    otpState.remainingSeconds > 10 ? "success" :
    otpState.remainingSeconds > 5 ? "warning" : "error";

  const formatOtp = (code: string) => {
    if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
    if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
    return code;
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 3,
        borderRadius: 4,
        height: "100%",
        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        transition: "border-color 0.2s",
        "&:hover": { borderColor: alpha(theme.palette.primary.main, 0.3) },
      }}
    >
      {/* Entry info */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 0.75, mb: 0.25 }}>
          <Lock size={14} style={{ flexShrink: 0 }} /> {entry.appName}
        </Typography>
        {(entry.issuer || entry.accountLabel) && (
          <Typography variant="caption" color="text.secondary">
            {[entry.issuer, entry.accountLabel].filter(Boolean).join(" · ")}
          </Typography>
        )}
        <Box sx={{ mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary">{entry.organization.name}</Typography>
          {entry.category && <Chip label={entry.category} size="small" sx={{ ml: 1, height: 18, fontSize: "0.65rem" }} />}
          {entry.environment && (
            <Chip label={entry.environment} size="small" color="info" variant="outlined"
              sx={{ ml: 0.5, height: 18, fontSize: "0.65rem" }} />
          )}
        </Box>
      </Box>

      {/* OTP code area */}
      <Box
        sx={{
          bgcolor: alpha(theme.palette.background.default, 0.6),
          borderRadius: 3,
          p: 2,
          textAlign: "center",
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
        }}
      >
        {otpState.loading ? (
          <Skeleton variant="text" width="60%" height={48} sx={{ mx: "auto" }} />
        ) : otpState.error ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <ShieldAlert size={16} color={theme.palette.error.main} />
            <Typography variant="caption" color="error">{otpState.error}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <Typography
              variant="h4"
              sx={{
                fontFamily: "monospace",
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: progressColor === "error"
                  ? theme.palette.error.main
                  : progressColor === "warning"
                    ? theme.palette.warning.main
                    : "text.primary",
              }}
            >
              {formatOtp(otpState.otp!)}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy OTP"}>
              <IconButton size="small" onClick={handleCopy} color={copied ? "success" : "default"}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Countdown bar */}
        {!otpState.error && (
          <Box sx={{ mt: 1.5 }}>
            <LinearProgress
              variant="determinate"
              value={progress * 100}
              color={progressColor}
              sx={{ height: 4, borderRadius: 2 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {otpState.loading ? "Loading…" : `${otpState.remainingSeconds}s`}
            </Typography>
          </Box>
        )}
      </Box>

      {entry.notes && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
          {entry.notes}
        </Typography>
      )}
    </Paper>
  );
}

export default function UserTwoFactorVault() {
  const [entries, setEntries] = useState<AssignedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/2fa");
      if (!res.ok) throw new Error("Failed to load 2FA entries");
      setEntries(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, [refreshKey]);

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.appName?.toLowerCase().includes(q) ||
      e.issuer?.toLowerCase().includes(q) ||
      e.accountLabel?.toLowerCase().includes(q) ||
      e.organization?.name?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map((i) => (
          <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={i}>
            <Skeleton variant="rounded" height={200} sx={{ borderRadius: 4 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Search by app, issuer, org…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          sx={{ minWidth: 280, "& .MuiInputBase-root": { borderRadius: 3 } }}
        />
        <Tooltip title="Refresh list">
          <IconButton onClick={() => setRefreshKey((k) => k + 1)} size="small">
            <RefreshCw size={16} />
          </IconButton>
        </Tooltip>
      </Box>

      {filtered.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          {search ? "No entries match your search." : "No authenticator codes have been shared with you yet."}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {filtered.map((entry) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={entry.id}>
              <OtpCard entry={entry} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
