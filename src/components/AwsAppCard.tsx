"use client";

import { useState } from "react";
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
  alpha, 
  useTheme,
  Alert,
  Fade,
  LinearProgress
} from "@mui/material";
import { Cloud, ExternalLink, ShieldCheck, Cpu, KeyRound } from "lucide-react";
import { 
  STR_AWS_FAIL_LAUNCH,
  STR_AWS_SUCCESS,
  STR_AWS_GENERATING,
  STR_AWS_LAUNCH
} from "@/lib/constants";

interface AwsCardProps {
  resource: {
    id: string;
    resourceKey: string;
    name: string;
    description?: string | null;
    awsAccountId: string;
    roleArn: string;
    region: string;
    destination: string;
    environment: string;
    stsStrategy: string;
  };
}

const ENV_COLORS: Record<string, "success" | "info" | "warning"> = {
  production: "success",
  staging: "info",
  development: "warning",
};

export default function AwsAppCard({ resource }: AwsCardProps) {
  const { launchAwsConsole } = useApp();
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  const handleLaunch = async () => {
    setIsLoading(true);
    setError(null);
    setLaunched(false);
    try {
      const result = await launchAwsConsole(resource.resourceKey);
      window.open(result.loginUrl, "_blank");
      setLaunched(true);
      setTimeout(() => setLaunched(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : STR_AWS_FAIL_LAUNCH);
    } finally {
      setIsLoading(false);
    }
  };

  const accountDisplay =
    resource.awsAccountId.length === 12
      ? `${resource.awsAccountId.slice(0, 4)}…${resource.awsAccountId.slice(-4)}`
      : resource.awsAccountId;

  const roleName = resource.roleArn.split("/").pop() ?? resource.roleArn;
  const awsColor = "#ff9900"; // AWS Orange

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
          borderColor: alpha(awsColor, 0.5),
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(awsColor, 0.15)}`,
        }
      }}
    >
      <Box sx={{ 
        position: 'absolute', 
        top: -40, 
        right: -40, 
        width: 120, 
        height: 120, 
        background: `radial-gradient(circle, ${alpha(awsColor, 0.15)} 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      <CardContent sx={{ p: 4, flexGrow: 1 }}>
        <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 4 }}>
          <Avatar 
            sx={{ 
              width: 52, 
              height: 52, 
              borderRadius: 3.5,
              bgcolor: alpha(awsColor, 0.1),
              color: awsColor,
              border: `1px solid ${alpha(awsColor, 0.3)}`,
              boxShadow: `0 8px 20px ${alpha(awsColor, 0.2)}`
            }}
          >
            <Cloud size={24} fill="currentColor" />
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
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                • AWS FEDERATION
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack spacing={2} sx={{ mt: 1 }}>
          <MetaDataRow label="Account" value={accountDisplay} icon={<KeyRound size={14} />} mono />
          <MetaDataRow label="IAM Role" value={roleName} icon={<ShieldCheck size={14} />} mono />
          <MetaDataRow label="Zone" value={resource.region} icon={<Cpu size={14} />} />
        </Stack>

        {error && (
          <Fade in={true}>
            <Alert severity="error" variant="outlined" sx={{ mt: 3, borderRadius: 2, fontSize: '0.75rem', py: 0 }}>
              {error}
            </Alert>
          </Fade>
        )}

        {launched && !error && (
          <Fade in={true}>
            <Alert severity="success" variant="outlined" icon={<ShieldCheck size={18} />} sx={{ mt: 3, borderRadius: 2, fontSize: '0.75rem', py: 0, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
              {STR_AWS_SUCCESS}
            </Alert>
          </Fade>
        )}
      </CardContent>

      <CardActions sx={{ p: 4, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          disabled={isLoading}
          onClick={handleLaunch}
          sx={{ 
            borderRadius: 3,
            py: 1.5,
            fontWeight: 800,
            bgcolor: alpha(awsColor, 0.9),
            color: 'black',
            '&:hover': {
              bgcolor: awsColor,
              boxShadow: `0 0 20px ${alpha(awsColor, 0.4)}`
            }
          }}
          startIcon={<ExternalLink size={18} />}
        >
          {isLoading ? STR_AWS_GENERATING : STR_AWS_LAUNCH}
        </Button>
      </CardActions>
      
      {isLoading && (
        <LinearProgress 
          sx={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            height: 4,
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': { bgcolor: awsColor }
          }} 
        />
      )}
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
