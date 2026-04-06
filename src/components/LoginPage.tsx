"use client";

import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  IconButton, 
  InputAdornment, 
  Alert,
  Fade,
  Stack,
  alpha,
  useTheme
} from "@mui/material";
import { Shield, Mail, Key, Sparkles, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { login, isLoading } = useApp();
  const theme = useTheme();
  const [email, setEmail] = useState("alice@company.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const DEMO_USERS = [
    { email: "alice@company.com", name: "Alice (Admin — all apps)" },
    { email: "bob@company.com", name: "Bob (User — staging + dashboard)" },
    { email: "carol@company.com", name: "Carol (Readonly)" },
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        backgroundColor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {/* Background Effects */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at top, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          },
        }}
      />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 4,
                  mx: 'auto',
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                  boxShadow: `0 0 40px ${alpha(theme.palette.primary.main, 0.4)}`,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Shield size={32} color="white" />
              </Box>
            </motion.div>
            
            <Typography variant="h1" sx={{ mb: 1 }}>
              CredBroker
            </Typography>
            <Typography 
              variant="subtitle1" 
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
            >
              Zero-Trust Access Gateway <Sparkles size={16} color={theme.palette.primary.main} />
            </Typography>
          </Box>

          {/* Login Card */}
          <Paper
            elevation={1}
            sx={{
              p: 4,
              mb: 4,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: alpha(theme.palette.background.paper, 0.4),
              backdropFilter: 'blur(20px)',
            }}
          >
            <form onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Identity
                  </Typography>
                  <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Mail size={18} color={theme.palette.text.secondary} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Passkey
                  </Typography>
                  <TextField
                    fullWidth
                    type="password"
                    variant="outlined"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Key size={18} color={theme.palette.text.secondary} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {error && (
                  <Fade in={!!error}>
                    <Alert severity="error" variant="outlined" sx={{ borderRadius: 2, backgroundColor: alpha(theme.palette.error.main, 0.05) }}>
                      {error}
                    </Alert>
                  </Fade>
                )}

                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  sx={{ py: 1.5, mt: 2 }}
                >
                  {isLoading ? 'Authenticating...' : 'Authenticate Securely'}
                </Button>
              </Stack>
            </form>

            {/* Quick Connect */}
            <Box sx={{ mt: 5, pt: 4, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption" sx={{ mb: 2, display: 'block', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Relayer Handshake
              </Typography>
              <Stack spacing={1.5}>
                {DEMO_USERS.map((user) => (
                  <Button
                    key={user.email}
                    variant="text"
                    onClick={() => {
                      setEmail(user.email);
                      setPassword("password");
                    }}
                    sx={{
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.5,
                      borderRadius: 3,
                      backgroundColor: alpha(theme.palette.background.paper, 0.3),
                      border: '1px solid transparent',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.background.paper, 0.6),
                        borderColor: alpha(theme.palette.primary.main, 0.2),
                        '& .chevron': { transform: 'translateX(4px)' }
                      },
                      color: 'text.primary',
                    }}
                    endIcon={<ChevronRight className="chevron" size={16} style={{ transition: 'transform 0.2s' }} />}
                  >
                    <Box sx={{ textAlign: 'left', flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.light', display: 'block' }}>
                        {user.email}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {user.name}
                      </Typography>
                    </Box>
                  </Button>
                ))}
              </Stack>
            </Box>
          </Paper>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: 'text.secondary',
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            Internal Network • Relayer v3.4
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
}
