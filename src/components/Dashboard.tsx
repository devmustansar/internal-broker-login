"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/app-context";
import type { OpenAppResponse } from "@/types";
import TopBar from "@/components/layout/TopBar";
import AppCard from "@/components/AppCard";
import AwsAppCard from "@/components/AwsAppCard";
import {
  SessionSuccessModal,
  SessionPanel,
  DebugPanel,
} from "@/components/SessionPanel";
import AdminPanel from "@/components/AdminPanel";
import UserCredentialVault from "@/components/UserCredentialVault";
import { APP_DESCRIPTION, APP_ADMIN_DESCRIPTION } from "@/lib/constants";
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  Stack,
  Avatar,
  Chip,
  Skeleton,
  alpha,
  useTheme,
  Divider,
  Fade,
  Alert,
  Autocomplete,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  RefreshCw,
  LayoutDashboard,
  Settings2,
  Activity,
  Zap,
  Info,
  Database,
  Search,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Dashboard() {
  const { user, resources, fetchResources, lastOpenResult, sessions } = useApp();
  const theme = useTheme();
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [modal, setModal] = useState<OpenAppResponse | null>(null);
  const [view, setView] = useState<"apps" | "credentials" | "admin">("apps");

  // Org admin/owner: view resources for a specific user
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [viewAsUser, setViewAsUser] = useState<any | null>(null);
  const [viewAsResources, setViewAsResources] = useState<any[]>([]);
  const [isLoadingViewAs, setIsLoadingViewAs] = useState(false);
  const [viewAsError, setViewAsError] = useState<string | null>(null);
  const [userSearchInput, setUserSearchInput] = useState("");

  const isOrgAdminOrOwner = useMemo(
    () => Object.values((user?.orgRoles || {}) as Record<string, string>).some((r) => r === "admin" || r === "owner"),
    [user]
  );

  useEffect(() => {
    const load = async () => {
      setIsLoadingResources(true);
      setResourceError(null);
      try {
        await fetchResources();
      } catch (err) {
        setResourceError(err instanceof Error ? err.message : "Failed to load apps");
      } finally {
        setIsLoadingResources(false);
      }
    };
    load();
  }, []);

  // Load org users for the search autocomplete (admins/owners only)
  useEffect(() => {
    if (!isOrgAdminOrOwner && user?.role !== "super_admin") return;
    fetch("/api/admin/users")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        // Exclude self
        setOrgUsers(data.filter((u) => u.id !== user?.id));
      })
      .catch(() => {});
  }, [isOrgAdminOrOwner, user]);

  // Fetch resources when a user is selected
  useEffect(() => {
    if (!viewAsUser) { setViewAsResources([]); return; }
    setIsLoadingViewAs(true);
    setViewAsError(null);
    fetch(`/api/admin/users/resources?userId=${viewAsUser.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setViewAsResources(data.resources || []);
      })
      .catch((err) => setViewAsError(err.message || "Failed to load user resources"))
      .finally(() => setIsLoadingViewAs(false));
  }, [viewAsUser]);

  const activeSessions = sessions.filter((s) => s.status === "active").length;
  const displayedResources = viewAsUser ? viewAsResources : resources;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <TopBar />

      <Container maxWidth="xl" sx={{ py: 6, flex: 1, position: 'relative' }}>
        {/* Glow effect */}
        <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          left: '50%', 
          transform: 'translateX(-50%)', 
          width: '60%', 
          height: 400, 
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`,
          filter: 'blur(100px)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        {/* Header */}
        <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 3, position: 'relative', zIndex: 1 }}>
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 800 }}>
              Hello, {user?.name?.split(" ")[0]}
            </Typography>
            <Typography variant="subtitle1">
              {view === "apps" ? APP_DESCRIPTION : view === "credentials" ? "Securely access credentials shared with you." : APP_ADMIN_DESCRIPTION}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <Paper elevation={0} sx={{ p: 0.5, borderRadius: 3, display: 'flex', bgcolor: alpha(theme.palette.background.paper, 0.5), border: `1px solid ${theme.palette.divider}` }}>
              <Button 
                variant={view === 'apps' ? 'contained' : 'text'}
                onClick={() => setView('apps')}
                startIcon={<LayoutDashboard size={16} />}
                sx={{ borderRadius: 2.5, px: 2, py: 0.8, color: view === 'apps' ? 'white' : 'text.secondary' }}
              >
                Dashboard
              </Button>
              <Button
                variant={view === 'credentials' ? 'contained' : 'text'}
                onClick={() => setView('credentials')}
                startIcon={<Database size={16} />}
                sx={{ borderRadius: 2.5, px: 2, py: 0.8, color: view === 'credentials' ? 'white' : 'text.secondary' }}
              >
                Shared Credentials
              </Button>
              {(user?.role === "admin" || user?.role === "super_admin" || (Object.values((user?.orgRoles || {}) as Record<string, string>)).some((r) => r === "admin" || r === "owner")) && (
                <Button 
                  variant={view === 'admin' ? 'contained' : 'text'}
                  onClick={() => setView('admin')}
                  startIcon={<Settings2 size={16} />}
                  sx={{ borderRadius: 2.5, px: 2, py: 0.8, color: view === 'admin' ? 'white' : 'text.secondary' }}
                >
                  Admin
                </Button>
              )}
            </Paper>

            <AnimatePresence>
              {activeSessions > 0 && (
                <Fade in={true}>
                  <Chip
                    label={`${activeSessions} Active ${activeSessions === 1 ? "Session" : "Sessions"}`}
                    color="success"
                    variant="outlined"
                    sx={{ 
                      borderRadius: 2, 
                      fontWeight: 700, 
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      borderColor: alpha(theme.palette.success.main, 0.2),
                      '& .MuiChip-label': { px: 2 }
                    }}
                    icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', ml: 1, animation: 'pulse 2s infinite' }} />}
                  />
                </Fade>
              )}
            </AnimatePresence>
          </Stack>
        </Box>

        {view === "credentials" ? (
          <Fade in={true}>
            <Box>
              <UserCredentialVault />
            </Box>
          </Fade>
        ) : view === "apps" ? (
          <Grid container spacing={4} sx={{ position: 'relative', zIndex: 1 }}>
            {/* Main Area */}
            <Grid size={{ xs: 12, xl: 9 }}>
              <Paper 
                elevation={1} 
                sx={{ 
                  p: { xs: 3, md: 5 }, 
                  borderRadius: 6,
                  backgroundColor: alpha(theme.palette.background.paper, 0.4),
                  backdropFilter: 'blur(20px)',
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: (isOrgAdminOrOwner || user?.role === 'super_admin') ? 3 : 6 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <Zap size={24} color={theme.palette.primary.main} style={{ margin: 'auto' }} />
                    </Box>
                    <Box>
                      <Typography variant="h3" sx={{ fontSize: '1.25rem' }}>Applications Directory</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {viewAsUser ? `Viewing resources for ${viewAsUser.name}` : "Select an application to get started."}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 800, px: 2, py: 0.8, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                      {displayedResources.length} AVAILABLE
                    </Typography>
                    {!viewAsUser && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setIsLoadingResources(true);
                          fetchResources().finally(() => setIsLoadingResources(false));
                        }}
                        sx={{ borderRadius: 2.5, borderColor: 'rgba(255,255,255,0.1)', color: 'text.secondary' }}
                        startIcon={<RefreshCw size={14} className={isLoadingResources ? 'animate-spin' : ''} />}
                      >
                        Sync
                      </Button>
                    )}
                  </Stack>
                </Box>

                {/* User search for org admins/owners */}
                {(isOrgAdminOrOwner || user?.role === 'super_admin') && (
                  <Box sx={{ mb: 4 }}>
                    <Autocomplete
                      options={orgUsers}
                      value={viewAsUser}
                      inputValue={userSearchInput}
                      onInputChange={(_, val) => setUserSearchInput(val)}
                      onChange={(_, val) => { setViewAsUser(val); setUserSearchInput(""); }}
                      getOptionLabel={(u) => `${u.name} — ${u.email}`}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      size="small"
                      clearOnEscape
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Search a user by name or email to view their resources…"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search size={15} color={theme.palette.text.secondary} />
                              </InputAdornment>
                            ),
                          }}
                          sx={{ '& .MuiInputBase-root': { borderRadius: 3, bgcolor: alpha(theme.palette.background.default, 0.5) }, '& .MuiInputBase-input': { fontSize: '0.85rem' } }}
                        />
                      )}
                      renderOption={(props, u) => (
                        <li {...props} key={u.id}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{u.name}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{u.email}</Typography>
                          </Box>
                        </li>
                      )}
                    />
                    {viewAsUser && (
                      <Button
                        size="small"
                        startIcon={<X size={13} />}
                        onClick={() => { setViewAsUser(null); setUserSearchInput(""); }}
                        sx={{ mt: 1, color: 'text.secondary', fontSize: '0.75rem' }}
                      >
                        Clear — show my resources
                      </Button>
                    )}
                  </Box>
                )}

                {(resourceError && !viewAsUser) && (
                  <Alert severity="error" sx={{ mb: 4, borderRadius: 3 }}>{resourceError}</Alert>
                )}
                {viewAsError && (
                  <Alert severity="error" sx={{ mb: 4, borderRadius: 3 }}>{viewAsError}</Alert>
                )}

                {(viewAsUser ? isLoadingViewAs : isLoadingResources) ? (
                  <Grid container spacing={3}>
                    {[1, 2, 3, 4].map((i) => (
                      <Grid size={{ xs: 12, md: 6 }} key={i}>
                        <Skeleton variant="rectangular" height={210} sx={{ borderRadius: 4, bgcolor: alpha(theme.palette.background.paper, 0.5) }} />
                      </Grid>
                    ))}
                  </Grid>
                ) : displayedResources.length === 0 ? (
                  <Box sx={{ py: 10, textAlign: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: 4, bgcolor: alpha(theme.palette.background.paper, 0.2) }}>
                    <Info size={40} color={theme.palette.text.secondary} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {viewAsUser ? `No applications assigned to ${viewAsUser.name}.` : "No applications provisioned for your identity."}
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={3}>
                    {displayedResources.map((r) => (
                      <Grid size={{ xs: 12, md: 6 }} key={r.id}>
                        {"awsAccountId" in r ? (
                          <AwsAppCard resource={r} />
                        ) : (
                          <AppCard
                            resource={r}
                            onOpen={(result) => setModal(result)}
                          />
                        )}
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Paper>

              <Box sx={{ mt: 4 }}>
                <SessionPanel />
              </Box>
            </Grid>

            {/* Sidebar */}
            <Grid size={{ xs: 12, xl: 3 }}>
              <Stack spacing={3}>
                {/* Persona Card */}
                <Paper sx={{ p: 4, borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`, pointerEvents: 'none' }} />
                  
                  <Typography variant="caption" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>
                    <Activity size={14} /> CURRENT PERSONA
                  </Typography>

                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
                    <Avatar 
                      sx={{ 
                        width: 56, 
                        height: 56, 
                        bgcolor: 'primary.main',
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                        boxShadow: `0 8px 16px ${alpha(theme.palette.primary.main, 0.25)}`,
                        border: '2px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {user?.name?.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 800 }}>{user?.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>{user?.email}</Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ mb: 3 }} />

                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>ACCESS LEVEL</Typography>
                      <Chip label={user?.role} size="small" variant="outlined" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.65rem' }} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>RESOURCE SCOPE</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'primary.light' }}>
                        {user?.role === "super_admin" ? "ALL_RESOURCES" : `${resources.length} ENTRIES`}
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Debug Tools */}
                <DebugPanel result={lastOpenResult} />

              </Stack>
            </Grid>
          </Grid>
        ) : (
          <Fade in={true}>
            <Box>
              <AdminPanel />
            </Box>
          </Fade>
        )}
      </Container>

      {/* Modal */}
      {modal && (
        <SessionSuccessModal result={modal} onClose={() => setModal(null)} />
      )}
    </Box>
  );
}
