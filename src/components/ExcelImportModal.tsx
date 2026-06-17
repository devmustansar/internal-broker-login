"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Stack,
} from "@mui/material";
import { Upload, X, Check, AlertCircle, Pencil, Save } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const FIELDS = [
  { key: "appName", label: "App Name", required: true },
  { key: "username", label: "Username", required: true },
  { key: "password", label: "Password", required: true },
  { key: "loginUrl", label: "Login URL", required: false },
  { key: "description", label: "Description", required: false },
];

type RowData = { appName: string; username: string; password: string; loginUrl: string; description: string };

function validateRow(row: RowData): string[] {
  const errs: string[] = [];
  if (!row.appName?.trim()) errs.push("App Name required");
  if (!row.username?.trim()) errs.push("Username required");
  if (!row.password?.trim()) errs.push("Password required");
  return errs;
}

export default function ExcelImportModal({
  open,
  onClose,
  organizationId,
  onSuccess,
  onError,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [editableRows, setEditableRows] = useState<RowData[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<RowData>({ appName: "", username: "", password: "", loginUrl: "", description: "" });
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recompute editable rows whenever mapping or raw rows change
  useEffect(() => {
    if (rawRows.length === 0) return;
    setEditableRows(
      rawRows.map(row => ({
        appName: (mapping.appName ? row[mapping.appName] : "") ?? "",
        username: (mapping.username ? row[mapping.username] : "") ?? "",
        password: (mapping.password ? row[mapping.password] : "") ?? "",
        loginUrl: (mapping.loginUrl ? row[mapping.loginUrl] : "") ?? "",
        description: (mapping.description ? row[mapping.description] : "") ?? "",
      }))
    );
    setEditingIdx(null);
  }, [mapping, rawRows]);

  const rowErrors = useMemo(() => editableRows.map(validateRow), [editableRows]);
  const validCount = rowErrors.filter(e => e.length === 0).length;
  const invalidCount = rowErrors.filter(e => e.length > 0).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
          const strHeaders = (data[0] as any[]).map((h, i) => h?.toString().trim() || `Column ${i + 1}`);
          setHeaders(strHeaders);
          const initialMapping: Record<string, string> = {};
          FIELDS.forEach(f => {
            const match = strHeaders.find(h =>
              h.toLowerCase().replace(/\s/g, "") === f.key.toLowerCase() ||
              h.toLowerCase() === f.label.toLowerCase()
            );
            if (match) initialMapping[f.key] = match;
          });
          setMapping(initialMapping);
          const dataRows = data.slice(1).map(row => {
            const obj: any = {};
            strHeaders.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
          }).filter(row => Object.values(row).some(v => v !== undefined && v !== ""));
          setRawRows(dataRows);
        }
      } catch {
        onError("Failed to parse file.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleReset = () => {
    setFile(null); setHeaders([]); setRawRows([]); setMapping({});
    setEditableRows([]); setEditingIdx(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (idx: number) => {
    setEditDraft({ ...editableRows[idx] });
    setEditingIdx(idx);
  };

  const commitEdit = (idx: number) => {
    setEditableRows(prev => prev.map((r, i) => i === idx ? { ...editDraft } : r));
    setEditingIdx(null);
  };

  const handleImport = async (validOnly: boolean) => {
    const missing = FIELDS.filter(f => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      onError(`Map required fields: ${missing.map(m => m.label).join(", ")}`);
      return;
    }
    const toImport = validOnly
      ? editableRows.filter((_, i) => rowErrors[i].length === 0)
      : editableRows;

    if (toImport.length === 0) { onError("No valid rows to import."); return; }

    setLoading(true);
    try {
      const payload = toImport.map(row => ({ ...row, organizationId }));
      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      onSuccess(`Imported ${created.length} credential${created.length !== 1 ? "s" : ""}${validOnly && invalidCount > 0 ? ` (${invalidCount} invalid row${invalidCount !== 1 ? "s" : ""} skipped)` : ""}.`);
      handleReset();
      onClose();
    } catch (err: any) {
      onError(err.message || "Import failed.");
    } finally {
      setLoading(false);
    }
  };

  const mappingComplete = FIELDS.filter(f => f.required).every(f => mapping[f.key]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Import Credentials</Typography>
        <IconButton onClick={onClose} size="small"><X size={20} /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!file ? (
          <Box sx={{ textAlign: "center", p: 6, border: "2px dashed", borderColor: "divider", borderRadius: 4 }}>
            <Upload size={48} color="gray" style={{ marginBottom: 16 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Upload Excel File</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>Supports .xlsx, .xls, .csv</Typography>
            <Button variant="contained" component="label">
              Select File
              <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFileChange} ref={fileInputRef} />
            </Button>
          </Box>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Found <strong>{rawRows.length}</strong> data rows in "{file.name}". Map columns below, then review and fix any invalid rows before importing.
            </Alert>

            {/* Column mapping */}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 2, mb: 3 }}>
              {FIELDS.map(f => (
                <FormControl key={f.key} fullWidth size="small">
                  <InputLabel>{f.label}{f.required ? " *" : ""}</InputLabel>
                  <Select
                    label={`${f.label}${f.required ? " *" : ""}`}
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping(prev => ({ ...prev, [f.key]: e.target.value }))}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {headers.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                  </Select>
                </FormControl>
              ))}
            </Box>

            {/* Validation summary */}
            {editableRows.length > 0 && mappingComplete && (
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <Chip icon={<Check size={14} />} label={`${validCount} valid`} color="success" size="small" />
                {invalidCount > 0 && (
                  <Chip icon={<AlertCircle size={14} />} label={`${invalidCount} need editing`} color="error" size="small" />
                )}
                <Typography variant="caption" color="text.secondary">
                  Click <Pencil size={12} style={{ display: "inline", verticalAlign: "middle" }} /> to fix invalid rows inline.
                </Typography>
              </Stack>
            )}

            {/* Data table */}
            {editableRows.length > 0 && (
              <Paper variant="outlined" sx={{ overflow: "auto", maxHeight: 380 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, width: 40 }}>#</TableCell>
                      {FIELDS.map(f => (
                        <TableCell key={f.key} sx={{ fontWeight: 800 }}>
                          {f.label}{f.required ? " *" : ""}
                        </TableCell>
                      ))}
                      <TableCell sx={{ fontWeight: 800, width: 80 }}>Status</TableCell>
                      <TableCell sx={{ width: 48 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editableRows.map((row, idx) => {
                      const errs = rowErrors[idx];
                      const isEditing = editingIdx === idx;
                      const isInvalid = errs.length > 0;
                      return (
                        <TableRow
                          key={idx}
                          sx={{ bgcolor: isInvalid ? "rgba(239,68,68,0.05)" : "transparent" }}
                        >
                          <TableCell sx={{ color: "text.secondary", fontSize: "0.7rem" }}>{idx + 1}</TableCell>
                          {FIELDS.map(f => (
                            <TableCell key={f.key} sx={{ py: 0.5, maxWidth: 160 }}>
                              {isEditing ? (
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={(editDraft as any)[f.key] ?? ""}
                                  onChange={(e) => setEditDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                                  type={f.key === "password" ? "text" : "text"}
                                  inputProps={{ style: { fontSize: "0.78rem", padding: "4px 6px" } }}
                                  error={f.required && !(editDraft as any)[f.key]?.trim()}
                                />
                              ) : (
                                <Typography variant="caption" sx={{
                                  display: "block",
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  color: (f.required && !row[f.key as keyof RowData]?.trim()) ? "error.main" : "text.primary",
                                  maxWidth: 140,
                                }}>
                                  {row[f.key as keyof RowData] || <em style={{ opacity: 0.4 }}>—</em>}
                                </Typography>
                              )}
                            </TableCell>
                          ))}
                          <TableCell>
                            {isInvalid ? (
                              <Tooltip title={errs.join("; ")}>
                                <Chip
                                  icon={<AlertCircle size={12} />}
                                  label="Invalid"
                                  color="error"
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: "0.65rem", height: 20 }}
                                />
                              </Tooltip>
                            ) : (
                              <Chip
                                icon={<Check size={12} />}
                                label="Valid"
                                color="success"
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: "0.65rem", height: 20 }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 0.5 }}>
                            {isEditing ? (
                              <Tooltip title="Save changes">
                                <IconButton size="small" color="success" onClick={() => commitEdit(idx)}>
                                  <Save size={14} />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Edit row">
                                <IconButton size="small" onClick={() => startEdit(idx)}>
                                  <Pencil size={14} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 1 }}>
        {file && <Button onClick={handleReset} color="inherit" disabled={loading}>Reset</Button>}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} color="inherit" disabled={loading}>Cancel</Button>
        {invalidCount > 0 && validCount > 0 && (
          <Button
            variant="outlined"
            onClick={() => handleImport(true)}
            disabled={!file || loading || !mappingComplete}
          >
            {loading ? <CircularProgress size={20} /> : `Import ${validCount} Valid`}
          </Button>
        )}
        <Button
          variant="contained"
          onClick={() => handleImport(false)}
          disabled={!file || loading || !mappingComplete || validCount === 0}
          color={invalidCount > 0 ? "warning" : "primary"}
        >
          {loading ? <CircularProgress size={20} /> : invalidCount > 0 ? `Import All (${editableRows.length})` : `Import ${validCount}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
