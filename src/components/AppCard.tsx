"use client";

import { useState } from "react";
import type { Resource, OpenAppResponse } from "@/types";
import { useApp } from "@/lib/app-context";
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CardActions, 
  Avatar, 
  Chip, 
  Button, 
  Stack, 
  IconButton, 
  Tooltip,
  alpha,
  useTheme,
  Alert,
  Fade
} from "@mui/material";
import { Server, ExternalLink, ShieldAlert, Globe, Activity } from "lucide-react";
import {
  STR_APP_FAIL_LAUNCH,
  STR_APP_PROVISIONING,
  STR_APP_LAUNCH
} from "@/lib/constants";

interface AppCardProps {
  resource: Resource;
  onOpen: (result: OpenAppResponse) => void;
}

const ENV_COLORS: Record<string, "success" | "info" | "warning"> = {
  production: "success",
  staging: "info",
  development: "warning",
};

const ADAPTER_LABELS: Record<string, string> = {
  form_login_basic: "Form Login",
  form_login_csrf: "Form + CSRF",
  json_login: "JSON API",
};

export default function AppCard({ resource, onOpen }: AppCardProps) {
  const { openApp } = useApp();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await openApp(resource.resourceKey);
      if (result.redirectUrl) {
        window.open(result.redirectUrl, "_blank");
      }
      onOpen(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : STR_APP_FAIL_LAUNCH);
    } finally {
      setIsLoading(false);
    }
  };

  const initials = resource.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const colorPalettes = [
    theme.palette.primary.main,
    theme.palette.info.main,
    theme.palette.secondary.main,
    theme.palette.warning.main,
  ];
  const colorIdx = resource.id.charCodeAt(resource.id.length - 1) % colorPalettes.length;
  const cardColor = colorPalettes[colorIdx];

  return (
    <Card 
      elevation={1}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        borderRadius: 5,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: alpha(theme.palette.background.paper, 0.4),
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: alpha(cardColor, 0.4),
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(cardColor, 0.1)}`,
          '& .chevron': { transform: 'translateX(4px)' }
        }
      }}
    >
      <Box sx={{ 
        position: 'absolute', 
        top: -40, 
        right: -40, 
        width: 120, 
        height: 120, 
        background: `radial-gradient(circle, ${alpha(cardColor, 0.1)} 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      <CardContent sx={{ p: 4, flexGrow: 1 }}>
        <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 4 }}>
          <Avatar 
            sx={{ 
              width: 52, 
              height: 52, 
              borderRadius: 3.5,
              fontWeight: 800,
              fontSize: '1.2rem',
              bgcolor: alpha(cardColor, 0.1),
              color: cardColor,
              border: `1px solid ${alpha(cardColor, 0.2)}`,
              boxShadow: `0 8px 16px ${alpha(cardColor, 0.15)}`
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="h3" sx={{ fontSize: '1.1rem', fontWeight: 800, color: 'text.primary', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {resource.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip 
                label={resource.environment.toUpperCase()} 
                size="small" 
                color={ENV_COLORS[resource.environment] || "info"} 
                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 900, borderRadius: 1.5 }} 
              />
              {resource.description && (
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  • {resource.description}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>

        <Stack spacing={2} sx={{ mt: 1 }}>
          <MetaDataRow label="Gateway" value={resource.appHost} icon={<Globe size={14} />} mono />
          <MetaDataRow label="Auth Engine" value={ADAPTER_LABELS[resource.loginAdapter]} icon={<ShieldAlert size={14} />} />
        </Stack>

        {error && (
          <Fade in={true}>
            <Alert severity="error" variant="outlined" sx={{ mt: 3, borderRadius: 2, fontSize: '0.75rem', py: 0 }}>
              {error}
            </Alert>
          </Fade>
        )}
      </CardContent>

      <CardActions sx={{ p: 4, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          color="inherit"
          disabled={isLoading}
          onClick={handleOpen}
          sx={{ 
            borderRadius: 3,
            py: 1.5,
            fontWeight: 800,
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            color: 'text.primary',
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              bgcolor: alpha(cardColor, 0.1),
              color: cardColor,
              borderColor: alpha(cardColor, 0.3)
            }
          }}
          startIcon={<ExternalLink size={18} />}
        >
          {isLoading ? STR_APP_PROVISIONING : STR_APP_LAUNCH}
        </Button>
      </CardActions>
    </Card>
  );
}

function MetaDataRow({ label, value, icon, mono }: { label: string, value: string, icon?: React.ReactNode, mono?: boolean }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 90, flexShrink: 0, color: 'text.secondary' }}>
        {icon}
        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem' }}>{label.toUpperCase()}</Typography>
      </Box>
      <Typography 
        variant="caption" 
        sx={{ 
          flexGrow: 1, 
          fontWeight: 600, 
          color: 'text.secondary', 
          bgcolor: alpha(theme.palette.background.paper, 0.5),
          px: 1,
          py: 0.3,
          borderRadius: 1.5,
          fontFamily: mono ? 'monospace' : 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          border: `1px solid ${theme.palette.divider}`
        }}
        title={value}
      >
        {value}
      </Typography>
    </Box>
  );
}
