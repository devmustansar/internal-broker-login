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
  InputLabel, 
  Alert, 
  Divider,
  IconButton,
  Chip,
  alpha,
  useTheme,
  Fade,
  InputAdornment,
  CircularProgress
} from "@mui/material";
import { useApp } from "@/lib/app-context";
import AdminResourcesList from "@/components/AdminResourcesList";
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
  Fingerprint
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AdminActionProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

function AppForm({ onSuccess, onError, initialData, onCancelEdit }: AdminActionProps & { initialData?: any; onCancelEdit?: () => void }) {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const [formData, setFormData] = useState({
    resourceKey: initialData?.resourceKey || "",
    name: initialData?.name || "",
    appHost: initialData?.appHost || "",
    apiHost: initialData?.apiHost || "",
    loginUrl: initialData?.loginUrl || "",
    loginAdapter: initialData?.loginAdapter || "json_login",
    tokenExtractionPath: initialData?.tokenExtractionPath || "",
    tokenValidationPath: initialData?.tokenValidationPath || "",
    usernameField: initialData?.usernameField || "",
    passwordField: initialData?.passwordField || "",
    environment: initialData?.environment || "production",
    description: initialData?.description || "",
    managedUsername: "",
    managedPassword: "",
  });

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
          usernameField: "",
          passwordField: "",
          environment: "production",
          description: "",
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
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>TOKEN EXTRACTION PATH</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. info.token"
            value={formData.tokenExtractionPath}
            onChange={(e) => setFormData({ ...formData, tokenExtractionPath: e.target.value })}
            disabled={formData.loginAdapter !== "json_login"}
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
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>

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
  const theme = useTheme();
  const [formData, setFormData] = useState({
    resourceKey: initialData?.resourceKey || "",
    name: initialData?.name || "",
    awsAccountId: initialData?.awsAccountId || "",
    roleArn: initialData?.roleArn || "",
    region: initialData?.region || "us-east-1",
    destination: initialData?.destination || "https://console.aws.amazon.com/",
    issuer: initialData?.issuer || "internal-broker",
    sessionDurationSeconds: initialData?.sessionDurationSeconds || 3600,
    externalId: initialData?.externalId || "",
    brokerCredentialRef: initialData?.brokerCredentialRef || "aws/broker/default",
    stsStrategy: initialData?.stsStrategy || "assume_role",
    environment: initialData?.environment || "production",
    description: initialData?.description || "",
    accessKeyId: "",
    secretAccessKey: "",
  });

  useEffect(() => {
    const fetchCredentials = async () => {
      const secretRef = formData.brokerCredentialRef || initialData?.brokerCredentialRef;
      if (!secretRef || !initialData) return;
      
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
      const res = await fetch("/api/admin/aws/resources", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: initialData.id, ...formData } : formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? "update" : "create"} AWS resource`);
      
      // Save vaulted credentials if provided
      if (formData.accessKeyId || formData.secretAccessKey) {
        await fetch("/api/admin/secrets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secretRef: formData.brokerCredentialRef,
            kind: "aws_iam_credentials",
            payload: {
              accessKeyId: formData.accessKeyId,
              secretAccessKey: formData.secretAccessKey,
            },
            metadata: {
              resourceKey: formData.resourceKey,
              label: `${formData.name} IAM Broker`
            }
          }),
        });
      }

      onSuccess(`AWS Resource "${data.name}" ${isEdit ? "updated" : "created"} successfully!`);
      
      if (!isEdit) {
        setFormData({
          resourceKey: "",
          name: "",
          awsAccountId: "",
          roleArn: "",
          region: "us-east-1",
          destination: "https://console.aws.amazon.com/",
          issuer: "internal-broker",
          sessionDurationSeconds: 3600,
          externalId: "",
          brokerCredentialRef: "aws/broker/default",
          stsStrategy: "assume_role",
          environment: "production",
          description: "",
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
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>RESOURCE KEY</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. aws-prod-ro"
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            required
            InputProps={{ 
              sx: { fontFamily: 'monospace', '&.Mui-focused fieldset': { borderColor: theme.palette.warning.main } } 
            }}
          />
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
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>VAULT CREDENTIAL REF</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="aws/broker/default"
            value={formData.brokerCredentialRef}
            onChange={(e) => setFormData({ ...formData, brokerCredentialRef: e.target.value })}
            required
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
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    role: "user",
    allowedResourceKeys: [] as string[],
  });
  const [resourceInput, setResourceInput] = useState("");

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
        allowedResourceKeys: [],
      });
      setResourceInput("");
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addResource = () => {
    if (resourceInput && !formData.allowedResourceKeys.includes(resourceInput)) {
      setFormData({
        ...formData,
        allowedResourceKeys: [...formData.allowedResourceKeys, resourceInput],
      });
      setResourceInput("");
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
              <MenuItem value="admin">Cluster Administrator</MenuItem>
              <MenuItem value="readonly">Read-Only Auditor</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid size={12}>
          <Typography variant="caption" sx={{ mb: 2, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>SCOPED PERMISSIONS</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3, p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.background.paper, 0.4), border: `1px solid ${theme.palette.divider}` }}>
            {formData.allowedResourceKeys.map((key) => (
              <Chip 
                key={key} 
                label={key} 
                onDelete={() => setFormData({ ...formData, allowedResourceKeys: formData.allowedResourceKeys.filter((k) => k !== key) })}
                sx={{ borderRadius: 2, fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.light' }}
              />
            ))}
            {formData.allowedResourceKeys.length === 0 && (
              <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>No endpoints assigned to this identity yet.</Typography>
            )}
          </Box>
          <Stack direction="row" spacing={2}>
            <TextField
              variant="outlined"
              placeholder="Enter resource key (e.g. jenkins-ci or *)"
              value={resourceInput}
              onChange={(e) => setResourceInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addResource())}
              sx={{ flexGrow: 1, '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            />
            <Button variant="outlined" onClick={addResource} sx={{ px: 3, borderRadius: 3 }}>Assign Key</Button>
          </Stack>
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

function AssignAppForm({ onSuccess, onError }: AdminActionProps) {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const [formData, setFormData] = useState({
    email: "",
    resourceKey: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to assign app");
      onSuccess(data.message || `Assigned key "${formData.resourceKey}" to "${data.email}" successfully.`);
      setFormData({ email: "", resourceKey: "" });
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
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>TARGET IDENTITY</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="developer@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.1em' }}>POLICY ATTACHMENT KEY</Typography>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="e.g. jenkins-ci or *"
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            required
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
          />
        </Grid>
        <Grid size={12}>
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ py: 2, fontWeight: 800 }}
          >
            Deploy Global Policy Update
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState(0);
  const [appTypeToggle, setAppTypeToggle] = useState<"web" | "aws">("web");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const theme = useTheme();

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

  const { user } = useApp();
  if (user?.role !== "admin") {
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
    <Box sx={{ maxWidth: '1000px', mx: 'auto', py: 2 }}>
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
          sx={{ 
            '& .MuiTabs-indicator': { height: 4, borderRadius: '4px 4px 0 0' },
            '& .MuiTab-root': { fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.05em', px: 3 }
          }}
        >
          <Tab icon={<Rocket size={18} />} iconPosition="start" label="PROVISION" />
          <Tab icon={<Combine size={18} />} iconPosition="start" label="RESOURCES" />
          <Tab icon={<Users size={18} />} iconPosition="start" label="IDENTITIES" />
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
                <Tab value="aws" label="AWS FEDERATION" sx={{ fontWeight: 800, fontSize: '0.7rem' }} />
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
              <Box>
                <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'success.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                  Provision Active Identity
                </Typography>
                <CreateUserForm onSuccess={handleSuccess} onError={handleError} />
              </Box>
              
              <Box>
                <Typography variant="caption" sx={{ mb: 6, pb: 2, display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, color: 'violet.main', borderBottom: `1px solid ${theme.palette.divider}`, textTransform: 'uppercase' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'violet.main' }} />
                  Modify Access Policy
                </Typography>
                <AssignAppForm onSuccess={handleSuccess} onError={handleError} />
              </Box>
            </Stack>
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
