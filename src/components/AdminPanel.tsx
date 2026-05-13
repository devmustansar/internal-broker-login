"use client";

import { useState, useEffect } from "react";
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Grid, 
  Stack, 
  Tabs, 
  Tab, 
  Select, 
  MenuItem, 
  FormControl,
  Alert,
  Divider,
  IconButton,
  Chip,
  alpha,
  useTheme,
  InputAdornment,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  ListItemText,
  Checkbox,
  Collapse,
  TablePagination,
  Autocomplete,
} from "@mui/material";
import { useApp } from "@/lib/app-context";
import AdminResourcesList from "@/components/AdminResourcesList";
import CredentialVaultPanel from "@/components/CredentialVaultPanel";
import { 
  ShieldCheck, 
  Database, 
  KeyRound, 
  AlertCircle, 
  Eye, 
  Rocket, 
  Users, 
  Combine,
  Plus,
  Trash2,
  Lock,
  Globe,
  Server,
  Fingerprint,
  Building2,
  UserPlus,
  Settings2,
  X,
  ClipboardList,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AdminActionProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

function AppForm({ onSuccess, onError, initialData, onCancelEdit }: AdminActionProps & { initialData?: any; onCancelEdit?: () => void }) {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    resourceKey: initialData?.resourceKey || "",
    name: initialData?.name || "",
    appHost: initialData?.appHost || "",
    apiHost: initialData?.apiHost || "",
    loginUrl: initialData?.loginUrl || "",
    loginAdapter: initialData?.loginAdapter || "json_login",
    tokenExtractionPath: initialData?.tokenExtractionPath || "",
    tokenValidationPath: initialData?.tokenValidationPath || "",
    magicLinkExtractionPath: (initialData as any)?.magicLinkExtractionPath || "",
    loginPayloadTemplate: (initialData as any)?.loginPayloadTemplate || "",
    usernameField: initialData?.usernameField || "",
    passwordField: initialData?.passwordField || "",
    environment: initialData?.environment || "production",
    description: initialData?.description || "",
    organizationId: initialData?.organizationId || "",
    managedUsername: "",
    managedPassword: "",
  });

  useEffect(() => {
    fetch("/api/admin/organizations").then(r => r.json()).then(setOrganizations).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchCredentials = async () => {
      const secretRef = initialData?.accounts?.[0]?.vaultPath || `secret/apps/${initialData?.resourceKey}/admin`;
      if (!secretRef || !initialData) return;
      
      try {
        const res = await fetch(`/api/admin/secrets?secretRef=${encodeURIComponent(secretRef)}&kind=web_basic_credentials`);
        if (res.ok) {
          const secret = await res.json();
          setFormData(prev => ({
            ...prev,
            managedUsername: secret.payload?.username || "",
            managedPassword: secret.payload?.password || "",
          }));
        }
      } catch (err) {
        console.error("Failed to fetch app credentials:", err);
      }
    };

    fetchCredentials();
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEdit = !!initialData;
      const res = await fetch("/api/admin/apps", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: initialData.id, ...formData } : formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} app`);
      
      // Save vaulted credentials if provided
      if (formData.managedUsername || formData.managedPassword) {
        const secretRef = data.accounts?.[0]?.vaultPath || `secret/apps/${formData.resourceKey}/admin`;
        await fetch("/api/admin/secrets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secretRef,
            kind: "web_basic_credentials",
            payload: {
              username: formData.managedUsername,
              password: formData.managedPassword,
            },
            metadata: {
              resourceKey: formData.resourceKey,
              label: `${formData.name} Admin`
            }
          }),
        });
      }

      onSuccess(`App "${data.name}" ${isEdit ? "updated" : "created"} successfully!`);
      
      if (!isEdit) {
        setFormData({
          resourceKey: "",
          name: "",
          appHost: "",
          apiHost: "",
          loginUrl: "",
          loginAdapter: "json_login",
          tokenExtractionPath: "",
          tokenValidationPath: "",
          magicLinkExtractionPath: "",
          loginPayloadTemplate: "",
          usernameField: "",
          passwordField: "",
          environment: "production",
          description: "",
          organizationId: "",
          managedUsername: "",
          managedPassword: "",
        });
      } else if (onCancelEdit) {
        onCancelEdit();
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>RESOURCE KEY</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. jenkins-ci"
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            required
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>APP NAME</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. Jenkins Master"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ORGANIZATION</Typography>
          <FormControl fullWidth>
            <Select
              value={formData.organizationId}
              onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
              displayEmpty
            >
              <MenuItem value=""><em>Unassigned</em></MenuItem>
              {organizations.map((org: any) => (
                <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={12}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>APP HOST URL</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="https://jenkins.company.com"
            value={formData.appHost}
            onChange={(e) => setFormData({ ...formData, appHost: e.target.value })}
            required
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>LOGIN URL</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="https://jenkins.company.com/login"
            value={formData.loginUrl}
            onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
            required
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ADAPTER STRATEGY</Typography>
          <FormControl fullWidth>
            <Select
              value={formData.loginAdapter}
              onChange={(e) => setFormData({ ...formData, loginAdapter: e.target.value })}
            >
              <MenuItem value="json_login">JSON API Request</MenuItem>
              <MenuItem value="form_login_basic">Legacy Basic Form</MenuItem>
              <MenuItem value="form_login_csrf">Form with CSRF Mitigation</MenuItem>
              <MenuItem value="magic_link">Magic Link (direct redirect)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>USERNAME PAYLOAD KEY</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. email or username"
            value={formData.usernameField}
            onChange={(e) => setFormData({ ...formData, usernameField: e.target.value })}
            helperText={formData.loginPayloadTemplate ? "Overridden by payload template below" : undefined}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>PASSWORD PAYLOAD KEY</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. password"
            value={formData.passwordField}
            onChange={(e) => setFormData({ ...formData, passwordField: e.target.value })}
            helperText={formData.loginPayloadTemplate ? "Overridden by payload template below" : undefined}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>

        {/* Login Payload Template — shown for json_login and magic_link */}
        {(formData.loginAdapter === "json_login" || formData.loginAdapter === "magic_link") && (
          <Grid size={12}>
            <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>LOGIN PAYLOAD TEMPLATE</Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              variant="outlined"
              placeholder={JSON.stringify({
                user_params: {
                  email: "{{email}}",
                  password: "{{password}}",
                  external_login_url: true
                }
              }, null, 2)}
              value={formData.loginPayloadTemplate}
              onChange={(e) => setFormData({ ...formData, loginPayloadTemplate: e.target.value })}
              helperText={
                formData.loginPayloadTemplate
                  ? (() => { try { JSON.parse(formData.loginPayloadTemplate); return "✓ Valid JSON"; } catch { return "⚠ Invalid JSON — fix before saving"; } })()
                  : "Optional. Leave blank to send a flat {email, password} body. Use {{email}} and {{password}} as placeholders anywhere in the JSON."
              }
              error={!!formData.loginPayloadTemplate && (() => { try { JSON.parse(formData.loginPayloadTemplate); return false; } catch { return true; } })()}
              sx={{
                '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem' },
              }}
            />
          </Grid>
        )}

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>TOKEN EXTRACTION PATH</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. info.token"
            value={formData.tokenExtractionPath}
            onChange={(e) => setFormData({ ...formData, tokenExtractionPath: e.target.value })}
            disabled={formData.loginAdapter !== "json_login"}
            helperText={formData.loginAdapter === "magic_link" ? "Not used for magic_link adapter" : undefined}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>VALIDATION ENDPOINT</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. /auth/validate"
            value={formData.tokenValidationPath}
            onChange={(e) => setFormData({ ...formData, tokenValidationPath: e.target.value })}
            disabled={formData.loginAdapter === "magic_link"}
            helperText={formData.loginAdapter === "magic_link" ? "Not used for magic_link adapter" : undefined}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>

        {/* Magic Link extraction path — only shown when magic_link adapter is selected */}
        {formData.loginAdapter === "magic_link" && (
          <Grid size={12}>
            <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>MAGIC LINK URL PATH</Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder='e.g. data.url  or  link  or  redirectUrl'
              value={formData.magicLinkExtractionPath}
              onChange={(e) => setFormData({ ...formData, magicLinkExtractionPath: e.target.value })}
              helperText="JSON dot-path to the redirect URL in the login response (leave blank to auto-detect common field names)."
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            />
          </Grid>
        )}

        {/* Managed Credentials Section */}
        <Grid size={12}>
          <Divider sx={{ my: 4 }}>
            <Chip 
              icon={<Lock size={14} />} 
              label="VAULTED CREDENTIALS" 
              sx={{ fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.05em' }} 
            />
          </Divider>
          <Alert icon={<ShieldCheck size={20} />} severity="info" sx={{ mb: 4, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05), border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.light' }}>
              These credentials are encrypted at rest using AES-256-GCM. They are used by the broker to authenticate with the upstream application.
            </Typography>
          </Alert>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>BROKER USERNAME</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="svc-broker@company.com"
            value={formData.managedUsername}
            onChange={(e) => setFormData({ ...formData, managedUsername: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>BROKER PASSWORD</Typography>
          <TextField
            fullWidth
            type="password"
            variant="outlined"
            placeholder="••••••••••••"
            value={formData.managedPassword}
            onChange={(e) => setFormData({ ...formData, managedPassword: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>

        <Grid size={12}>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ flex: 1, h: 56, fontWeight: 800 }}
              startIcon={loading ? <CircularProgress size={20} /> : <Rocket size={20} />}
            >
              {initialData ? "Apply Changes" : "Provision Connectivity"}
            </Button>
            {onCancelEdit && (
              <Button
                variant="outlined"
                size="large"
                onClick={onCancelEdit}
                sx={{ px: 4, borderRadius: 3, fontWeight: 700 }}
              >
                Cancel
              </Button>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

function AwsResourceForm({ onSuccess, onError, initialData, onCancelEdit }: AdminActionProps & { initialData?: any; onCancelEdit?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    awsAccountId: initialData?.awsAccountId || "",
    roleArn: initialData?.roleArn || "",
    region: initialData?.region || "us-east-1",
    destination: initialData?.destination || "https://console.aws.amazon.com/",
    issuer: initialData?.issuer || "internal-broker",
    sessionDurationSeconds: initialData?.sessionDurationSeconds || 3600,
    externalId: initialData?.externalId || "",
    stsStrategy: initialData?.stsStrategy || "assume_role",
    environment: initialData?.environment || "production",
    description: initialData?.description || "",
    organizationId: initialData?.organizationId || "",
    availablePolicyArns: (initialData?.availablePolicyArns || []).join('\n'),
    sessionName: initialData?.sessionName || "",
    accessKeyId: "",
    secretAccessKey: "",
  });

  useEffect(() => {
    fetch("/api/admin/organizations").then(r => r.json()).then(setOrganizations).catch(console.error);
  }, []);

  useEffect(() => {
    const fetchCredentials = async () => {
      if (!initialData?.resourceKey) return;
      const secretRef = `aws/resource/${initialData.resourceKey}`;
      try {
        const res = await fetch(`/api/admin/secrets?secretRef=${encodeURIComponent(secretRef)}&kind=aws_iam_credentials`);
        if (res.ok) {
          const secret = await res.json();
          setFormData(prev => ({
            ...prev,
            accessKeyId: secret.payload?.accessKeyId || "",
            secretAccessKey: secret.payload?.secretAccessKey || "",
          }));
        }
      } catch (err) {
        console.error("Failed to fetch AWS credentials:", err);
      }
    };

    fetchCredentials();
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEdit = !!initialData;
      // Parse availablePolicyArns from string into array
      const policyArnsArray = formData.availablePolicyArns
        .split(/[\n,]+/)
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);

      const { accessKeyId, secretAccessKey, ...resourceFields } = formData;
      const payload = isEdit
        ? { id: initialData.id, resourceKey: initialData.resourceKey, ...resourceFields, availablePolicyArns: policyArnsArray }
        : { ...resourceFields, availablePolicyArns: policyArnsArray };

      const res = await fetch("/api/admin/aws/resources", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} AWS resource`);

      // Save IAM credentials scoped to this resource
      if (accessKeyId || secretAccessKey) {
        const resourceKey = isEdit ? initialData.resourceKey : data.resourceKey;
        await fetch("/api/admin/secrets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secretRef: `aws/resource/${resourceKey}`,
            kind: "aws_iam_credentials",
            payload: { accessKeyId, secretAccessKey },
            metadata: { resourceKey, label: `${formData.name} IAM Credentials` },
          }),
        });
      }

      onSuccess(`AWS Resource "${data.name}" ${isEdit ? "updated" : "created"} successfully!`);
      
      if (!isEdit) {
        setFormData({
          name: "",
          awsAccountId: "",
          roleArn: "",
          region: "us-east-1",
          destination: "https://console.aws.amazon.com/",
          issuer: "internal-broker",
          sessionDurationSeconds: 3600,
          externalId: "",
          stsStrategy: "assume_role",
          environment: "production",
          description: "",
          organizationId: "",
          availablePolicyArns: "",
          sessionName: "",
          accessKeyId: "",
          secretAccessKey: "",
        });
      } else if (onCancelEdit) {
        onCancelEdit();
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={4}>
        {initialData?.resourceKey && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>RESOURCE KEY</Typography>
            <TextField
              fullWidth
              variant="outlined"
              value={initialData.resourceKey}
              disabled
              InputProps={{ sx: { fontFamily: 'monospace', color: 'text.secondary' } }}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ORGANIZATION</Typography>
          <FormControl fullWidth>
            <Select
              value={formData.organizationId}
              onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
              displayEmpty
            >
              <MenuItem value=""><em>Unassigned</em></MenuItem>
              {organizations.map((org: any) => (
                <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>TENANT NAME</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. AWS Production"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>AWS ACCOUNT ID</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="123456789012"
            value={formData.awsAccountId}
            onChange={(e) => setFormData({ ...formData, awsAccountId: e.target.value })}
            required
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>IAM ROLE ARN</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="arn:aws:iam::..."
            value={formData.roleArn}
            onChange={(e) => setFormData({ ...formData, roleArn: e.target.value })}
            required
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>REGION</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="us-east-1"
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>STS STRATEGY</Typography>
          <FormControl fullWidth>
            <Select
              value={formData.stsStrategy}
              onChange={(e) => setFormData({ ...formData, stsStrategy: e.target.value })}
            >
              <MenuItem value="assume_role">Assume Role (STS)</MenuItem>
              <MenuItem value="federation_token">Federation Token (Identity)</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>SESSION NAME</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. broker-session (leave blank to use user email)"
            value={formData.sessionName}
            onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
            helperText="Appears as RoleSessionName in CloudTrail. Blank = authenticated user's email."
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>SESSION TTL (SECONDS)</Typography>
          <TextField
            fullWidth
            type="number"
            variant="outlined"
            value={formData.sessionDurationSeconds}
            onChange={(e) => setFormData({ ...formData, sessionDurationSeconds: Number(e.target.value) })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>

        {/* IAM Credentials Section */}
        <Grid size={12}>
          <Divider sx={{ my: 4 }}>
            <Chip 
              icon={<ShieldCheck size={14} />} 
              label="IAM BROKER CREDENTIALS" 
              sx={{ fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.05em' }} 
            />
          </Divider>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ACCESS KEY ID</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="AKIA..."
            value={formData.accessKeyId}
            onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>SECRET ACCESS KEY</Typography>
          <TextField
            fullWidth
            type="password"
            variant="outlined"
            placeholder="••••••••••••"
            value={formData.secretAccessKey}
            onChange={(e) => setFormData({ ...formData, secretAccessKey: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={12}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>CONSOLE HANDOFF TARGET</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="https://console.aws.amazon.com/"
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={12}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>AVAILABLE POLICY ARNS (One per line)</Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="arn:aws:iam::aws:policy/ReadOnlyAccess&#10;arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
            value={formData.availablePolicyArns}
            onChange={(e) => setFormData({ ...formData, availablePolicyArns: e.target.value })}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            helperText="Specify IAM managed policy ARNs that admins can assign to users for this resource."
          />
        </Grid>

        <Grid size={12}>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              color="warning"
              sx={{ flex: 1, h: 56, fontWeight: 800, color: 'black' }}
              startIcon={loading ? <CircularProgress size={20} /> : <Combine size={20} />}
            >
              {initialData ? "Update Infrastructure" : "Establish AWS Federation"}
            </Button>
            {onCancelEdit && (
              <Button
                variant="outlined"
                size="large"
                onClick={onCancelEdit}
                sx={{ px: 4, borderRadius: 3, fontWeight: 700 }}
              >
                Cancel
              </Button>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}

function CreateUserForm({ onSuccess, onError }: AdminActionProps) {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const { user } = useApp();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    role: "user",
    organizationIds: [] as string[],
  });

  useEffect(() => {
    fetch("/api/admin/organizations").then(r => r.json()).then(setOrganizations).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      onSuccess(`User "${data.name}" created successfully!`);
      setFormData({
        email: "",
        name: "",
        password: "",
        role: "user",
        organizationIds: [],
      });
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>IDENTITY EMAIL</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="developer@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Fingerprint size={18} color={theme.palette.text.secondary} />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>LEGAL NAME</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="John Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>TEMPORARY PASSKEY</Typography>
          <TextField
            fullWidth
            type="password"
            variant="outlined"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Lock size={18} color={theme.palette.text.secondary} />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ACCESS ENTITLEMENT</Typography>
          <FormControl fullWidth>
            <Select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <MenuItem value="user">Standard Developer</MenuItem>
              {(user?.role === "super_admin" || user?.role === "admin") && <MenuItem value="admin">Cluster Administrator</MenuItem>}
              <MenuItem value="readonly">Read-Only Auditor</MenuItem>
              {user?.role === "super_admin" && <MenuItem value="super_admin">Super Administrator</MenuItem>}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={12}>
          <Typography variant="caption" sx={{ mb: 2, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>RESOURCE ACCESS</Typography>
          <Box sx={{ p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.info.main, 0.06), border: `1px dashed ${alpha(theme.palette.info.main, 0.3)}` }}>
            <Typography variant="body2" sx={{ color: 'info.light', fontStyle: 'italic' }}>Resources can be assigned to this user after creation via the &quot;Assign Resource&quot; workflow in the Users table.</Typography>
          </Box>
        </Grid>
        <Grid size={12}>
          <Typography variant="caption" sx={{ mb: 2, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ORGANIZATION MEMBERSHIP</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3, p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.4), border: `1px solid ${theme.palette.divider}` }}>
            {formData.organizationIds.map((orgId) => {
              const org = organizations.find((o: any) => o.id === orgId);
              return (
                <Chip
                  key={orgId}
                  label={org?.name || orgId}
                  onDelete={() => setFormData({ ...formData, organizationIds: formData.organizationIds.filter((id) => id !== orgId) })}
                  icon={<Building2 size={14} />}
                  sx={{ borderRadius: 2, fontWeight: 700, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.light' }}
                />
              );
            })}
            {formData.organizationIds.length === 0 && (
              <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No organizations assigned yet.</Typography>
            )}
          </Box>
          <FormControl fullWidth>
            <Select
              value=""
              onChange={(e) => {
                const orgId = e.target.value as string;
                if (orgId && !formData.organizationIds.includes(orgId)) {
                  setFormData({ ...formData, organizationIds: [...formData.organizationIds, orgId] });
                }
              }}
              displayEmpty
            >
              <MenuItem value="" disabled><em>Select organization to assign</em></MenuItem>
              {organizations.filter((o: any) => !formData.organizationIds.includes(o.id)).map((org: any) => (
                <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={12}>
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ py: 2, fontWeight: 800, mt: 2 }}
          >
            Provision Active Identity
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}

function OrganizationsPanel({ onSuccess, onError }: AdminActionProps) {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const theme = useTheme();
  const { user } = useApp();
  const isSuperAdminUser = user?.role === "super_admin";
  const isGlobalAdmin = user?.role === "super_admin" || user?.role === "admin";

  // Inline expand state — tracks which org IDs are expanded
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  // Members cache per org
  const [orgMembers, setOrgMembers] = useState<Record<string, any[]>>({});
  const [loadingOrgs, setLoadingOrgs] = useState<Set<string>>(new Set());
  // Add-member state per org
  const [addState, setAddState] = useState<Record<string, { email: string; role: string; saving: boolean }>>({});
  // All users for add-member lookup
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const fetchOrgs = async () => {
    try {
      const res = await fetch("/api/admin/organizations");
      if (res.ok) setOrgs(await res.json());
    } catch (err) {
      console.error("Failed to fetch organizations:", err);
    }
  };

  useEffect(() => { fetchOrgs(); }, []);

  // Lazy-load all users once (for add-member dropdowns)
  const ensureUsersLoaded = async () => {
    if (usersLoaded) return;
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) { setAllUsers(await res.json()); setUsersLoaded(true); }
    } catch (err) { console.error(err); }
  };

  const fetchMembers = async (orgId: string) => {
    setLoadingOrgs((prev) => new Set(prev).add(orgId));
    try {
      const res = await fetch(`/api/admin/organizations/members?organizationId=${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setOrgMembers((prev) => ({ ...prev, [orgId]: data }));
      }
    } catch (err) { console.error(err); }
    finally { setLoadingOrgs((prev) => { const n = new Set(prev); n.delete(orgId); return n; }); }
  };

  const toggleExpand = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const n = new Set(prev);
      if (n.has(orgId)) { n.delete(orgId); } else { n.add(orgId); fetchMembers(orgId); ensureUsersLoaded(); }
      return n;
    });
  };

  // For global admin: expand all orgs and load all members on mount
  useEffect(() => {
    if (isGlobalAdmin && orgs.length > 0) {
      const ids = new Set(orgs.map((o) => o.id));
      setExpandedOrgs(ids);
      ids.forEach((id) => fetchMembers(id));
      ensureUsersLoaded();
    }
  }, [isGlobalAdmin, orgs.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create organization");
      onSuccess(`Organization "${data.name}" created successfully!`);
      setFormData({ name: "", description: "" });
      fetchOrgs();
    } catch (err: any) { onError(err.message); }
    finally { setLoading(false); }
  };

  const handleChangeRole = async (orgId: string, userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/organizations/members", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role");
      onSuccess("Role updated successfully");
      fetchMembers(orgId);
    } catch (err: any) { onError(err.message); }
  };

  const handleRemoveMember = async (orgId: string, userId: string, email: string) => {
    try {
      const res = await fetch("/api/admin/organizations/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");
      onSuccess(`${email} removed`);
      fetchMembers(orgId);
      fetchOrgs();
    } catch (err: any) { onError(err.message); }
  };

  const handleAddMember = async (orgId: string) => {
    const s = addState[orgId];
    if (!s?.email) return;
    setAddState((p) => ({ ...p, [orgId]: { ...p[orgId], saving: true } }));
    try {
      const matched = allUsers.find((u: any) => u.email === s.email);
      if (!matched) throw new Error(`User "${s.email}" not found in system.`);
      const res = await fetch("/api/admin/organizations/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, userId: matched.id, role: s.role || "member" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add member");
      onSuccess(`${s.email} added as ${s.role || "member"}`);
      setAddState((p) => ({ ...p, [orgId]: { email: "", role: "member", saving: false } }));
      fetchMembers(orgId);
      fetchOrgs();
    } catch (err: any) { onError(err.message); setAddState((p) => ({ ...p, [orgId]: { ...p[orgId], saving: false } })); }
  };

  return (
    <Stack spacing={8}>
      {/* Create Organization — super_admin only */}
      {isSuperAdminUser && (
        <Box>
          <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'primary.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
            Create Organization
          </Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>ORGANIZATION NAME</Typography>
                <TextField fullWidth variant="outlined" placeholder="e.g. CodingCops" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>DESCRIPTION</Typography>
                <TextField fullWidth variant="outlined" placeholder="Brief description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </Grid>
              <Grid size={12}>
                <Button fullWidth type="submit" variant="contained" size="large" disabled={loading} sx={{ py: 2, fontWeight: 800 }} startIcon={loading ? <CircularProgress size={20} /> : <Building2 size={20} />}>
                  Create Organization
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Box>
      )}

      {/* Organizations with inline members */}
      <Box>
        <Typography variant="caption" sx={{ mb: 4, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'text.secondary', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
          <Building2 size={16} /> {isGlobalAdmin ? "All Organizations & Members" : "Registered Organizations"}
        </Typography>

        {orgs.length === 0 ? (
          <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>No organizations created yet.</Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {orgs.map((org) => {
              const isExpanded = expandedOrgs.has(org.id);
              const membersList = orgMembers[org.id] || [];
              const isLoading = loadingOrgs.has(org.id);
              const as = addState[org.id] || { email: "", role: "member", saving: false };

              return (
                <Paper key={org.id} elevation={0} sx={{ borderRadius: 4, border: `1px solid ${isExpanded ? alpha(theme.palette.primary.main, 0.3) : theme.palette.divider}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                  {/* Org Header Row — clickable to expand */}
                  <Box
                    onClick={() => toggleExpand(org.id)}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) }, transition: 'background-color 0.15s' }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center" flex={1}>
                      <Building2 size={18} color={theme.palette.primary.main} />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{org.name}</Typography>
                        {org.description && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{org.description}</Typography>}
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip label={`${(org._count?.resources || 0) + (org._count?.awsResources || 0)} resources`} size="small" sx={{ fontWeight: 700, fontSize: '0.6rem', bgcolor: alpha(theme.palette.primary.main, 0.08), color: 'primary.light' }} />
                      <Chip label={`${org._count?.users || 0} members`} size="small" sx={{ fontWeight: 700, fontSize: '0.6rem', bgcolor: alpha(theme.palette.success.main, 0.08), color: 'success.light' }} />
                      {isExpanded ? <ChevronUp size={16} color={theme.palette.text.secondary} /> : <ChevronDown size={16} color={theme.palette.text.secondary} />}
                    </Stack>
                  </Box>

                  {/* Expanded: Inline Members */}
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, px: 3, py: 2, bgcolor: alpha(theme.palette.background.default, 0.3) }}>
                      {/* Add member inline */}
                      <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), border: `1px solid ${alpha(theme.palette.primary.main, 0.08)}` }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.08em', minWidth: 90 }}>ADD MEMBER</Typography>
                          <Autocomplete
                            size="small"
                            options={allUsers}
                            getOptionLabel={(option) => `${option.name} (${option.email})`}
                            sx={{ flex: 2 }}
                            value={allUsers.find(u => u.email === as.email) || null}
                            onChange={(_, newValue) => {
                              setAddState((p) => ({ ...p, [org.id]: { ...as, email: newValue ? newValue.email : "" } }))
                            }}
                            renderInput={(params) => (
                              <TextField {...params} variant="outlined" placeholder="Search user by name or email..." sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem' } }} />
                            )}
                          />
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select value={as.role} onChange={(e) => setAddState((p) => ({ ...p, [org.id]: { ...as, role: e.target.value } }))}>
                              <MenuItem value="member">Member</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                              <MenuItem value="owner">Owner</MenuItem>
                            </Select>
                          </FormControl>
                          <Button variant="contained" size="small" disabled={as.saving || !as.email} onClick={() => handleAddMember(org.id)}
                            startIcon={as.saving ? <CircularProgress size={12} /> : <UserPlus size={12} />}
                            sx={{ fontWeight: 800, px: 2, whiteSpace: 'nowrap', fontSize: '0.7rem' }}>
                            {as.saving ? '…' : 'Add'}
                          </Button>
                        </Stack>
                      </Box>

                      {/* Members Table */}
                      {isLoading ? (
                        <Stack alignItems="center" py={3}><CircularProgress size={22} /><Typography variant="caption" sx={{ mt: 1, color: 'text.secondary' }}>Loading…</Typography></Stack>
                      ) : membersList.length === 0 ? (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', display: 'block', textAlign: 'center', py: 3 }}>No members yet.</Typography>
                      ) : (
                        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent', border: `1px solid ${theme.palette.divider}`, borderRadius: 3, overflow: 'hidden' }}>
                          <Table size="small">
                            <TableHead sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6) }}>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.05em' }}>USER</TableCell>
                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.05em' }}>GLOBAL ROLE</TableCell>
                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.05em' }}>ORG ROLE</TableCell>
                                <TableCell sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.05em' }} align="right">ACTIONS</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {membersList.map((m: any) => (
                                <TableRow key={m.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                                  <TableCell sx={{ py: 1.5 }}>
                                    <Stack spacing={0.25}>
                                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{m.user?.name}</Typography>
                                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.65rem' }}>{m.user?.email}</Typography>
                                    </Stack>
                                  </TableCell>
                                  <TableCell sx={{ py: 1.5 }}>
                                    <Chip label={m.user?.role} size="small" variant="outlined"
                                      color={(m.user?.role === "super_admin" ? "error" : m.user?.role === "admin" ? "warning" : "default") as any}
                                      sx={{ fontWeight: 700, fontSize: '0.6rem', textTransform: 'uppercase' }} />
                                  </TableCell>
                                  <TableCell sx={{ py: 1.5 }}>
                                    <FormControl size="small" sx={{ minWidth: 110 }}>
                                      <Select value={m.role} onChange={(e) => handleChangeRole(org.id, m.userId, e.target.value)}
                                        sx={{ fontWeight: 700, fontSize: '0.75rem', color: m.role === 'owner' ? 'error.main' : m.role === 'admin' ? 'warning.main' : 'text.primary', '& .MuiSelect-select': { py: 0.5 } }}>
                                        <MenuItem value="member">Member</MenuItem>
                                        <MenuItem value="admin">Admin</MenuItem>
                                        <MenuItem value="owner">Owner</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </TableCell>
                                  <TableCell sx={{ py: 1.5 }} align="right">
                                    <Tooltip title="Remove from organization">
                                      <IconButton size="small" onClick={() => handleRemoveMember(org.id, m.userId, m.user?.email)}
                                        sx={{ bgcolor: alpha(theme.palette.error.main, 0.08), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.18) } }}>
                                        <Trash2 size={13} />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}


// ─── Users Panel ─────────────────────────────────────────────────────────────

function PolicyChecklist({
  availablePolicies,
  selected,
  onChange,
}: {
  availablePolicies: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}
    >
      {availablePolicies.map((arn) => {
        const checked = selected.includes(arn);
        return (
          <Box
            key={arn}
            onClick={() => onChange(checked ? selected.filter((a) => a !== arn) : [...selected, arn])}
            sx={{
              display: "flex", alignItems: "center", px: 2, py: 1.5, gap: 1.5, cursor: "pointer",
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: checked ? alpha(theme.palette.warning.main, 0.05) : "transparent",
              "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
              "&:last-child": { borderBottom: "none" },
              transition: "background-color 0.15s ease",
            }}
          >
            <Checkbox checked={checked} size="small" color="warning" sx={{ p: 0 }} />
            <Box flex={1} minWidth={0}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: checked ? "warning.main" : "text.primary" }}>
                {arn.split("/").pop()}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: "0.65rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {arn}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}

function UsersPanel({ onSuccess, onError }: AdminActionProps) {
  const theme = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [allResources, setAllResources] = useState<any[]>([]);
  const [awsResources, setAwsResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<any | null>(null);
  const [assignForm, setAssignForm] = useState({ resourceKey: "", policyArns: [] as string[], sessionName: "" });
  const [saving, setSaving] = useState(false);

  // Manage dialog
  const [manageTarget, setManageTarget] = useState<any | null>(null);
  const [editingPolicies, setEditingPolicies] = useState<Record<string, string[]>>({});
  const [managing, setManaging] = useState<string | null>(null); // resourceKey being acted on

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Add User modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [usersRes, webRes, awsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/apps"),
        fetch("/api/admin/aws/resources"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (webRes.ok) setAllResources(await webRes.json());
      if (awsRes.ok) setAwsResources(await awsRes.json());
    } catch (err) {
      console.error("Failed to load users/resources", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Assign helpers ────────────────────────────────────────────────────────
  const openAssign = (user: any) => {
    setAssignTarget(user);
    setAssignForm({ resourceKey: "", policyArns: [], sessionName: "" });
  };
  const closeAssign = () => setAssignTarget(null);
  const matchedAwsResource = awsResources.find((r) => r.resourceKey === assignForm.resourceKey);
  const availablePolicies: string[] = matchedAwsResource?.availablePolicyArns || [];

  const handleAssign = async () => {
    if (!assignTarget || !assignForm.resourceKey) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: assignTarget.email,
          resourceKey: assignForm.resourceKey,
          ...(assignForm.policyArns.length > 0 ? { policyArns: assignForm.policyArns } : {}),
          ...(assignForm.sessionName.trim() ? { sessionName: assignForm.sessionName.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign resource");
      onSuccess(data.message || `Resource assigned to ${assignTarget.email}`);
      closeAssign();
      fetchAll();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Manage helpers ────────────────────────────────────────────────────────
  const openManage = (user: any) => {
    // Pre-populate editingPolicies from existing awsPolicies
    const init: Record<string, string[]> = {};
    (user.awsPolicies || []).forEach((ap: any) => {
      init[ap.awsResource?.resourceKey] = [...ap.policyArns];
    });
    setEditingPolicies(init);
    setManageTarget(user);
  };
  const closeManage = () => { setManageTarget(null); setEditingPolicies({}); };

  const handleRemoveResource = async (userEmail: string, resourceKey: string) => {
    setManaging(resourceKey);
    try {
      const res = await fetch("/api/admin/users/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, resourceKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove resource");
      onSuccess(data.message || "Access revoked");
      // Refresh user list and then update manageTarget from the fresh data
      await fetchAll();
      // Fetch the user fresh to get updated resourceAccess and awsPolicies
      const freshUsersRes = await fetch("/api/admin/users");
      if (freshUsersRes.ok) {
        const freshUsers = await freshUsersRes.json();
        const updated = freshUsers.find((u: any) => u.email === userEmail);
        if (updated) {
          setManageTarget(updated);
          const init: Record<string, string[]> = {};
          (updated.awsPolicies || []).forEach((ap: any) => {
            init[ap.awsResource?.resourceKey] = [...ap.policyArns];
          });
          setEditingPolicies(init);
        } else {
          setManageTarget(null);
        }
      }
    } catch (err: any) {
      onError(err.message);
    } finally {
      setManaging(null);
    }
  };

  const handleUpdatePolicies = async (userEmail: string, resourceKey: string, policyArns: string[]) => {
    setManaging(resourceKey);
    try {
      const res = await fetch("/api/admin/users/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, resourceKey, policyArns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update policies");
      onSuccess(data.message || "Policies updated");
      fetchAll();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setManaging(null);
    }
  };

  const roleColor = (role: string) => {
    if (role === "super_admin") return "error";
    if (role === "admin") return "warning";
    return "default";
  };

  const filteredUsers = users.filter((u) => {
    const term = searchQuery.toLowerCase();
    return u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
  });
  
  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleAddUserSuccess = (msg: string) => {
    onSuccess(msg);
    setIsAddUserOpen(false);
    fetchAll();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <TextField
          variant="outlined"
          size="small"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search size={16} color={theme.palette.text.secondary} style={{ marginRight: 8 }} />
          }}
          sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
        <Button 
          variant="contained" 
          startIcon={<Plus size={16} />} 
          onClick={() => setIsAddUserOpen(true)}
          sx={{ borderRadius: 3, fontWeight: 700 }}
        >
          Add New User
        </Button>
      </Box>
      {loading ? (
        <Stack alignItems="center" py={8}>
          <CircularProgress size={32} />
          <Typography variant="caption" sx={{ mt: 2, color: "text.secondary" }}>Loading users…</Typography>
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ bgcolor: "transparent", border: `1px solid ${theme.palette.divider}`, borderRadius: 4, overflow: "hidden" }}>
          <Table>
            <TableHead sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6) }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.7rem", letterSpacing: "0.08em" }}>USER</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.7rem", letterSpacing: "0.08em" }}>ROLE</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.7rem", letterSpacing: "0.08em" }}>ORGANIZATIONS</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.7rem", letterSpacing: "0.08em" }}>RESOURCES</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.7rem", letterSpacing: "0.08em" }}>AWS POLICIES</TableCell>
                <TableCell sx={{ fontWeight: 800, color: "text.secondary", fontSize: "0.7rem", letterSpacing: "0.08em" }} align="right">ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>No users found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id} sx={{ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                    <TableCell sx={{ py: 2 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{user.name}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{user.email}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Chip label={user.role} size="small" color={roleColor(user.role) as any} variant="outlined"
                        sx={{ fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase" }} />
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" flexWrap="wrap" gap={0.5}>
                        {user.organizations?.length > 0 ? (
                          user.organizations.map((o: any) => (
                            <Chip key={o.id} icon={<Building2 size={10} />} label={`${o.organization?.name || "—"} · ${o.role || "member"}`} size="small"
                              sx={{ fontSize: "0.65rem", fontWeight: 600, bgcolor: alpha(theme.palette.primary.main, o.role === "owner" ? 0.16 : o.role === "admin" ? 0.12 : 0.08), color: o.role === "owner" ? "error.light" : o.role === "admin" ? "warning.light" : "primary.light" }} />
                          ))
                        ) : <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>None</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Stack direction="row" flexWrap="wrap" gap={0.5} maxWidth={200}>
                        {user.resourceAccess?.length > 0 ? (
                          user.resourceAccess.map((ra: any) => {
                            const rName = ra.resource?.name || ra.awsResource?.name;
                            const rKey = ra.resource?.resourceKey || ra.awsResource?.resourceKey;
                            return (
                              <Chip key={ra.id} label={rName || rKey} size="small"
                                sx={{ fontFamily: rName ? 'inherit' : 'monospace', fontSize: '0.6rem', fontWeight: 700, bgcolor: alpha(theme.palette.success.main, 0.08), color: 'success.light' }} />
                            );
                          })
                        ) : <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>None</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      {user.awsPolicies?.length > 0 ? (
                        <Stack spacing={0.5}>
                          {user.awsPolicies.map((ap: any) => (
                            <Box key={ap.id}>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "warning.main", fontSize: "0.65rem" }}>{ap.awsResource?.name}</Typography>
                              <Stack direction="row" flexWrap="wrap" gap={0.5} mt={0.5}>
                                {ap.policyArns.map((arn: string) => (
                                  <Tooltip key={arn} title={arn} placement="top">
                                    <Chip label={arn.split("/").pop()} size="small"
                                      sx={{ fontFamily: "monospace", fontSize: "0.55rem", maxWidth: 140, bgcolor: alpha(theme.palette.warning.main, 0.08), color: "warning.light" }} />
                                  </Tooltip>
                                ))}
                              </Stack>
                            </Box>
                          ))}
                        </Stack>
                      ) : <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic" }}>None</Typography>}
                    </TableCell>
                    <TableCell sx={{ py: 2 }} align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title="Assign Resource">
                          <IconButton size="small" onClick={() => openAssign(user)}
                            sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.2) } }}>
                            <UserPlus size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Manage Access">
                          <IconButton size="small" onClick={() => openManage(user)}
                            sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: "warning.main", "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.2) } }}>
                            <Settings2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && (
        <TablePagination
          component="div"
          count={filteredUsers.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          sx={{ borderTop: 'none', color: 'text.secondary', '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: '0.75rem', fontWeight: 600 } }}
        />
      )}

      {/* ── Add User Dialog ── */}
      <Dialog open={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 5, bgcolor: theme.palette.background.paper, backgroundImage: "none", border: `1px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <UserPlus size={20} color={theme.palette.success.main} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'success.main' }}>Provision Active Identity</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={() => setIsAddUserOpen(false)}><X size={16} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <CreateUserForm onSuccess={handleAddUserSuccess} onError={onError} />
        </DialogContent>
      </Dialog>

      {/* ── Assign Resource Dialog ── */}
      <Dialog open={!!assignTarget} onClose={closeAssign} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 5, bgcolor: theme.palette.background.paper, backgroundImage: "none", border: `1px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <UserPlus size={20} color={theme.palette.primary.main} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Assign Resource</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{assignTarget?.email}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={closeAssign}><X size={16} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="caption" sx={{ mb: 1, display: "block", fontWeight: 800, color: "text.secondary", letterSpacing: "0.08em" }}>SELECT RESOURCE</Typography>
              <FormControl fullWidth variant="outlined">
                <Select displayEmpty value={assignForm.resourceKey}
                  onChange={(e) => setAssignForm({ resourceKey: e.target.value, policyArns: [], sessionName: "" })}>
                  <MenuItem value="" disabled><em>Choose a resource…</em></MenuItem>
                  {allResources.length > 0 && <MenuItem disabled sx={{ fontSize: "0.65rem", fontWeight: 800, color: "text.secondary" }}>— WEB RESOURCES —</MenuItem>}
                  {allResources.map((r: any) => (
                    <MenuItem key={r.resourceKey} value={r.resourceKey}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Globe size={14} />
                        <ListItemText primary={r.name} secondary={r.resourceKey}
                          primaryTypographyProps={{ variant: "body2", fontWeight: 700 }}
                          secondaryTypographyProps={{ variant: "caption", fontFamily: "monospace" }} />
                      </Stack>
                    </MenuItem>
                  ))}
                  {awsResources.length > 0 && <MenuItem disabled sx={{ fontSize: "0.65rem", fontWeight: 800, color: "text.secondary" }}>— AWS RESOURCES —</MenuItem>}
                  {awsResources.map((r: any) => (
                    <MenuItem key={r.resourceKey} value={r.resourceKey}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Server size={14} />
                        <ListItemText primary={r.name} secondary={`${r.resourceKey} · ${r.awsAccountId}`}
                          primaryTypographyProps={{ variant: "body2", fontWeight: 700 }}
                          secondaryTypographyProps={{ variant: "caption", fontFamily: "monospace" }} />
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            {assignTarget?.resourceAccess?.some((ra: any) => (ra.resource?.resourceKey || ra.awsResource?.resourceKey) === assignForm.resourceKey) && (
              <Alert severity="info" variant="outlined" sx={{ borderRadius: 3 }}>
                User already has access. You can still update policies below.
              </Alert>
            )}
            {matchedAwsResource && availablePolicies.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ mb: 1, display: "block", fontWeight: 800, color: "text.secondary", letterSpacing: "0.08em" }}>
                  SESSION POLICIES
                  <Typography component="span" variant="caption" sx={{ fontWeight: 400, ml: 1, color: "text.secondary" }}>(scope this user's AWS session)</Typography>
                </Typography>
                <PolicyChecklist availablePolicies={availablePolicies} selected={assignForm.policyArns}
                  onChange={(next) => setAssignForm((p) => ({ ...p, policyArns: next }))} />
                {assignForm.policyArns.length > 0 && (
                  <Stack direction="row" flexWrap="wrap" gap={0.5} mt={1.5}>
                    {assignForm.policyArns.map((arn) => (
                      <Chip key={arn} label={arn.split("/").pop()} size="small" color="warning" variant="outlined"
                        onDelete={() => setAssignForm((p) => ({ ...p, policyArns: p.policyArns.filter((a) => a !== arn) }))}
                        sx={{ fontFamily: "monospace", fontSize: "0.65rem", fontWeight: 700 }} />
                    ))}
                  </Stack>
                )}
              </Box>
            )}
            {matchedAwsResource && (
              <Box>
                <Typography variant="caption" sx={{ mb: 1, display: "block", fontWeight: 800, color: "text.secondary", letterSpacing: "0.08em" }}>
                  SESSION NAME
                  <Typography component="span" variant="caption" sx={{ fontWeight: 400, ml: 1, color: "text.secondary" }}>(custom CloudTrail identity, optional)</Typography>
                </Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  size="small"
                  placeholder={assignTarget?.email?.split("@")[0] || "session-name"}
                  value={assignForm.sessionName}
                  onChange={(e) => setAssignForm((p) => ({ ...p, sessionName: e.target.value }))}
                  sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                  helperText="Max 64 chars. Allowed: a-zA-Z0-9+=,.@_-"
                />
              </Box>
            )}
            {matchedAwsResource && availablePolicies.length === 0 && (
              <Alert severity="warning" variant="outlined" sx={{ borderRadius: 3 }}>
                This AWS resource has no available policies configured. Edit the resource to add policy ARNs.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={closeAssign} variant="outlined" sx={{ borderRadius: 3, fontWeight: 700 }}>Cancel</Button>
          <Button onClick={handleAssign} variant="contained" disabled={saving || !assignForm.resourceKey}
            startIcon={saving ? <CircularProgress size={16} /> : <UserPlus size={16} />}
            sx={{ borderRadius: 3, fontWeight: 800 }}>
            {saving ? "Assigning…" : "Assign Resource"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Manage Access Dialog ── */}
      <Dialog open={!!manageTarget} onClose={closeManage} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 5, bgcolor: theme.palette.background.paper, backgroundImage: "none", border: `1px solid ${theme.palette.divider}` } }}>
        <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Settings2 size={20} color={theme.palette.warning.main} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Manage Access</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace" }}>{manageTarget?.email}</Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={closeManage}><X size={16} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {manageTarget?.resourceAccess?.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary", fontStyle: "italic", py: 4, textAlign: "center" }}>
              No resources assigned yet.
            </Typography>
          ) : (
            <Stack spacing={2} mt={1}>
              {(manageTarget?.resourceAccess || []).map((ra: any) => {
                const rk = ra.resource?.resourceKey || ra.awsResource?.resourceKey;
                const rName = ra.resource?.name || ra.awsResource?.name;
                const awsRes = awsResources.find((r: any) => r.resourceKey === rk);
                const existingPolicies: string[] = editingPolicies[rk] ?? [];
                const availForThis: string[] = awsRes?.availablePolicyArns || [];
                const isActing = managing === rk;

                return (
                  <Paper key={ra.id} variant="outlined" sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                      <Box flex={1} minWidth={0}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                          {awsRes ? <Server size={14} color={theme.palette.warning.main} /> : <Globe size={14} color={theme.palette.primary.main} />}
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{rName || rk}</Typography>
                          <Chip label={awsRes ? "AWS" : "Web"} size="small" color={awsRes ? "warning" : "primary"} variant="outlined"
                            sx={{ fontSize: "0.55rem", fontWeight: 800, height: 18 }} />
                        </Stack>
                        <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary" }}>{rk}</Typography>

                        {/* Policy editor for AWS resources */}
                        {awsRes && availForThis.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: "0.08em", display: "block", mb: 1 }}>
                              SESSION POLICIES
                            </Typography>
                            <PolicyChecklist availablePolicies={availForThis} selected={existingPolicies}
                              onChange={(next) => setEditingPolicies((p) => ({ ...p, [rk]: next }))} />
                            {existingPolicies.length > 0 && (
                              <Stack direction="row" flexWrap="wrap" gap={0.5} mt={1}>
                                {existingPolicies.map((arn) => (
                                  <Chip key={arn} label={arn.split("/").pop()} size="small" color="warning" variant="outlined"
                                    onDelete={() => setEditingPolicies((p) => ({ ...p, [rk]: p[rk].filter((a) => a !== arn) }))}
                                    sx={{ fontFamily: "monospace", fontSize: "0.6rem", fontWeight: 700 }} />
                                ))}
                              </Stack>
                            )}
                            <Button size="small" variant="contained" color="warning" disabled={isActing}
                              startIcon={isActing ? <CircularProgress size={12} /> : <ShieldCheck size={13} />}
                              onClick={() => handleUpdatePolicies(manageTarget.email, rk, existingPolicies)}
                              sx={{ mt: 1.5, fontWeight: 800, borderRadius: 2, fontSize: "0.7rem" }}>
                              {isActing ? "Saving…" : "Save Policies"}
                            </Button>
                          </Box>
                        )}
                        {awsRes && availForThis.length === 0 && (
                          <Typography variant="caption" sx={{ color: "text.secondary", fontStyle: "italic", display: "block", mt: 1 }}>
                            No policies configured for this resource.
                          </Typography>
                        )}
                      </Box>

                      {/* Remove button */}
                      <Tooltip title="Revoke Access">
                        <IconButton size="small" disabled={isActing}
                          onClick={() => handleRemoveResource(manageTarget.email, rk)}
                          sx={{ bgcolor: alpha(theme.palette.error.main, 0.08), color: "error.main", "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.18) }, flexShrink: 0 }}>
                          {isActing ? <CircularProgress size={14} color="error" /> : <Trash2 size={14} />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={closeManage} variant="outlined" sx={{ borderRadius: 3, fontWeight: 700 }}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Audit Logs Panel ─────────────────────────────────────────────────────────

function AuditLogsPanel() {
  const theme = useTheme();
  const { user } = useApp();

  // Filters
  const [filterUser, setFilterUser]     = useState("");
  const [filterOrg, setFilterOrg]       = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [filterResource, setFilterResource] = useState("");
  const [filterFrom, setFilterFrom]     = useState("");
  const [filterTo, setFilterTo]         = useState("");

  // Data
  const [logs, setLogs]       = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Pagination
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  // Organizations list for filter dropdown (super_admin only)
  const [organizations, setOrganizations] = useState<any[]>([]);

  useEffect(() => {
    if (user?.role === "super_admin") {
      fetch("/api/admin/organizations").then(r => r.json()).then(setOrganizations).catch(() => {});
    }
  }, [user]);

  const fetchLogs = async (resetPage = false) => {
    setLoading(true);
    setError(null);
    const currentPage = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    const params = new URLSearchParams();
    if (filterUser)     params.set("userId",         filterUser);
    if (filterOrg)      params.set("organizationId", filterOrg);
    if (filterAction)   params.set("action",         filterAction);
    if (filterOutcome)  params.set("outcome",        filterOutcome);
    if (filterResource) params.set("resourceKey",    filterResource);
    if (filterFrom)     params.set("dateFrom",       new Date(filterFrom).toISOString());
    if (filterTo)       params.set("dateTo",         new Date(filterTo).toISOString());
    params.set("limit",  String(PAGE_SIZE));
    params.set("offset", String(currentPage * PAGE_SIZE));

    try {
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load audit logs");
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when page changes
  useEffect(() => { fetchLogs(); }, [page]);

  const outcomeColor = (outcome: string) => {
    if (outcome === "success") return "success";
    if (outcome === "failure") return "error";
    return "info";
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const ALL_ACTIONS = [
    "user_login", "user_logout", "app_open_attempt", "access_granted", "access_denied",
    "broker_session_created", "broker_session_ended", "vault_credential_fetched",
    "upstream_login_success", "upstream_login_failed", "one_time_token_issued",
    "one_time_token_failed", "redirect_url_issued",
    "aws_launch_attempt", "aws_secrets_loaded", "aws_secrets_failed",
    "aws_sts_success", "aws_sts_failed", "aws_signin_token_obtained",
    "aws_signin_token_failed", "aws_console_redirect_issued", "aws_entitlement_denied",
  ];

  return (
    <Box>
      {/* ── Filters ── */}
      <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 4, bgcolor: alpha(theme.palette.background.default, 0.6), border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="caption" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>
          <Filter size={14} /> FILTERS
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>USER ID</Typography>
            <TextField
              fullWidth size="small" variant="outlined"
              placeholder="Paste user ID…"
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Grid>

          {user?.role === "super_admin" && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>ORGANIZATION</Typography>
              <FormControl fullWidth size="small">
                <Select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} displayEmpty>
                  <MenuItem value=""><em>All organizations</em></MenuItem>
                  {organizations.map((org: any) => (
                    <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>ACTION</Typography>
            <FormControl fullWidth size="small">
              <Select value={filterAction} onChange={e => setFilterAction(e.target.value)} displayEmpty>
                <MenuItem value=""><em>All actions</em></MenuItem>
                {ALL_ACTIONS.map(a => <MenuItem key={a} value={a} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>OUTCOME</Typography>
            <FormControl fullWidth size="small">
              <Select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value)} displayEmpty>
                <MenuItem value=""><em>All outcomes</em></MenuItem>
                <MenuItem value="success">✅ Success</MenuItem>
                <MenuItem value="failure">❌ Failure</MenuItem>
                <MenuItem value="info">ℹ️ Info</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>RESOURCE KEY</Typography>
            <TextField
              fullWidth size="small" variant="outlined"
              placeholder="e.g. aws-prod-ro"
              value={filterResource}
              onChange={e => setFilterResource(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>FROM</Typography>
            <TextField
              fullWidth size="small" type="datetime-local"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', fontWeight: 700, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em' }}>TO</Typography>
            <TextField
              fullWidth size="small" type="datetime-local"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            <Button
              fullWidth variant="contained" size="medium"
              onClick={() => fetchLogs(true)}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={14} /> : <Filter size={14} />}
              sx={{ height: 40, fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.05em' }}
            >
              APPLY
            </Button>
            <Button
              variant="outlined" size="medium"
              onClick={() => {
                setFilterUser(""); setFilterOrg(""); setFilterAction("");
                setFilterOutcome(""); setFilterResource(""); setFilterFrom(""); setFilterTo("");
                setTimeout(() => fetchLogs(true), 0);
              }}
              sx={{ height: 40, fontWeight: 800, fontSize: '0.7rem', minWidth: 80 }}
            >
              CLEAR
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Summary bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {total} event{total !== 1 ? "s" : ""} found
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={16} />
          </IconButton>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Page {page + 1} / {Math.max(totalPages, 1)}
          </Typography>
          <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={16} />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>
      )}

      {/* ── Table ── */}
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.8) }}>
              {["TIMESTAMP", "ACTION", "USER", "RESOURCE", "OUTCOME", "IP", "DETAILS"].map(h => (
                <TableCell key={h} sx={{ fontWeight: 800, color: 'text.secondary', fontSize: '0.65rem', letterSpacing: '0.08em', py: 1.5, whiteSpace: 'nowrap' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!loading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary', fontStyle: 'italic' }}>
                  No audit events found. Apply filters and click APPLY.
                </TableCell>
              </TableRow>
            )}
            {!loading && logs.map((log: any) => (
              <>
                <TableRow
                  key={log.id}
                  hover
                  onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                  sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}
                >
                  <TableCell sx={{ fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                    <Chip
                      label={log.action}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.6rem', fontWeight: 800, height: 20, letterSpacing: '0.03em', border: 'none',
                        bgcolor: log.action.startsWith('aws_') ? alpha(theme.palette.warning.main, 0.08) : alpha(theme.palette.primary.main, 0.06),
                        color: log.action.startsWith('aws_') ? theme.palette.warning.main : theme.palette.primary.main,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.7rem' }}>
                    {log.user ? (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>{log.user.name || log.user.email}</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>{log.user.email}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: log.resourceKey ? 'text.primary' : 'text.disabled' }}>
                    {log.resourceKey || "—"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.outcome}
                      size="small"
                      color={outcomeColor(log.outcome) as any}
                      variant="filled"
                      sx={{ fontSize: '0.6rem', fontWeight: 800, height: 20 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.65rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                    {log.ipAddress || "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.65rem', color: log.details ? 'primary.main' : 'text.disabled' }}>
                    {log.details ? "▶ expand" : "—"}
                  </TableCell>
                </TableRow>
                {expandedRow === log.id && log.details && (
                  <TableRow key={`${log.id}-detail`}>
                    <TableCell colSpan={7} sx={{ p: 0, borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <Box sx={{ bgcolor: alpha(theme.palette.background.default, 0.9), p: 3, m: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1, fontSize: '0.65rem', letterSpacing: '0.08em' }}>DETAILS</Typography>
                        <Box
                          component="pre"
                          sx={{
                            m: 0, p: 2, borderRadius: 2, overflow: 'auto', maxHeight: 200,
                            bgcolor: '#0d0d0f', color: '#a5d6a7',
                            fontSize: '0.72rem', fontFamily: 'monospace', lineHeight: 1.6,
                            border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                          }}
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3 }}>
          <Button size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)} startIcon={<ChevronLeft size={14} />} sx={{ fontWeight: 700 }}>Prev</Button>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>Page {page + 1} of {totalPages}</Typography>
          <Button size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} endIcon={<ChevronRight size={14} />} sx={{ fontWeight: 700 }}>Next</Button>
        </Box>
      )}
    </Box>
  );
}

export default function AdminPanel() {

  const [appTypeToggle, setAppTypeToggle] = useState<"web" | "aws">("web");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const theme = useTheme();
  const { user } = useApp();
  const isGlobalAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [activeTab, setActiveTab] = useState(0);

  const [editingWebResource, setEditingWebResource] = useState<any>(null);
  const [editingAwsResource, setEditingAwsResource] = useState<any>(null);

  const handleSuccess = (msg: string) => {
    setMessage({ type: "success", text: msg });
    setTimeout(() => setMessage(null), 5000);
    setEditingWebResource(null);
    setEditingAwsResource(null);
  };

  const handleError = (text: string) => {
    setMessage({ text, type: "error" });
    setTimeout(() => setMessage(null), 5000);
  };

  const hasOrgRole = (Object.values((user?.orgRoles || {}) as Record<string, string>)).some((r) => r === "admin" || r === "owner");
  if (!isGlobalAdmin && !hasOrgRole) {
    return (
      <Container maxWidth="sm" sx={{ mt: 10 }}>
        <Paper elevation={1} sx={{ p: 6, textAlign: 'center', borderRadius: 6, bgcolor: alpha(theme.palette.error.main, 0.05), border: `1px solid ${alpha(theme.palette.error.main, 0.1)}` }}>
          <AlertCircle size={48} color={theme.palette.error.main} style={{ margin: '0 auto 24px' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>Access Forbidden</Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>Administrative credentials are required to modify cluster state.</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ maxWidth: '1200px', mx: 'auto', py: 2 }}>
      <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'flex-end' }, justifyContent: 'space-between', gap: 4, borderBottom: `1px solid ${theme.palette.divider}`, pb: 4 }}>
        <Box>
          <Typography variant="h2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Database size={32} color={theme.palette.primary.main} /> Console Control
          </Typography>
          <Typography variant="subtitle1" sx={{ mt: 1 }}>Provision connectivity endpoints and manage access controls.</Typography>
        </Box>
        
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' },
            '& .MuiTab-root': { fontWeight: 800, fontSize: '0.7rem', letterSpacing: '0.05em', px: 2, minWidth: 'auto' }
          }}
        >
          <Tab icon={<Rocket size={18} />} iconPosition="start" label="PROVISION" value={0} />
          <Tab icon={<Combine size={18} />} iconPosition="start" label="RESOURCES" value={1} />
          <Tab icon={<Users size={18} />} iconPosition="start" label="IDENTITIES" value={2} />
          {isGlobalAdmin && <Tab icon={<ClipboardList size={18} />} iconPosition="start" label="AUDIT LOGS" value={3} />}
          <Tab icon={<Building2 size={18} />} iconPosition="start" label="ORGANIZATIONS" value={4} />
          <Tab icon={<KeyRound size={18} />} iconPosition="start" label="CREDENTIAL VAULT" value={5} />
        </Tabs>
      </Box>

      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          >
            <Alert 
              severity={message.type} 
              variant="outlined"
              icon={message.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
              sx={{ borderRadius: 4, fontWeight: 700, bgcolor: alpha(message.type === 'success' ? theme.palette.success.main : theme.palette.error.main, 0.05) }}
            >
              {message.text}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <Paper 
        elevation={1} 
        sx={{ 
          p: { xs: 4, md: 6 }, 
          borderRadius: 8, 
          position: 'relative', 
          overflow: 'hidden',
          backgroundColor: alpha(theme.palette.background.paper, 0.4),
          backdropFilter: 'blur(20px)',
        }}
      >
        <Box sx={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        {activeTab === 0 && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 6, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1.5, letterSpacing: '0.1em' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                NEW HANDSHAKE TOPOLOGY
              </Typography>

              <Tabs 
                value={appTypeToggle} 
                onChange={(_, v) => setAppTypeToggle(v)}
                sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 1, borderRadius: 2 } }}
              >
                <Tab value="web" label="PROXY SERVICE" sx={{ fontWeight: 800, fontSize: '0.7rem' }} />
                <Tab value="aws" label="AWS CONSOLE" sx={{ fontWeight: 800, fontSize: '0.7rem' }} />
              </Tabs>
            </Box>

            {appTypeToggle === "web" ? (
              <AppForm onSuccess={handleSuccess} onError={handleError} />
            ) : (
              <AwsResourceForm onSuccess={handleSuccess} onError={handleError} />
            )}
          </motion.div>
        )}

        {activeTab === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {editingWebResource ? (
              <Box>
                <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'primary.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                  <Eye size={18} /> Modify Proxy Topology
                </Typography>
                <AppForm
                  initialData={editingWebResource}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  onCancelEdit={() => setEditingWebResource(null)}
                />
              </Box>
            ) : editingAwsResource ? (
              <Box>
                <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'warning.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                  <Eye size={18} /> Modify AWS Infrastructure
                </Typography>
                <AwsResourceForm
                  initialData={editingAwsResource}
                  onSuccess={handleSuccess}
                  onError={handleError}
                  onCancelEdit={() => setEditingAwsResource(null)}
                />
              </Box>
            ) : (
              <AdminResourcesList
                onEditWeb={(res) => setEditingWebResource(res)}
                onEditAws={(res) => setEditingAwsResource(res)}
              />
            )}
          </motion.div>
        )}

        {activeTab === 2 && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <Stack spacing={8}>
              {/* ── All Users Table ── */}
              <Box>
                <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'primary.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                  <Users size={16} /> All Users
                </Typography>
                <UsersPanel onSuccess={handleSuccess} onError={handleError} />
              </Box>
            </Stack>
          </motion.div>
        )}

        {activeTab === 3 && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <Box>
              <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'primary.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                <ClipboardList size={16} /> Security Audit Trail
              </Typography>
              <AuditLogsPanel />
            </Box>
          </motion.div>
        )}

        {activeTab === 4 && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <OrganizationsPanel onSuccess={handleSuccess} onError={handleError} />
          </motion.div>
        )}

        {activeTab === 5 && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
            <Box>
              <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'primary.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                <KeyRound size={16} /> Credential Vault
              </Typography>
              <CredentialVaultPanel onSuccess={handleSuccess} onError={handleError} />
            </Box>
          </motion.div>
        )}
      </Paper>

      <Grid container spacing={3} sx={{ mt: 5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 4, borderRadius: 5, bgcolor: alpha(theme.palette.background.paper, 0.4), transition: 'border-color 0.3s', '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.2) } }}>
            <Typography variant="caption" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>
              <KeyRound size={16} /> CREDENTIAL VAULT
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, lineHeight: 1.6 }}>
              Handshake endpoints rely on matching entries in the secure KeyStore. Ensure downstream service accounts are provisioned before deploying topology updates.
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 4, borderRadius: 5, bgcolor: alpha(theme.palette.background.paper, 0.4), transition: 'border-color 0.3s', '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.2) } }}>
            <Typography variant="caption" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>
              <ShieldCheck size={16} /> CLUSTER WILDCARDS
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 600, lineHeight: 1.6 }}>
              Administrators can attach the wildcard key <code style={{ color: theme.palette.primary.light, background: '#18181b', padding: '2px 6px', borderRadius: 4 }}>*</code> to any identity for immediate full-topology access, bypassing standard ACL constraints.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
