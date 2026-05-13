"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Paper, Grid, Chip, IconButton, Tooltip, Skeleton, Alert, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, useTheme, alpha,
  TablePagination, InputAdornment, Container
} from "@mui/material";
import { KeyRound, AppWindow, Copy, Check, Eye, EyeOff, Lock, Users, Search, RefreshCw } from "lucide-react";

const ROWS_PER_PAGE_OPTIONS = [6, 12, 24];

export default function UserCredentialVault() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCred, setSelectedCred] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const theme = useTheme();

  // Search & pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials");
      if (!res.ok) throw new Error("Failed to load credentials");
      const data = await res.json();
      setCredentials(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return credentials;
    const q = search.toLowerCase();
    return credentials.filter(c =>
      c.appName?.toLowerCase().includes(q) ||
      c.loginUrl?.toLowerCase().includes(q) ||
      c.organization?.name?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [credentials, search]);

  // Reset to first page on search change
  useEffect(() => { setPage(0); }, [search]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {/* Header */}
      <Paper
        elevation={1}
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 6,
          backgroundColor: alpha(theme.palette.background.paper, 0.4),
          backdropFilter: 'blur(20px)',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              <KeyRound size={24} color={theme.palette.primary.main} />
            </Box>
            <Box>
              <Typography variant="h3" sx={{ fontSize: '1.25rem' }}>Shared Credentials</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>Secure credentials shared by your organization admins.</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 800, px: 2, py: 0.8, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
              {filtered.length} CREDENTIAL{filtered.length !== 1 ? 'S' : ''}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={fetchCredentials}
              sx={{ borderRadius: 2.5, borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }}
              startIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            >
              Sync
            </Button>
          </Stack>
        </Box>

        {/* Search */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search by app name, login URL, organization, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={16} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 3,
            '& .MuiInputBase-root': { borderRadius: 3, bgcolor: alpha(theme.palette.background.default, 0.5) },
            '& .MuiInputBase-input': { fontSize: '0.85rem' },
          }}
        />

        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3, 4].map(i => (
              <Grid size={{ xs: 12, md: 6 }} key={i}>
                <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 4, bgcolor: alpha(theme.palette.background.paper, 0.5) }} />
              </Grid>
            ))}
          </Grid>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: 4, bgcolor: alpha(theme.palette.background.paper, 0.2) }}>
            <KeyRound size={40} color={theme.palette.text.secondary} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {search ? "No credentials match your search." : "No credentials have been shared with you yet."}
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={3}>
              {paginated.map(cred => (
                <Grid size={{ xs: 12, md: 6 }} key={cred.id}>
                  <Paper
                    onClick={() => { setSelectedCred(cred); setShowPassword(false); }}
                    sx={{
                      p: 3,
                      borderRadius: 4,
                      cursor: 'pointer',
                      border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.02)
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AppWindow size={16} color={theme.palette.primary.main} /> {cred.appName}
                        </Typography>
                        {cred.username && (
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mt: 0.25 }}>
                            {cred.username}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>
                          {cred.organization?.name}
                        </Typography>
                        {cred.loginUrl && (
                          <Typography variant="caption" sx={{ color: 'primary.light', fontFamily: 'monospace', display: 'block', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cred.loginUrl}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        size="small"
                        icon={cred.sharedVia === 'direct' ? <Lock size={12} /> : <Users size={12} />}
                        label={cred.sharedVia === 'direct' ? 'Direct' : 'Group'}
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', fontWeight: 700, ml: 1, flexShrink: 0 }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              sx={{ borderTop: 'none', mt: 2, color: 'text.secondary', '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: '0.75rem', fontWeight: 600 } }}
            />
          </>
        )}
      </Paper>

      {/* Credential Details Dialog */}
      <Dialog
        open={!!selectedCred}
        onClose={() => setSelectedCred(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, backgroundImage: 'none' } }}
      >
        {selectedCred && (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
              <Stack direction="row" alignItems="center" gap={1.5}>
                <AppWindow size={20} color={theme.palette.primary.main} />
                {selectedCred.appName}
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={3}>
                {selectedCred.description && (
                  <Typography variant="body2" color="text.secondary">
                    {selectedCred.description}
                  </Typography>
                )}
                {selectedCred.loginUrl && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>LOGIN URL</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>
                      <a href={selectedCred.loginUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {selectedCred.loginUrl}
                      </a>
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>USERNAME</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={selectedCred.username}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <Tooltip title={copiedField === 'username' ? 'Copied!' : 'Copy'}>
                          <IconButton size="small" onClick={() => handleCopy(selectedCred.username, 'username')}>
                            {copiedField === 'username' ? <Check size={16} color="green" /> : <Copy size={16} />}
                          </IconButton>
                        </Tooltip>
                      )
                    }}
                    sx={{ mt: 0.5, '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>PASSWORD</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    value={selectedCred.password}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <Stack direction="row">
                          <Tooltip title={showPassword ? 'Hide' : 'Show'}>
                            <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={copiedField === 'password' ? 'Copied!' : 'Copy'}>
                            <IconButton size="small" onClick={() => handleCopy(selectedCred.password, 'password')}>
                              {copiedField === 'password' ? <Check size={16} color="green" /> : <Copy size={16} />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )
                    }}
                    sx={{ mt: 0.5, '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                  />
                </Box>
                {selectedCred.groups && selectedCred.groups.length > 0 && (
                   <Box>
                     <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>SHARED GROUPS</Typography>
                     <Stack direction="row" gap={1} flexWrap="wrap" mt={0.5}>
                       {selectedCred.groups.map((g: any) => (
                         <Chip key={g.id} label={g.name} size="small" variant="outlined" />
                       ))}
                     </Stack>
                   </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
              <Button onClick={() => setSelectedCred(null)} variant="outlined" sx={{ borderRadius: 3, fontWeight: 700 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
