"use client";

import { useApp } from "@/lib/app-context";
import { FormControl, MenuItem, Select, alpha, useTheme } from "@mui/material";
import { Building2 } from "lucide-react";

/**
 * Organization selector shown in the top nav (like a Google Cloud project
 * picker). It scopes the Dashboard, Shared Credentials and Authenticator Codes. Renders nothing unless the user belongs to two or
 * more organizations, so single-org users see no change.
 */
export default function OrgFilter() {
  const { organizations, selectedOrgId, setSelectedOrgId } = useApp();
  const theme = useTheme();

  if (organizations.length < 2) return null;

  return (
    <FormControl size="small" sx={{ minWidth: { xs: 140, sm: 200 }, maxWidth: 260 }}>
      <Select
        value={selectedOrgId}
        displayEmpty
        onChange={(e) => setSelectedOrgId(e.target.value)}
        startAdornment={<Building2 size={15} color={theme.palette.text.secondary} style={{ marginRight: 8 }} />}
        renderValue={(v) => (v ? organizations.find((o) => o.id === v)?.name ?? "All organizations" : "All organizations")}
        inputProps={{ "aria-label": "Filter by organization" }}
        sx={{ borderRadius: 2, bgcolor: alpha(theme.palette.background.paper, 0.5), fontSize: "0.85rem", fontWeight: 600, "& .MuiSelect-select": { py: 0.75 } }}
      >
        <MenuItem value="">All organizations</MenuItem>
        {organizations.map((o) => (
          <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
