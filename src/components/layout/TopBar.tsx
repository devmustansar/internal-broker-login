"use client";

import { useApp } from "@/lib/app-context";
import { 
  AppBar, 
  Toolbar, 
  Box, 
  Typography, 
  Button, 
  Avatar, 
  Chip, 
  Divider, 
  Stack, 
  alpha, 
  useTheme,
  Container
} from "@mui/material";
import { Shield, Sparkles, LogOut } from "lucide-react";
import { motion } from "framer-motion";

export default function TopBar() {
  const { user, logout } = useApp();
  const theme = useTheme();

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        bgcolor: alpha(theme.palette.background.default, 0.6), 
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        zIndex: theme.zIndex.appBar
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ height: 72, justifyContent: 'space-between' }}>
          {/* Logo Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ 
              position: 'relative', 
              width: 44, 
              height: 44, 
              borderRadius: 3, 
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.1)}`
            }}>
              <Shield size={22} color={theme.palette.primary.main} />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>CredBroker</Typography>
                <Chip 
                  label="PROMETHEUS" 
                  size="small" 
                  icon={<Sparkles size={12} />}
                  sx={{ 
                    height: 20, 
                    fontSize: '0.6rem', 
                    fontWeight: 900, 
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.light',
                    border: 'none',
                    '& .MuiChip-icon': { color: 'inherit', ml: 0.5 }
                  }} 
                />
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>Zero-Trust Access Gateway</Typography>
            </Box>
          </Box>

          {/* User Section */}
          {user && (
            <Stack direction="row" spacing={3} alignItems="center">
              <Stack direction="row" spacing={2} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <Chip 
                  label={user.role.toUpperCase()} 
                  size="small" 
                  variant="outlined" 
                  sx={{ borderRadius: 1.5, fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.05em' }} 
                />
                <Divider orientation="vertical" flexItem sx={{ height: 16, my: 'auto' }} />
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar 
                    sx={{ 
                      width: 32, 
                      height: 32, 
                      fontSize: '0.8rem', 
                      fontWeight: 800,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                      boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.2)}`
                    }}
                  >
                    {user.name.charAt(0)}
                  </Avatar>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{user.name}</Typography>
                </Stack>
              </Stack>
              
              <Divider orientation="vertical" flexItem sx={{ height: 16, my: 'auto', display: { xs: 'none', sm: 'block' } }} />
              
              <Button 
                variant="text" 
                size="small" 
                onClick={logout}
                sx={{ 
                  color: 'text.secondary', 
                  fontWeight: 700,
                  '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.05) }
                }}
                startIcon={<LogOut size={16} />}
              >
                Sign Out
              </Button>
            </Stack>
          )}
        </Toolbar>
      </Container>
      
      {/* Subtle indicator line */}
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, 0.2)}, transparent)` }} />
    </AppBar>
  );
}
