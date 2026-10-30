"use client";

import { useApp } from "@/lib/app-context";
import { FormControl, MenuItem, Select, alpha, useTheme } from "@mui/material";
import { Building2 } from "lucide-react";

/**
 * Organization filter shared by the Dashboard, Shared Credentials and
 * Authenticator Codes tabs. Renders nothing unless the user belongs to two or
 * more organizations, so single-org users see no change.
 */
export default function OrgFilter() {
  const { organizations, selectedOrgId, setSelectedOrgId } = useApp();
  const theme = useTheme();

  if (organizations.length < 2) return null;

  return (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <Select
        value={selectedOrgId}
        displayEmpty
        onChange={(e) => setSelectedOrgId(e.target.value)}
        startAdornment={<Building2 size={15} color={theme.palette.text.secondary} style={{ marginRight: 8 }} />}
        renderValue={(v) => (v ? organizations.find((o) => o.id === v)?.name ?? "All organizations" : "All organizations")}
        inputProps={{ "aria-label": "Filter by organization" }}
        sx={{ borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.5), fontSize: "0.85rem", fontWeight: 600 }}
      >
        <MenuItem value="">All organizations</MenuItem>
        {organizations.map((o) => (
          <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
