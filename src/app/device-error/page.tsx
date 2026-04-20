"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  alpha,
  useTheme,
} from "@mui/material";
import { ShieldAlert, Monitor, ArrowLeft, HelpCircle } from "lucide-react";

function DeviceErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") || "Your device could not be verified.";
  const machineCn = searchParams.get("machine") || "Unknown";
  const theme = useTheme();

  return (
    <Container maxWidth="sm" sx={{ mt: 12, mb: 8 }}>
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 6,
          bgcolor: alpha(theme.palette.error.main, 0.03),
          border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: alpha(theme.palette.error.main, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 4,
          }}
        >
          <ShieldAlert size={40} color={theme.palette.error.main} />
        </Box>

        <Typography
          variant="h4"
          sx={{ fontWeight: 800, mb: 2, color: "error.main" }}
        >
          Device Not Verified
        </Typography>

        <Typography
          variant="body1"
          sx={{ color: "text.secondary", mb: 4, lineHeight: 1.7 }}
        >
          {reason}
        </Typography>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 4,
            borderRadius: 4,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Monitor size={18} color={theme.palette.text.secondary} />
              <Box sx={{ textAlign: "left" }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: "text.secondary",
                    letterSpacing: "0.1em",
                    display: "block",
                  }}
                >
                  MACHINE IDENTIFIER
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "monospace", fontWeight: 600 }}
                >
                  {machineCn}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        <Stack spacing={2}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            href="/"
            startIcon={<ArrowLeft size={18} />}
            sx={{
              py: 1.5,
              fontWeight: 700,
              borderRadius: 3,
            }}
          >
            Back to Login
          </Button>
          <Button
            variant="outlined"
            fullWidth
            size="large"
            href="mailto:support@codingcops.com?subject=Device%20Enrollment%20Request"
            startIcon={<HelpCircle size={18} />}
            sx={{
              py: 1.5,
              fontWeight: 700,
              borderRadius: 3,
              color: "text.secondary",
              borderColor: theme.palette.divider,
            }}
          >
            Contact IT Support
          </Button>
        </Stack>
      </Paper>

      <Typography
        variant="caption"
        sx={{
          display: "block",
          mt: 4,
          textAlign: "center",
          color: "text.secondary",
          fontStyle: "italic",
        }}
      >
        Only devices enrolled in the organization&apos;s fleet management system
        can access this portal.
      </Typography>
    </Container>
  );
}

export default function DeviceErrorPage() {
  return (
    <Suspense fallback={null}>
      <DeviceErrorContent />
    </Suspense>
  );
}
