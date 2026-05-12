"use client";

import React, { useState, useRef } from "react";
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
} from "@mui/material";
import { Upload, X } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const REQUIRED_FIELDS = [
  { key: "appName", label: "App Name", required: true },
  { key: "username", label: "Username", required: true },
  { key: "password", label: "Password", required: true },
  { key: "loginUrl", label: "Login URL", required: false },
  { key: "description", label: "Description", required: false },
];

export default function ExcelImportModal({
  open,
  onClose,
  organizationId,
  onSuccess,
  onError,
}: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length > 0) {
          const rawHeaders = data[0] as string[];
          const strHeaders = rawHeaders.map((h, i) => h?.toString().trim() || `Column ${i + 1}`);
          setHeaders(strHeaders);
          
          // Auto-map if headers match loosely
          const initialMapping: Record<string, string> = {};
          REQUIRED_FIELDS.forEach(f => {
            const match = strHeaders.find(h => h.toLowerCase().replace(/\s/g, '') === f.key.toLowerCase() || h.toLowerCase() === f.label.toLowerCase());
            if (match) initialMapping[f.key] = match;
          });
          setMapping(initialMapping);
          
          // Rest of data
          const dataRows = data.slice(1).map(row => {
            const obj: any = {};
            strHeaders.forEach((h, i) => {
              obj[h] = (row as any)[i];
            });
            return obj;
          }).filter(row => Object.keys(row).length > 0);
          
          setRows(dataRows);
        }
      } catch (err) {
        onError("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleReset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    // Validate required fields
    const missing = REQUIRED_FIELDS.filter(f => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      onError(`Please map required fields: ${missing.map(m => m.label).join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      const payload = rows.map(row => {
        const cred: any = { organizationId };
        REQUIRED_FIELDS.forEach(f => {
          if (mapping[f.key]) {
            cred[f.key] = row[mapping[f.key]]?.toString() || "";
          }
        });
        return cred;
      });

      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
      }

      const created = await res.json();
      onSuccess(`Successfully imported ${created.length} credentials.`);
      handleReset();
      onClose();
    } catch (err: any) {
      onError(err.message || "Failed to import credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Import Credentials</Typography>
        <Button onClick={onClose} color="inherit" sx={{ minWidth: 'auto', p: 1 }}><X size={20} /></Button>
      </DialogTitle>
      <DialogContent dividers>
        {!file ? (
          <Box sx={{ textAlign: 'center', p: 6, border: '2px dashed', borderColor: 'divider', borderRadius: 4 }}>
            <Upload size={48} color="gray" style={{ marginBottom: 16 }} />
            <Typography variant="h6" sx={{ mb: 2 }}>Upload Excel File</Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>Supports .xlsx, .xls, .csv</Typography>
            <Button variant="contained" component="label">
              Select File
              <input type="file" hidden accept=".xlsx, .xls, .csv" onChange={handleFileChange} ref={fileInputRef} />
            </Button>
          </Box>
        ) : (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Found {rows.length} rows in "{file.name}". Map the columns from your file to the database fields.
            </Alert>
            
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
              {REQUIRED_FIELDS.map(f => (
                <FormControl key={f.key} fullWidth size="small">
                  <InputLabel>{f.label} {f.required ? "*" : ""}</InputLabel>
                  <Select
                    label={`${f.label} ${f.required ? "*" : ""}`}
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {headers.map(h => <MenuItem key={h} value={h}>{h}</MenuItem>)}
                  </Select>
                </FormControl>
              ))}
            </Box>

            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Data Preview (First 3 rows)</Typography>
            <Paper variant="outlined" sx={{ overflow: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {REQUIRED_FIELDS.map(f => (
                      <TableCell key={f.key} sx={{ fontWeight: 800 }}>{f.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 3).map((row, idx) => (
                    <TableRow key={idx}>
                      {REQUIRED_FIELDS.map(f => (
                        <TableCell key={f.key}>{mapping[f.key] ? row[mapping[f.key]] : "-"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        {file && <Button onClick={handleReset} color="inherit">Reset File</Button>}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} color="inherit" disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleImport} disabled={!file || loading}>
          {loading ? <CircularProgress size={24} /> : "Import Data"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
