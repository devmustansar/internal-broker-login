"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  LinearProgress,
  CircularProgress,
  Alert,
  Button,
  Divider,
  alpha,
  useTheme,
} from "@mui/material";
import { ShieldCheck, Copy, Check, Eye, EyeOff } from "lucide-react";

interface LinkedOtpDisplayProps {
  resourceId?: string;
  awsResourceId?: string;
  credentialId?: string;
  /** When true, codes load immediately on mount instead of waiting for user click. */
  autoReveal?: boolean;
}

interface OtpCode {
  id: string;
  appName: string;
  issuer: string | null;
  accountLabel: string | null;
  otp: string;
  remainingSeconds: number;
  expiresAt: string;
  period: number;
  digits: number;
}

export default function LinkedOtpDisplay({
  resourceId,
  awsResourceId,
  credentialId,
  autoReveal = false,
}: LinkedOtpDisplayProps) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(autoReveal);
  const [codes, setCodes] = useState<OtpCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [, forceUpdate] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (resourceId) params.set("resourceId", resourceId);
      if (awsResourceId) params.set("awsResourceId", awsResourceId);
      if (credentialId) params.set("credentialId", credentialId);

      const res = await fetch(`/api/2fa/linked-otp?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load 2FA codes");
      }
      const data: OtpCode[] = await res.json();
      setCodes(data);
      setFetchedAt(Date.now());

      if (data.length > 0) {
        const minRemaining = Math.min(...data.map((d) => d.remainingSeconds));
        if (refreshRef.current) clearTimeout(refreshRef.current);
        // +1.5 s buffer so we land after the server period boundary
        refreshRef.current = setTimeout(fetchCodes, (minRemaining + 1.5) * 1000);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!revealed) return;

    fetchCodes();
    tickRef.current = setInterval(() => forceUpdate((n) => n + 1), 1000);

    return () => {
      if (refreshRef.current) clearTimeout(refreshRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const handleToggle = () => {
    if (revealed) {
      // collapse — stop timers
      if (refreshRef.current) clearTimeout(refreshRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      setCodes([]);
    }
    setRevealed((r) => !r);
  };

  const handleCopy = (otp: string, id: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format OTP as "XXX XXX" or "XXXX XXXX"
  const formatOtp = (otp: string) => {
    const mid = Math.ceil(otp.length / 2);
    return `${otp.slice(0, mid)} ${otp.slice(mid)}`;
  };

  const elapsed = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 1000) : 0;
  const liveCodes = codes.map((c) => ({
    ...c,
    remaining: Math.max(0, c.remainingSeconds - elapsed),
  }));

  return (
    <Box>
      {/* Header row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <ShieldCheck size={13} color={theme.palette.success.main} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, color: "text.secondary", flexGrow: 1, fontSize: "0.7rem" }}
        >
          2FA CODES
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={handleToggle}
          startIcon={revealed ? <EyeOff size={11} /> : <Eye size={11} />}
          sx={{
            fontSize: "0.68rem",
            textTransform: "none",
            py: 0,
            px: 0.5,
            minWidth: 0,
            color: "text.secondary",
            lineHeight: 1.4,
          }}
        >
          {revealed ? "Hide" : "Show"}
        </Button>
      </Box>

      {/* Expanded codes */}
      {revealed && (
        <Box sx={{ mt: 1 }}>
          {loading && codes.length === 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.75 }}>
              <CircularProgress size={13} />
              <Typography variant="caption" color="text.secondary">
                Generating…
              </Typography>
            </Box>
          )}

          {error && (
            <Alert
              severity="error"
              sx={{ py: 0.25, px: 1.5, fontSize: "0.7rem", borderRadius: 2, mt: 0.5 }}
            >
              {error}
            </Alert>
          )}

          {liveCodes.map((code, i) => {
            const urgency =
              code.remaining <= 5 ? "error" : code.remaining <= 10 ? "warning" : "success";
            const progress = (code.remaining / code.period) * 100;
            const borderColor = alpha(theme.palette[urgency].main, 0.3);
            const bgColor = alpha(theme.palette[urgency].main, 0.04);

            return (
              <Box key={code.id}>
                {i > 0 && <Divider sx={{ my: 0.75, opacity: 0.3 }} />}
                <Box
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    border: `1px solid ${borderColor}`,
                    bgcolor: bgColor,
                  }}
                >
                  {/* App label */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontWeight: 600,
                      display: "block",
                      mb: 0.5,
                      fontSize: "0.68rem",
                    }}
                  >
                    {[code.appName, code.issuer !== code.appName ? code.issuer : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {code.accountLabel && (
                      <span style={{ opacity: 0.6 }}> — {code.accountLabel}</span>
                    )}
                  </Typography>

                  {/* Code row */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "1.45rem",
                        fontWeight: 900,
                        letterSpacing: "0.18em",
                        color: theme.palette[urgency].main,
                        flexGrow: 1,
                        lineHeight: 1,
                        userSelect: "all",
                      }}
                    >
                      {formatOtp(code.otp)}
                    </Typography>

                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette[urgency].main,
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        minWidth: 24,
                        textAlign: "right",
                      }}
                    >
                      {code.remaining}s
                    </Typography>

                    <Tooltip title={copiedId === code.id ? "Copied!" : "Copy code"}>
                      <IconButton
                        size="small"
                        onClick={() => handleCopy(code.otp, code.id)}
                        sx={{
                          p: 0.5,
                          color: copiedId === code.id ? "success.main" : "text.secondary",
                          transition: "color 0.2s",
                        }}
                      >
                        {copiedId === code.id ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Progress bar */}
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    color={urgency}
                    sx={{
                      mt: 0.75,
                      height: 3,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette[urgency].main, 0.1),
                      "& .MuiLinearProgress-bar": { borderRadius: 2 },
                    }}
                  />
                </Box>
              </Box>
            );
          })}

          {!loading && !error && liveCodes.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              No active 2FA codes linked.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
