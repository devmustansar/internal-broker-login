"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, CircularProgress, Alert,
  Tabs, Tab, List, ListItem, ListItemText, ListItemSecondaryAction, Grid,
  Autocomplete, TablePagination, InputAdornment
} from "@mui/material";
import { Plus, X, Lock, Users, AppWindow, Search, Upload } from "lucide-react";
import { useApp } from "@/lib/app-context";
import ExcelImportModal from "./ExcelImportModal";

const PAGE_OPTIONS = [5, 10, 25];

export default function CredentialVaultPanel({ onSuccess, onError }: { onSuccess: (msg: string) => void, onError: (msg: string) => void }) {
  const { user } = useApp();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  const [credentials, setCredentials] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Pagination
  const [credSearch, setCredSearch] = useState("");
  const [credPage, setCredPage] = useState(0);
  const [credRowsPerPage, setCredRowsPerPage] = useState(PAGE_OPTIONS[0]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupPage, setGroupPage] = useState(0);
  const [groupRowsPerPage, setGroupRowsPerPage] = useState(PAGE_OPTIONS[0]);

  // Create forms
  const [openAddCred, setOpenAddCred] = useState(false);
  const [openImportModal, setOpenImportModal] = useState(false);
  const [credForm, setCredForm] = useState({ appName: "", loginUrl: "", description: "", username: "", password: "" });
  const [savingCred, setSavingCred] = useState(false);
  const [openAddGroup, setOpenAddGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [savingGroup, setSavingGroup] = useState(false);

  // Manage states
  const [manageCred, setManageCred] = useState<any>(null);
  const [manageCredLoading, setManageCredLoading] = useState(false);
  const [shareUser, setShareUser] = useState<any>(null);

  const [manageGroup, setManageGroup] = useState<any>(null);
  const [groupMemberUser, setGroupMemberUser] = useState<any>(null);
  const [groupCredOption, setGroupCredOption] = useState<any>(null);

  useEffect(() => { fetchOrgs(); }, []);

  useEffect(() => {
    if (selectedOrgId) { fetchData(selectedOrgId); fetchOrgMembers(selectedOrgId); }
    else if (organizations.length > 0) setSelectedOrgId(organizations[0].id);
  }, [selectedOrgId, organizations, activeTab]);

  useEffect(() => { setCredPage(0); }, [credSearch]);
  useEffect(() => { setGroupPage(0); }, [groupSearch]);

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      if (res.ok) { const d = await res.json(); setOrganizations(d); if (d.length > 0 && !selectedOrgId) setSelectedOrgId(d[0].id); }
    } catch (e) { console.error(e); }
  };

  const fetchOrgMembers = async (orgId: string) => {
    try { const res = await fetch(`/api/admin/organizations/members?organizationId=${orgId}`); if (res.ok) setOrgMembers(await res.json()); } catch (e) { console.error(e); }
  };

  const fetchData = async (orgId: string) => {
    setLoading(true);
    try {
      const credRes = await fetch(`/api/admin/credentials?organizationId=${orgId}`);
      if (credRes.ok) setCredentials(await credRes.json());
      if (activeTab === 1) {
        const grpRes = await fetch(`/api/admin/credential-groups?organizationId=${orgId}`);
        if (grpRes.ok) setGroups(await grpRes.json());
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Filtered lists
  const filteredCreds = useMemo(() => {
    if (!credSearch.trim()) return credentials;
    const q = credSearch.toLowerCase();
    return credentials.filter(c => c.appName?.toLowerCase().includes(q) || c.loginUrl?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
  }, [credentials, credSearch]);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups;
    const q = groupSearch.toLowerCase();
    return groups.filter(g => g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const paginatedCreds = filteredCreds.slice(credPage * credRowsPerPage, credPage * credRowsPerPage + credRowsPerPage);
  const paginatedGroups = filteredGroups.slice(groupPage * groupRowsPerPage, groupPage * groupRowsPerPage + groupRowsPerPage);

  // CRUD handlers
  const handleCreateCredential = async () => {
    if (!credForm.appName || !credForm.username || !credForm.password || !selectedOrgId) { onError("Please fill in all required fields."); return; }
    setSavingCred(true);
    try {
      const res = await fetch("/api/admin/credentials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...credForm, organizationId: selectedOrgId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create credential");
      onSuccess("Credential created securely.");
      setOpenAddCred(false); setCredForm({ appName: "", loginUrl: "", description: "", username: "", password: "" }); fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); } finally { setSavingCred(false); }
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name || !selectedOrgId) { onError("Group name is required."); return; }
    setSavingGroup(true);
    try {
      const res = await fetch("/api/admin/credential-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...groupForm, organizationId: selectedOrgId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      onSuccess("Credential group created."); setOpenAddGroup(false); setGroupForm({ name: "", description: "" }); fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); } finally { setSavingGroup(false); }
  };

  const openManageCred = async (id: string) => {
    setManageCredLoading(true);
    try {
      const res = await fetch(`/api/admin/credentials/${id}`);
      if (!res.ok) throw new Error("Failed to load credential details");
      setManageCred(await res.json()); setShareUser(null);
    } catch (err: any) { onError(err.message); } finally { setManageCredLoading(false); }
  };

  const handleAddShare = async () => {
    if (!shareUser) return;
    try {
      const res = await fetch(`/api/admin/credentials/${manageCred.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: shareUser.user.id }) });
      if (!res.ok) throw new Error("Failed to share credential");
      onSuccess("Credential shared."); setShareUser(null); openManageCred(manageCred.id);
    } catch (err: any) { onError(err.message); }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/credentials/${manageCred.id}/share`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error("Failed to remove share");
      onSuccess("Share removed."); openManageCred(manageCred.id);
    } catch (err: any) { onError(err.message); }
  };

  const handleDeleteCredential = async () => {
    if (!confirm("Are you sure you want to delete this credential?")) return;
    try {
      const res = await fetch(`/api/admin/credentials/${manageCred.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete credential");
      onSuccess("Credential deleted."); setManageCred(null); fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); }
  };

  const openManageGroup = (group: any) => { setManageGroup(group); setGroupMemberUser(null); setGroupCredOption(null); };

  const reloadGroup = async () => {
    const res = await fetch(`/api/admin/credential-groups?organizationId=${selectedOrgId}`);
    if (res.ok) { const gs = await res.json(); setGroups(gs); setManageGroup(gs.find((g: any) => g.id === manageGroup.id) || null); }
  };

  const handleAddGroupMember = async () => {
    if (!groupMemberUser) return;
    try {
      const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: groupMemberUser.user.id }) });
      if (!res.ok) throw new Error("Failed to add member");
      onSuccess("Member added to group."); setGroupMemberUser(null); reloadGroup();
    } catch (err: any) { onError(err.message); }
  };

  const handleRemoveGroupMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error("Failed to remove member");
      onSuccess("Member removed."); reloadGroup();
    } catch (err: any) { onError(err.message); }
  };

  const handleAddGroupCred = async () => {
    if (!groupCredOption) return;
    try {
      const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/credentials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentialId: groupCredOption.id }) });
      if (!res.ok) throw new Error("Failed to add credential");
      onSuccess("Credential added to group."); setGroupCredOption(null); reloadGroup();
    } catch (err: any) { onError(err.message); }
  };

  const handleRemoveGroupCred = async (credentialId: string) => {
    try {
      const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/credentials`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentialId }) });
      if (!res.ok) throw new Error("Failed to remove credential");
      onSuccess("Credential removed."); reloadGroup();
    } catch (err: any) { onError(err.message); }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group?")) return;
    try {
      const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete group");
      onSuccess("Group deleted."); setManageGroup(null); fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); }
  };

  // Autocomplete option helpers
  const availableShareMembers = orgMembers.filter(m => !manageCred?.shares?.find((s: any) => s.userId === m.user.id));
  const availableGroupMembers = orgMembers.filter(m => !manageGroup?.members?.find((gm: any) => gm.userId === m.user.id));
  const availableGroupCreds = credentials.filter(c => !manageGroup?.credentials?.find((gc: any) => gc.credentialId === c.id));

  return (
    <Box>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <FormControl size="small" sx={{ minWidth: 250 }}>
          <InputLabel>Organization Scope</InputLabel>
          <Select label="Organization Scope" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
            {organizations.map((org) => (<MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {activeTab === 0 && (
            <Button variant="outlined" startIcon={<Upload size={16} />} onClick={() => setOpenImportModal(true)} disabled={!selectedOrgId} sx={{ borderRadius: 3, fontWeight: 700 }}>
              Import Excel
            </Button>
          )}
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => activeTab === 0 ? setOpenAddCred(true) : setOpenAddGroup(true)} disabled={!selectedOrgId} sx={{ borderRadius: 3, fontWeight: 700 }}>
            {activeTab === 0 ? "Add Credential" : "Create Group"}
          </Button>
        </Box>
      </Box>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Credentials" />
        <Tab label="Credential Groups" />
      </Tabs>

      {/* Search */}
      <TextField fullWidth size="small" placeholder={activeTab === 0 ? "Search by app name, URL, description..." : "Search by group name or description..."} value={activeTab === 0 ? credSearch : groupSearch} onChange={(e) => activeTab === 0 ? setCredSearch(e.target.value) : setGroupSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
        sx={{ mb: 3, '& .MuiInputBase-root': { borderRadius: 3 } }}
      />

      {loading ? (
        <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
      ) : activeTab === 0 ? (
        filteredCreds.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>{credSearch ? "No credentials match your search." : "No credentials found. Add one to get started."}</Alert>
        ) : (
          <>
            <Stack spacing={2}>
              {paginatedCreds.map((cred) => (
                <Paper key={cred.id} onClick={() => openManageCred(cred.id)} sx={{ p: 3, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}><AppWindow size={16} /> {cred.appName}</Typography>
                    {cred.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{cred.description}</Typography>}
                    {cred.loginUrl && <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', display: 'block', mt: 0.5 }}>{cred.loginUrl}</Typography>}
                  </Box>
                  <Chip icon={<Lock size={14} />} label="Encrypted" size="small" color="success" variant="outlined" />
                </Paper>
              ))}
            </Stack>
            <TablePagination component="div" count={filteredCreds.length} page={credPage} onPageChange={(_, p) => setCredPage(p)} rowsPerPage={credRowsPerPage} onRowsPerPageChange={(e) => { setCredRowsPerPage(parseInt(e.target.value, 10)); setCredPage(0); }} rowsPerPageOptions={PAGE_OPTIONS} sx={{ mt: 1, '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: '0.75rem', fontWeight: 600 } }} />
          </>
        )
      ) : (
        filteredGroups.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>{groupSearch ? "No groups match your search." : "No credential groups found. Create one to organize."}</Alert>
        ) : (
          <>
            <Stack spacing={2}>
              {paginatedGroups.map((group) => (
                <Paper key={group.id} onClick={() => openManageGroup(group)} sx={{ p: 3, borderRadius: 4, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}><Users size={16} /> {group.name}</Typography>
                    {group.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{group.description}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={1}><Chip label={`${group.members.length} Members`} size="small" /><Chip label={`${group.credentials.length} Credentials`} size="small" /></Stack>
                </Paper>
              ))}
            </Stack>
            <TablePagination component="div" count={filteredGroups.length} page={groupPage} onPageChange={(_, p) => setGroupPage(p)} rowsPerPage={groupRowsPerPage} onRowsPerPageChange={(e) => { setGroupRowsPerPage(parseInt(e.target.value, 10)); setGroupPage(0); }} rowsPerPageOptions={PAGE_OPTIONS} sx={{ mt: 1, '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: '0.75rem', fontWeight: 600 } }} />
          </>
        )
      )}

      {/* Add Credential Dialog */}
      <Dialog open={openAddCred} onClose={() => setOpenAddCred(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add New Credential</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>Credentials are encrypted via AES-256-GCM.</Alert>
            <TextField fullWidth label="App Name" required value={credForm.appName} onChange={(e) => setCredForm(p => ({ ...p, appName: e.target.value }))} />
            <TextField fullWidth label="Login URL" placeholder="https://..." value={credForm.loginUrl} onChange={(e) => setCredForm(p => ({ ...p, loginUrl: e.target.value }))} />
            <TextField fullWidth label="Username / Identifier" required value={credForm.username} onChange={(e) => setCredForm(p => ({ ...p, username: e.target.value }))} />
            <TextField fullWidth label="Password / Secret" type="password" required value={credForm.password} onChange={(e) => setCredForm(p => ({ ...p, password: e.target.value }))} />
            <TextField fullWidth label="Description (Optional)" multiline rows={2} value={credForm.description} onChange={(e) => setCredForm(p => ({ ...p, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}><Button onClick={() => setOpenAddCred(false)}>Cancel</Button><Button onClick={handleCreateCredential} variant="contained" disabled={savingCred}>Save</Button></DialogActions>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={openAddGroup} onClose={() => setOpenAddGroup(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Create Credential Group</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} mt={1}>
            <TextField fullWidth label="Group Name" required value={groupForm.name} onChange={(e) => setGroupForm(p => ({ ...p, name: e.target.value }))} />
            <TextField fullWidth label="Description (Optional)" multiline rows={2} value={groupForm.description} onChange={(e) => setGroupForm(p => ({ ...p, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}><Button onClick={() => setOpenAddGroup(false)}>Cancel</Button><Button onClick={handleCreateGroup} variant="contained" disabled={savingGroup}>Create</Button></DialogActions>
      </Dialog>

      {/* Manage Credential Dialog */}
      <Dialog open={!!manageCred} onClose={() => setManageCred(null)} maxWidth="md" fullWidth>
        {manageCredLoading ? (<Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>) : manageCred ? (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>Manage Credential: {manageCred.appName}</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary' }}>DECRYPTED PAYLOAD</Typography>
                  <Paper sx={{ p: 3, borderRadius: 3, bgcolor: 'background.default' }}>
                    <Stack spacing={2}>
                      <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>USERNAME</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{manageCred.username}</Typography></Box>
                      <Box><Typography variant="caption" sx={{ fontWeight: 700 }}>PASSWORD</Typography><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{manageCred.password}</Typography></Box>
                    </Stack>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary' }}>DIRECT USER SHARES</Typography>
                  <Stack direction="row" spacing={1} mb={2}>
                    <Autocomplete size="small" fullWidth options={availableShareMembers}
                      getOptionLabel={(o) => `${o.user.name} (${o.user.email})`}
                      filterOptions={(options, { inputValue }) => { const q = inputValue.toLowerCase(); return options.filter(o => o.user.name?.toLowerCase().includes(q) || o.user.email?.toLowerCase().includes(q)); }}
                      value={shareUser} onChange={(_, v) => setShareUser(v)}
                      renderInput={(params) => <TextField {...params} placeholder="Search user by name or email..." />} />
                    <Button variant="contained" onClick={handleAddShare} disabled={!shareUser}>Add</Button>
                  </Stack>
                  <List dense>
                    {manageCred.shares?.length === 0 && <Typography variant="caption" color="text.secondary">Not shared with any users directly.</Typography>}
                    {manageCred.shares?.map((share: any) => (
                      <ListItem key={share.userId} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mb: 1 }}>
                        <ListItemText primary={share.user.name} secondary={share.user.email} />
                        <ListItemSecondaryAction><IconButton size="small" color="error" onClick={() => handleRemoveShare(share.userId)}><X size={16} /></IconButton></ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleDeleteCredential} color="error" variant="text" sx={{ fontWeight: 700 }}>Delete Credential</Button>
              <Button onClick={() => setManageCred(null)} variant="outlined">Close</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      {/* Manage Group Dialog */}
      <Dialog open={!!manageGroup} onClose={() => setManageGroup(null)} maxWidth="md" fullWidth>
        {manageGroup ? (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>Manage Group: {manageGroup.name}</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary' }}>GROUP MEMBERS</Typography>
                  <Stack direction="row" spacing={1} mb={2}>
                    <Autocomplete size="small" fullWidth options={availableGroupMembers}
                      getOptionLabel={(o) => `${o.user.name} (${o.user.email})`}
                      filterOptions={(options, { inputValue }) => { const q = inputValue.toLowerCase(); return options.filter(o => o.user.name?.toLowerCase().includes(q) || o.user.email?.toLowerCase().includes(q)); }}
                      value={groupMemberUser} onChange={(_, v) => setGroupMemberUser(v)}
                      renderInput={(params) => <TextField {...params} placeholder="Search user by name or email..." />} />
                    <Button variant="contained" onClick={handleAddGroupMember} disabled={!groupMemberUser}>Add</Button>
                  </Stack>
                  <List dense>
                    {manageGroup.members.length === 0 && <Typography variant="caption" color="text.secondary">No members in this group.</Typography>}
                    {manageGroup.members.map((gm: any) => (
                      <ListItem key={gm.userId} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mb: 1 }}>
                        <ListItemText primary={gm.user.name} secondary={gm.user.email} />
                        <ListItemSecondaryAction><IconButton size="small" color="error" onClick={() => handleRemoveGroupMember(gm.userId)}><X size={16} /></IconButton></ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary' }}>GROUP CREDENTIALS</Typography>
                  <Stack direction="row" spacing={1} mb={2}>
                    <Autocomplete size="small" fullWidth options={availableGroupCreds}
                      getOptionLabel={(o) => `${o.appName}${o.loginUrl ? ` — ${o.loginUrl}` : ''}`}
                      filterOptions={(options, { inputValue }) => { const q = inputValue.toLowerCase(); return options.filter(o => o.appName?.toLowerCase().includes(q) || o.loginUrl?.toLowerCase().includes(q)); }}
                      value={groupCredOption} onChange={(_, v) => setGroupCredOption(v)}
                      renderInput={(params) => <TextField {...params} placeholder="Search credential by app name or URL..." />} />
                    <Button variant="contained" onClick={handleAddGroupCred} disabled={!groupCredOption}>Add</Button>
                  </Stack>
                  <List dense>
                    {manageGroup.credentials.length === 0 && <Typography variant="caption" color="text.secondary">No credentials in this group.</Typography>}
                    {manageGroup.credentials.map((gc: any) => (
                      <ListItem key={gc.credentialId} sx={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2, mb: 1 }}>
                        <ListItemText primary={gc.credential.appName} secondary={gc.credential.loginUrl || "No URL"} />
                        <ListItemSecondaryAction><IconButton size="small" color="error" onClick={() => handleRemoveGroupCred(gc.credentialId)}><X size={16} /></IconButton></ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 3, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleDeleteGroup} color="error" variant="text" sx={{ fontWeight: 700 }}>Delete Group</Button>
              <Button onClick={() => setManageGroup(null)} variant="outlined">Close</Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>

      {openImportModal && (
        <ExcelImportModal
          open={openImportModal}
          onClose={() => setOpenImportModal(false)}
          organizationId={selectedOrgId}
          onSuccess={(msg) => { setOpenImportModal(false); onSuccess(msg); fetchData(selectedOrgId); }}
          onError={onError}
        />
      )}
    </Box>
  );
}
