"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/lib/app-context";
import { APP_NAME } from "@/lib/constants";
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
  Container,
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { LogOut, Bell } from "lucide-react";
import { motion } from "framer-motion";

function NotificationBell() {
  const theme = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setItems(data.items || []);
        setUnreadCount(data.unreadCount || 0);
      } catch { /* best-effort */ }
    };
    load();
    pollRef.current = setInterval(load, 60000);
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (unreadCount > 0) {
      fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) })
        .then(() => setUnreadCount(0))
        .catch(() => {});
    }
  };

  return (
    <>
      <IconButton onClick={handleOpen} sx={{ color: 'text.secondary' }}>
        <Badge badgeContent={unreadCount} color="error">
          <Bell size={20} />
        </Badge>
      </IconButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxHeight: 420, borderRadius: 3, mt: 1 } }}
      >
        {items.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">No notifications yet.</Typography>
          </Box>
        ) : (
          <List dense sx={{ py: 0 }}>
            {items.map((n) => (
              <ListItem key={n.id} sx={{ borderBottom: `1px solid ${theme.palette.divider}`, opacity: n.readAt ? 0.6 : 1 }}>
                <ListItemText
                  primary={<Typography variant="body2" sx={{ fontWeight: 700 }}>{n.title}</Typography>}
                  secondary={n.body || new Date(n.createdAt).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}

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
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <img src="/Logo-Emblam.png" alt={APP_NAME} style={{ width: 40, height: 40, objectFit: 'contain' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>{APP_NAME}</Typography>
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
              
              <NotificationBell />

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
