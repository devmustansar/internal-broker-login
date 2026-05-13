"use client";

import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  alpha,
  useTheme
} from "@mui/material";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const theme = useTheme();

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
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
            >
              <Box sx={{ mx: 'auto', mb: 3, display: 'flex', justifyContent: 'center' }}>
                <img
                  src="/Logo-Inline-White.png"
                  alt="Logo"
                  style={{ height: 56, objectFit: 'contain' }}
                />
              </Box>
            </motion.div>
          </Box>

          <Paper
            elevation={1}
            sx={{
              p: 4,
              mb: 4,
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: alpha(theme.palette.background.paper, 0.4),
              backdropFilter: 'blur(20px)',
              textAlign: "center"
            }}
          >
            <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
              Authentication is strictly managed via your corporate Identity Provider.
            </Typography>

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={() => signIn("keycloak")}
              sx={{ py: 1.5 }}
            >
              Sign In with Corporate SSO
            </Button>
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
            Internal Network • Relayer v3.5
          </Typography>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: 'text.secondary',
              mt: 1,
              fontSize: '0.6rem',
              maxWidth: '300px',
              mx: 'auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {typeof window !== 'undefined' ? window.navigator.userAgent : ''}
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
}
