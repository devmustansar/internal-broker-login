"use client";

import { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  IconButton, 
  Chip, 
  Skeleton,
  alpha,
  useTheme,
  Tooltip,
  Stack,
  Button as MuiButton
} from "@mui/material";
import { Edit2, Shield, Layout, Server, Database, ExternalLink, Globe } from "lucide-react";

export default function AdminResourcesList({
  onEditWeb,
  onEditAws,
}: {
  onEditWeb: (resource: any) => void;
  onEditAws: (resource: any) => void;
}) {
  const [webResources, setWebResources] = useState<any[]>([]);
  const [awsResources, setAwsResources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const fetchAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [webRes, awsRes] = await Promise.all([
        fetch("/api/admin/apps").then((res) => res.json()),
        fetch("/api/admin/aws/resources").then((res) => res.json()),
      ]);

      if (webRes.error) throw new Error(webRes.error);
      if (awsRes.error) throw new Error(awsRes.error);

      setWebResources(webRes);
      setAwsResources(awsRes);
    } catch (err: any) {
      setError(err.message || "Failed to load resources");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (error) {
    return (
      <Box sx={{ p: 4, bgcolor: alpha(theme.palette.error.main, 0.05), border: `1px solid ${theme.palette.error.main}`, borderRadius: 3 }}>
        <Typography color="error" variant="body2" sx={{ fontWeight: 700 }}>{error}</Typography>
      </Box>
    );
  }

  const renderSkeleton = () => (
    <Stack spacing={2}>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rectangular" height={64} sx={{ borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.5) }} />
      ))}
    </Stack>
  );

  return (
    <Box sx={{ spaceY: 8 }}>
      {/* Web Resources Section */}
      <Box sx={{ mb: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1.5, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <Globe size={16} /> Web Applications Topology
          </Typography>
          <Chip 
            label={`${webResources.length} NODES`} 
            size="small" 
            sx={{ fontWeight: 900, fontSize: '0.65rem', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.light' }} 
          />
        </Box>

        {isLoading ? renderSkeleton() : (
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent', border: `1px solid ${theme.palette.divider}`, borderRadius: 4, overflow: 'hidden' }}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead sx={{ bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>IDENTIFIER</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>TOPOLOGY KEY</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>ORGANIZATION</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>STRATEGY</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>No handoff endpoints provisioned.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  webResources.map((res) => (
                    <TableRow key={res.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{res.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'primary.light', fontWeight: 600 }}>{res.resourceKey}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip label={res.organization?.name || 'Unassigned'} size="small" variant="outlined" sx={{ border: 'none', bgcolor: res.organization ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.text.secondary, 0.1), height: 24, fontSize: '0.65rem', fontWeight: 700, color: res.organization ? 'success.light' : 'text.secondary' }} />
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip label={res.loginAdapter} size="small" variant="outlined" sx={{ border: 'none', bgcolor: alpha(theme.palette.background.paper, 0.4), height: 24, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.05em' }} />
                      </TableCell>
                      <TableCell align="right" sx={{ py: 2 }}>
                        <Tooltip title="Modify Configuration">
                          <IconButton size="small" onClick={() => onEditWeb(res)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                            <Edit2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* AWS Resources Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1.5, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            <Server size={16} /> AWS Federation Infrastructure
          </Typography>
          <Chip 
            label={`${awsResources.length} TENANTS`} 
            size="small" 
            sx={{ fontWeight: 900, fontSize: '0.65rem', bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.light' }} 
          />
        </Box>

        {isLoading ? renderSkeleton() : (
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent', border: `1px solid ${theme.palette.divider}`, borderRadius: 4, overflow: 'hidden' }}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead sx={{ bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>TENANT NAME</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>ACCOUNT ID</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>ORGANIZATION</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>CLUSTER KEY</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.7rem', py: 2 }}>ACTIONS</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {awsResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>No federation tenants active.</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  awsResources.map((res) => (
                    <TableRow key={res.id} sx={{ borderLeft: `4px solid ${theme.palette.warning.main}`, '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.02) } }}>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{res.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontWeight: 600 }}>{res.awsAccountId}</Typography>
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Chip label={res.organization?.name || 'Unassigned'} size="small" variant="outlined" sx={{ border: 'none', bgcolor: res.organization ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.text.secondary, 0.1), height: 24, fontSize: '0.65rem', fontWeight: 700, color: res.organization ? 'success.light' : 'text.secondary' }} />
                      </TableCell>
                      <TableCell sx={{ py: 2 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'warning.main', fontWeight: 600 }}>{res.resourceKey}</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 2 }}>
                        <Tooltip title="Modify Infrastructure">
                          <IconButton size="small" onClick={() => onEditAws(res)} sx={{ color: 'text.secondary', '&:hover': { color: 'warning.main' } }}>
                            <Edit2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}
