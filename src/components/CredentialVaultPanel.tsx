"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Button, TextField, Stack, Paper, Chip, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, CircularProgress, Alert,
  Tabs, Tab, List, ListItem, ListItemText, ListItemSecondaryAction, Grid,
  Autocomplete, TablePagination, InputAdornment, Checkbox, Tooltip
} from "@mui/material";
import { Plus, X, Lock, Users, AppWindow, Search, Upload, Trash2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import ExcelImportModal from "./ExcelImportModal";

const PAGE_OPTIONS = [5, 10, 25];

export default function CredentialVaultPanel({ onSuccess, onError }: { onSuccess: (msg: string) => void, onError: (msg: string) => void }) {
  const { user } = useApp();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  // Role-based delete permission: super_admin, global admin, or org admin/owner
  const canDelete = (
    user?.role === 'super_admin' ||
    user?.role === 'admin' ||
    !!(selectedOrgId && (
      user?.orgRoles?.[selectedOrgId] === 'admin' ||
      user?.orgRoles?.[selectedOrgId] === 'owner'
    ))
  );
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

  // Bulk selection & delete
  const [selectedCredIds, setSelectedCredIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Manage states
  const [manageCred, setManageCred] = useState<any>(null);
  const [manageCredLoading, setManageCredLoading] = useState(false);
  const [shareUsers, setShareUsers] = useState<any[]>([]);
  const [addingShares, setAddingShares] = useState(false);

  const [manageGroup, setManageGroup] = useState<any>(null);
  const [groupMemberUsers, setGroupMemberUsers] = useState<any[]>([]);
  const [groupCredOptions, setGroupCredOptions] = useState<any[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [addingGroupCreds, setAddingGroupCreds] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);

  useEffect(() => {
    if (selectedOrgId) { fetchData(selectedOrgId); fetchOrgMembers(selectedOrgId); }
    else if (organizations.length > 0) setSelectedOrgId(organizations[0].id);
  }, [selectedOrgId, organizations, activeTab]);

  useEffect(() => { setCredPage(0); }, [credSearch]);
  useEffect(() => { setGroupPage(0); }, [groupSearch]);
  useEffect(() => { setSelectedCredIds(new Set()); setSelectedGroupIds(new Set()); }, [selectedOrgId]);
  useEffect(() => { setSelectedCredIds(new Set()); setSelectedGroupIds(new Set()); }, [activeTab]);

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

  // Individual delete from list (without opening manage dialog)
  const handleDeleteSingleCred = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this credential? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/credentials/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete credential");
      onSuccess("Credential deleted.");
      fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); }
  };

  const handleDeleteSingleGroup = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this group? All member and credential associations will be removed.")) return;
    try {
      const res = await fetch(`/api/admin/credential-groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete group");
      onSuccess("Group deleted.");
      fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); }
  };

  // Bulk delete
  const handleBulkDeleteCreds = async () => {
    if (!confirm(`Permanently delete ${selectedCredIds.size} credential(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedCredIds) {
        const res = await fetch(`/api/admin/credentials/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete credential ${id}`);
      }
      onSuccess(`${selectedCredIds.size} credential(s) deleted.`);
      setSelectedCredIds(new Set());
      fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); }
    finally { setBulkDeleting(false); }
  };

  const handleBulkDeleteGroups = async () => {
    if (!confirm(`Permanently delete ${selectedGroupIds.size} group(s)? All member and credential associations will be removed.`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedGroupIds) {
        const res = await fetch(`/api/admin/credential-groups/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Failed to delete group ${id}`);
      }
      onSuccess(`${selectedGroupIds.size} group(s) deleted.`);
      setSelectedGroupIds(new Set());
      fetchData(selectedOrgId);
    } catch (err: any) { onError(err.message); }
    finally { setBulkDeleting(false); }
  };

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
      setManageCred(await res.json()); setShareUsers([]);
    } catch (err: any) { onError(err.message); } finally { setManageCredLoading(false); }
  };

  const handleAddShare = async () => {
    if (shareUsers.length === 0) return;
    setAddingShares(true);
    try {
      for (const member of shareUsers) {
        const res = await fetch(`/api/admin/credentials/${manageCred.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.user.id }) });
        if (!res.ok) throw new Error(`Failed to share with ${member.user.name}`);
      }
      onSuccess(`Credential shared with ${shareUsers.length} user${shareUsers.length !== 1 ? "s" : ""}.`);
      setShareUsers([]); openManageCred(manageCred.id);
    } catch (err: any) { onError(err.message); } finally { setAddingShares(false); }
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

  const openManageGroup = (group: any) => { setManageGroup(group); setGroupMemberUsers([]); setGroupCredOptions([]); };

  const reloadGroup = async () => {
    const res = await fetch(`/api/admin/credential-groups?organizationId=${selectedOrgId}`);
    if (res.ok) { const gs = await res.json(); setGroups(gs); setManageGroup(gs.find((g: any) => g.id === manageGroup.id) || null); }
  };

  const handleAddGroupMember = async () => {
    if (groupMemberUsers.length === 0) return;
    setAddingMembers(true);
    try {
      for (const member of groupMemberUsers) {
        const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: member.user.id }) });
        if (!res.ok) throw new Error(`Failed to add ${member.user.name}`);
      }
      onSuccess(`${groupMemberUsers.length} member${groupMemberUsers.length !== 1 ? "s" : ""} added to group.`);
      setGroupMemberUsers([]); reloadGroup();
    } catch (err: any) { onError(err.message); } finally { setAddingMembers(false); }
  };

  const handleRemoveGroupMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/members`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error("Failed to remove member");
      onSuccess("Member removed."); reloadGroup();
    } catch (err: any) { onError(err.message); }
  };

  const handleAddGroupCred = async () => {
    if (groupCredOptions.length === 0) return;
    setAddingGroupCreds(true);
    try {
      for (const cred of groupCredOptions) {
        const res = await fetch(`/api/admin/credential-groups/${manageGroup.id}/credentials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentialId: cred.id }) });
        if (!res.ok) throw new Error(`Failed to add ${cred.appName}`);
      }
      onSuccess(`${groupCredOptions.length} credential${groupCredOptions.length !== 1 ? "s" : ""} added to group.`);
      setGroupCredOptions([]); reloadGroup();
    } catch (err: any) { onError(err.message); } finally { setAddingGroupCreds(false); }
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
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {canDelete && activeTab === 0 && selectedCredIds.size > 0 && (
            <Button variant="contained" color="error" startIcon={bulkDeleting ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
              onClick={handleBulkDeleteCreds} disabled={bulkDeleting} sx={{ borderRadius: 3, fontWeight: 700 }}>
              Delete Selected ({selectedCredIds.size})
            </Button>
          )}
          {canDelete && activeTab === 1 && selectedGroupIds.size > 0 && (
            <Button variant="contained" color="error" startIcon={bulkDeleting ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
              onClick={handleBulkDeleteGroups} disabled={bulkDeleting} sx={{ borderRadius: 3, fontWeight: 700 }}>
              Delete Selected ({selectedGroupIds.size})
            </Button>
          )}
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
            {canDelete && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pl: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={paginatedCreds.length > 0 && paginatedCreds.every(c => selectedCredIds.has(c.id))}
                  indeterminate={paginatedCreds.some(c => selectedCredIds.has(c.id)) && !paginatedCreds.every(c => selectedCredIds.has(c.id))}
                  onChange={(e) => {
                    setSelectedCredIds(prev => {
                      const next = new Set(prev);
                      paginatedCreds.forEach(c => e.target.checked ? next.add(c.id) : next.delete(c.id));
                      return next;
                    });
                  }}
                  sx={{ flexShrink: 0 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {paginatedCreds.every(c => selectedCredIds.has(c.id)) && paginatedCreds.length > 0 ? 'Deselect page' : 'Select page'}
                </Typography>
                {selectedCredIds.size > 0 && (
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, ml: 1 }}>
                    ({selectedCredIds.size} selected)
                  </Typography>
                )}
              </Box>
            )}
            <Stack spacing={2}>
              {paginatedCreds.map((cred) => (
                <Paper key={cred.id} sx={{ p: 3, borderRadius: 4, display: "flex", alignItems: "center", gap: 1, transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                  {canDelete && (
                    <Checkbox
                      size="small"
                      checked={selectedCredIds.has(cred.id)}
                      onChange={(e) => {
                        setSelectedCredIds(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(cred.id) : next.delete(cred.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ flexShrink: 0 }}
                    />
                  )}
                  <Box flex={1} sx={{ cursor: 'pointer', minWidth: 0 }} onClick={() => openManageCred(cred.id)}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}><AppWindow size={16} /> {cred.appName}</Typography>
                    {cred.username && <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', display: 'block', mt: 0.25 }}>{cred.username}</Typography>}
                    {cred.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{cred.description}</Typography>}
                    {cred.loginUrl && <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', display: 'block', mt: 0.5 }}>{cred.loginUrl}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Chip icon={<Lock size={14} />} label="Encrypted" size="small" color="success" variant="outlined" />
                    {canDelete && (
                      <Tooltip title="Delete credential">
                        <IconButton size="small" color="error" onClick={(e) => handleDeleteSingleCred(cred.id, e)}
                          sx={{ bgcolor: 'rgba(239,68,68,0.08)', '&:hover': { bgcolor: 'rgba(239,68,68,0.18)' } }}>
                          <Trash2 size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
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
            {canDelete && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pl: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={paginatedGroups.length > 0 && paginatedGroups.every(g => selectedGroupIds.has(g.id))}
                  indeterminate={paginatedGroups.some(g => selectedGroupIds.has(g.id)) && !paginatedGroups.every(g => selectedGroupIds.has(g.id))}
                  onChange={(e) => {
                    setSelectedGroupIds(prev => {
                      const next = new Set(prev);
                      paginatedGroups.forEach(g => e.target.checked ? next.add(g.id) : next.delete(g.id));
                      return next;
                    });
                  }}
                  sx={{ flexShrink: 0 }}
                />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {paginatedGroups.every(g => selectedGroupIds.has(g.id)) && paginatedGroups.length > 0 ? 'Deselect page' : 'Select page'}
                </Typography>
                {selectedGroupIds.size > 0 && (
                  <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 700, ml: 1 }}>
                    ({selectedGroupIds.size} selected)
                  </Typography>
                )}
              </Box>
            )}
            <Stack spacing={2}>
              {paginatedGroups.map((group) => (
                <Paper key={group.id} sx={{ p: 3, borderRadius: 4, display: "flex", alignItems: "center", gap: 1, transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
                  {canDelete && (
                    <Checkbox
                      size="small"
                      checked={selectedGroupIds.has(group.id)}
                      onChange={(e) => {
                        setSelectedGroupIds(prev => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(group.id) : next.delete(group.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ flexShrink: 0 }}
                    />
                  )}
                  <Box flex={1} sx={{ cursor: 'pointer', minWidth: 0 }} onClick={() => openManageGroup(group)}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}><Users size={16} /> {group.name}</Typography>
                    {group.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{group.description}</Typography>}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                    <Chip label={`${group.members.length} Members`} size="small" />
                    <Chip label={`${group.credentials.length} Credentials`} size="small" />
                    {canDelete && (
                      <Tooltip title="Delete group">
                        <IconButton size="small" color="error" onClick={(e) => handleDeleteSingleGroup(group.id, e)}
                          sx={{ bgcolor: 'rgba(239,68,68,0.08)', '&:hover': { bgcolor: 'rgba(239,68,68,0.18)' } }}>
                          <Trash2 size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
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
            <TextField fullWidth label="Login URL (optional)" placeholder="https://..." value={credForm.loginUrl} onChange={(e) => setCredForm(p => ({ ...p, loginUrl: e.target.value }))} />
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
                  <Stack spacing={1} mb={2}>
                    <Autocomplete multiple disableCloseOnSelect size="small" fullWidth options={availableShareMembers}
                      getOptionLabel={(o) => `${o.user.name} (${o.user.email})`}
                      filterOptions={(options, { inputValue }) => { const q = inputValue.toLowerCase(); return options.filter(o => o.user.name?.toLowerCase().includes(q) || o.user.email?.toLowerCase().includes(q)); }}
                      value={shareUsers} onChange={(_, v) => setShareUsers(v)}
                      renderInput={(params) => <TextField {...params} placeholder={shareUsers.length === 0 ? "Search users by name or email…" : ""} />}
                      limitTags={3} />
                    <Button variant="contained" onClick={handleAddShare} disabled={shareUsers.length === 0 || addingShares} fullWidth sx={{ borderRadius: 2, fontWeight: 700 }}>
                      {addingShares ? <CircularProgress size={18} color="inherit" /> : shareUsers.length > 1 ? `Share with ${shareUsers.length} Users` : "Share"}
                    </Button>
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
                  <Stack spacing={1} mb={2}>
                    <Autocomplete multiple disableCloseOnSelect size="small" fullWidth options={availableGroupMembers}
                      getOptionLabel={(o) => `${o.user.name} (${o.user.email})`}
                      filterOptions={(options, { inputValue }) => { const q = inputValue.toLowerCase(); return options.filter(o => o.user.name?.toLowerCase().includes(q) || o.user.email?.toLowerCase().includes(q)); }}
                      value={groupMemberUsers} onChange={(_, v) => setGroupMemberUsers(v)}
                      renderInput={(params) => <TextField {...params} placeholder={groupMemberUsers.length === 0 ? "Search users by name or email…" : ""} />}
                      limitTags={3} />
                    <Button variant="contained" onClick={handleAddGroupMember} disabled={groupMemberUsers.length === 0 || addingMembers} fullWidth sx={{ borderRadius: 2, fontWeight: 700 }}>
                      {addingMembers ? <CircularProgress size={18} color="inherit" /> : groupMemberUsers.length > 1 ? `Add ${groupMemberUsers.length} Members` : "Add Member"}
                    </Button>
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
                  <Stack spacing={1} mb={2}>
                    <Autocomplete multiple disableCloseOnSelect size="small" fullWidth options={availableGroupCreds}
                      getOptionLabel={(o) => `${o.appName}${o.username ? ` — ${o.username}` : ''}`}
                      filterOptions={(options, { inputValue }) => { const q = inputValue.toLowerCase(); return options.filter(o => o.appName?.toLowerCase().includes(q) || o.loginUrl?.toLowerCase().includes(q)); }}
                      value={groupCredOptions} onChange={(_, v) => setGroupCredOptions(v)}
                      renderInput={(params) => <TextField {...params} placeholder={groupCredOptions.length === 0 ? "Search credentials by app name or URL…" : ""} />}
                      limitTags={3} />
                    <Button variant="contained" onClick={handleAddGroupCred} disabled={groupCredOptions.length === 0 || addingGroupCreds} fullWidth sx={{ borderRadius: 2, fontWeight: 700 }}>
                      {addingGroupCreds ? <CircularProgress size={18} color="inherit" /> : groupCredOptions.length > 1 ? `Add ${groupCredOptions.length} Credentials` : "Add Credential"}
                    </Button>
                  </Stack>
                  <List dense>
                    {manageGroup.credentials.length === 0 && <Typography variant="caption" color="text.secondary">No credentials in this group.</Typography>}
                    {manageGroup.credentials.map((gc: any) => (
                      <Paper key={gc.credentialId} sx={{ p: 3, borderRadius: 4, transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' }, mb: 1 }}>
                        {/* Top row: appName + username full width */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, width: '100%' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <AppWindow size={16} style={{ flexShrink: 0 }} /> {gc.credential.appName}
                          </Typography>
                          {gc.credential.username && <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>{gc.credential.username}</Typography>}
                        </Box>
                        {/* Bottom row: description/url + delete button */}
                        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 0.5 }}>
                          <Box sx={{ minWidth: 0 }}>
                            {gc.credential.description && <Typography variant="body2" color="text.secondary">{gc.credential.description}</Typography>}
                            {gc.credential.loginUrl && <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.main', display: 'block' }}>{gc.credential.loginUrl}</Typography>}
                          </Box>
                          <IconButton size="small" color="error" onClick={() => handleRemoveGroupCred(gc.credentialId)} sx={{ flexShrink: 0, ml: 1 }}><X size={16} /></IconButton>
                        </Box>
                      </Paper>
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
