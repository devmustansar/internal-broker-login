"use client";

import { useState } from "react";
import type { OpenAppResponse, BrokerSession } from "@/types";
import { useApp } from "@/lib/app-context";
import { 
  Box, 
  Typography, 
  Button, 
  Chip, 
  Paper, 
  Modal, 
  Stack, 
  Divider, 
  IconButton, 
  Tooltip,
  alpha,
  useTheme,
  Fade,
  Backdrop,
  Skeleton
} from "@mui/material";
import { 
  CheckCircle2, 
  Clock, 
  Check, 
  TerminalSquare, 
  Activity, 
  ExternalLink, 
  XCircle,
  Copy,
  Hash,
  Globe,
  Zap,
  MoreVertical,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SessionSuccessModalProps {
  result: OpenAppResponse;
  onClose: () => void;
}

export function SessionSuccessModal({ result, onClose }: SessionSuccessModalProps) {
  const theme = useTheme();
  const timeLeft = Math.max(
    0,
    Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000 / 60)
  );

  return (
    <Modal
      open={true}
      onClose={onClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 500,
        sx: { backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }
      }}
    >
      <Fade in={true}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: 480,
          outline: 'none',
          p: 1
        }}>
          <Paper
            elevation={24}
            sx={{
              p: 5,
              borderRadius: 8,
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: alpha(theme.palette.background.paper, 0.6),
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              boxShadow: `0 0 80px ${alpha(theme.palette.primary.main, 0.15)}`,
            }}
          >
            {/* Success Header */}
            <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 6 }}>
              <Box sx={{ 
                width: 56, 
                height: 56, 
                borderRadius: 4, 
                bgcolor: alpha(theme.palette.success.main, 0.1),
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.1)}`
              }}>
                <CheckCircle2 color={theme.palette.success.main} size={28} />
              </Box>
              <Box flexGrow={1}>
                <Typography variant="h3" sx={{ fontSize: '1.25rem', fontWeight: 800 }}>Access Handshake</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Zero-trust cluster session established.</Typography>
              </Box>
              <Chip 
                label={result.status} 
                color="primary" 
                size="small" 
                sx={{ borderRadius: 2, fontWeight: 900, fontSize: '0.65rem' }} 
              />
            </Stack>

            {/* Session Details */}
            <Stack spacing={2} sx={{ mt: 4, mb: 6, p: 3, borderRadius: 4, bgcolor: alpha(theme.palette.background.paper, 0.4), border: `1px solid ${theme.palette.divider}` }}>
              <DataRow label="Topology ID" value={result.brokerSessionId} mono copy />
              <DataRow label="Target" value={result.resourceKey} />
              <DataRow label="App Gateway" value={result.appHost} mono />
              <DataRow label="Lease TTL" value={`${new Date(result.expiresAt).toLocaleTimeString()} (~${timeLeft}m)`} />
            </Stack>

            {/* Actions */}
            <Stack direction="row" spacing={2}>
              {result.redirectUrl ? (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => {
                    window.open(result.redirectUrl, "_blank");
                    onClose();
                  }}
                  sx={{ py: 1.5, fontWeight: 800 }}
                  endIcon={<ExternalLink size={18} />}
                >
                  Enter Platform
                </Button>
              ) : result.handoffToken ? (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={() => {
                    const host = result.appHost.replace(/^https?:\/\//, "");
                    window.open(`https://${host}/_proxy/bootstrap?token=${result.handoffToken}`, "_blank");
                    onClose();
                  }}
                  sx={{ py: 1.5, fontWeight: 800 }}
                  endIcon={<ExternalLink size={18} />}
                >
                  Enter Platform
                </Button>
              ) : null}
              <Button
                variant="outlined"
                size="large"
                onClick={onClose}
                sx={{ px: 4, borderRadius: 3, fontWeight: 700 }}
              >
                Dismiss
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Fade>
    </Modal>
  );
}

export function SessionPanel() {
  const { sessions, endSession } = useApp();
  const [ending, setEnding] = useState<string | null>(null);
  const theme = useTheme();

  if (sessions.length === 0) return null;

  const handleEnd = async (id: string) => {
    setEnding(id);
    try {
      await endSession(id);
    } finally {
      setEnding(null);
    }
  };

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 4, 
        borderRadius: 5, 
        bgcolor: alpha(theme.palette.background.paper, 0.4),
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.palette.divider}`
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <Activity size={16} color={theme.palette.success.main} /> Active Cluster Sessions
        </Typography>
        <Chip 
          label={sessions.length.toString()} 
          size="small" 
          sx={{ borderRadius: 2, fontWeight: 900, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.light', border: `1px solid ${alpha(theme.palette.success.main, 0.2)}` }} 
        />
      </Box>

      <Stack spacing={2}>
        <AnimatePresence>
          {sessions.map((session) => (
            <motion.div
              key={session.brokerSessionId}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, height: 0, margin: 0, overflow: 'hidden' }}
            >
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2.5, 
                  borderRadius: 4, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 3, 
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02), borderColor: alpha(theme.palette.primary.main, 0.2) }
                }}
              >
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: session.status === 'active' ? 'success.main' : 'text.disabled',
                  boxShadow: session.status === 'active' ? `0 0 12px ${theme.palette.success.main}` : 'none',
                  animation: session.status === 'active' ? 'pulse 2s infinite' : 'none'
                }} />

                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {session.resourceKey}
                    <Chip label={session.status} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase' }} />
                  </Typography>
                  <Stack direction="row" spacing={3}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontWeight: 400 }}>
                      {session.brokerSessionId.slice(0, 16)}…
                    </Typography>
                    {session.status === 'active' && (
                      <Typography variant="caption" sx={{ color: 'success.light', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Clock size={10} /> {Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000 / 60))}m
                      </Typography>
                    )}
                  </Stack>
                </Box>

                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => handleEnd(session.brokerSessionId)}
                  disabled={ending === session.brokerSessionId}
                  sx={{ borderRadius: 2, border: 'none', bgcolor: alpha(theme.palette.error.main, 0.05), '&:hover': { border: 'none', bgcolor: alpha(theme.palette.error.main, 0.1) } }}
                >
                  Terminate
                </Button>
              </Paper>
            </motion.div>
          ))}
        </AnimatePresence>
      </Stack>
    </Paper>
  );
}

export function DebugPanel({ result }: { result: OpenAppResponse | null }) {
  const theme = useTheme();
  if (!result) return null;

  return (
    <Paper 
      elevation={1} 
      sx={{ 
        p: 4, 
        borderRadius: 5, 
        bgcolor: alpha(theme.palette.background.paper, 0.4),
        border: `1px solid ${theme.palette.divider}` 
      }}
    >
      <Typography variant="caption" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'primary.main', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <TerminalSquare size={16} /> Topology Telemetry
      </Typography>

      <Box sx={{ 
        p: 3, 
        borderRadius: 4, 
        bgcolor: '#0d0d0d', 
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        position: 'relative'
      }}>
        <pre style={{ 
          margin: 0, 
          fontSize: '0.7rem', 
          fontFamily: 'monospace', 
          color: theme.palette.primary.light, 
          opacity: 0.8,
          overflow: 'auto',
          maxHeight: 300
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </Box>
    </Paper>
  );
}

function DataRow({
  label,
  value,
  mono = false,
  copy = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, pb: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`, '&:last-child': { border: 0, pb: 0 } }}>
      <Typography variant="caption" sx={{ width: 100, flexShrink: 0, fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem' }}>{label.toUpperCase()}</Typography>
      <Typography variant="caption" sx={{ flexGrow: 1, fontWeight: 600, color: mono ? 'primary.light' : 'text.primary', fontFamily: mono ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Typography>
      {copy && (
        <IconButton size="small" onClick={handleCopy} sx={{ borderRadius: 2, bgcolor: copied ? 'success.main' : alpha(theme.palette.divider, 0.5), color: copied ? 'white' : 'text.secondary', '&:hover': { bgcolor: copied ? 'success.dark' : alpha(theme.palette.divider, 1) } }}>
          {copied ? <Check size={14} /> : <Copy size={12} />}
        </IconButton>
      )}
    </Box>
  );
}
