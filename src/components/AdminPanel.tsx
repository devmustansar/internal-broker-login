"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useApp } from "@/lib/app-context";

interface AdminActionProps {
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
}

function CreateAppForm({ onSuccess, onError }: AdminActionProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create app");
      onSuccess(`App "${data.name}" created successfully!`);
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
      });
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Resource Key</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            placeholder="e.g. jenkins-ci"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">App Name</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Jenkins Master"
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-widest text-slate-500">App Host URL</label>
        <input
          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
          value={formData.appHost}
          onChange={(e) => setFormData({ ...formData, appHost: e.target.value })}
          placeholder="https://jenkins.company.com"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Login URL</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.loginUrl}
            onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
            placeholder="https://jenkins.company.com/login"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Login Adapter</label>
          <select
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.loginAdapter}
            onChange={(e) => setFormData({ ...formData, loginAdapter: e.target.value })}
          >
            <option value="json_login">JSON API</option>
            <option value="form_login_basic">Basic Form</option>
            <option value="form_login_csrf">Form + CSRF</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Username Payload Key (Optional)</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.usernameField}
            onChange={(e) => setFormData({ ...formData, usernameField: e.target.value })}
            placeholder="e.g. email or username"
          />
          <p className="text-xs text-slate-500 mt-1">Leave blank to default to "username".</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Password Payload Key (Optional)</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.passwordField}
            onChange={(e) => setFormData({ ...formData, passwordField: e.target.value })}
            placeholder="e.g. pass or password"
          />
          <p className="text-xs text-slate-500 mt-1">Leave blank to default to "password".</p>
        </div>
      </div>
      
      {formData.loginAdapter === "json_login" && (
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Token Extraction Path (Optional)</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.tokenExtractionPath}
            onChange={(e) => setFormData({ ...formData, tokenExtractionPath: e.target.value })}
            placeholder="e.g. info.token or data.accessToken"
          />
          <p className="text-xs text-slate-500 mt-1">JSON path to the one-time token in the client backend response.</p>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-widest text-slate-500">Token Validation Path (Optional)</label>
        <input
          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
          value={formData.tokenValidationPath}
          onChange={(e) => setFormData({ ...formData, tokenValidationPath: e.target.value })}
          placeholder="e.g. /auth/validate (defaults to /auth/validate)"
        />
        <p className="text-xs text-slate-500 mt-1">Client app path where users are redirected with <code>?token=&#60;one-time-token&#62;</code>.</p>
      </div>
      <div className="pt-2">
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Create Application"}
        </Button>
      </div>
    </form>
  );
}

function CreateUserForm({ onSuccess, onError }: AdminActionProps) {
  const [loading, setLoading] = useState(false);
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Email</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="developer@company.com"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Full Name</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Doe"
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-widest text-slate-500">Initial Password</label>
        <input
          type="password"
          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Required for local login"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-widest text-slate-500">Role</label>
        <select
          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        >
          <option value="user">Developer (User)</option>
          <option value="admin">Administrator</option>
          <option value="readonly">Readonly Auditor</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-widest text-slate-500 block">Allowed Apps (Keys)</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {formData.allowedResourceKeys.map((key) => (
            <Badge key={key} variant="info">
              {key}{" "}
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    allowedResourceKeys: formData.allowedResourceKeys.filter((k) => k !== key),
                  })
                }
                className="ml-1 hover:text-white"
              >
                &times;
              </button>
            </Badge>
          ))}
          {formData.allowedResourceKeys.length === 0 && (
            <span className="text-xs text-slate-500 italic">No apps assigned yet (dev will see none)</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={resourceInput}
            onChange={(e) => setResourceInput(e.target.value)}
            placeholder="Enter app key (e.g. jenkins-ci or *)"
          />
          <Button type="button" variant="ghost" size="sm" onClick={addResource}>Add App</Button>
        </div>
      </div>
      <div className="pt-2">
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Create User"}
        </Button>
      </div>
    </form>
  );
}

function AssignAppForm({ onSuccess, onError }: AdminActionProps) {
  const [loading, setLoading] = useState(false);
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
      if (res.status === 200 && data.message) {
        onSuccess(data.message);
      } else {
        onSuccess(`Assigned app "${formData.resourceKey}" to "${data.email}" successfully!`);
      }
      setFormData({ email: "", resourceKey: "" });
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">Developer Email</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="developer@company.com"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-widest text-slate-500">App Key</label>
          <input
            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:border-indigo-500 outline-none"
            value={formData.resourceKey}
            onChange={(e) => setFormData({ ...formData, resourceKey: e.target.value })}
            placeholder="e.g. jenkins-ci or *"
            required
          />
        </div>
      </div>
      <div className="pt-2">
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Assigning..." : "Assign App to Developer"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminPanel() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<"apps" | "users">("apps");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  if (user?.role !== "admin") {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-slate-400">You must be an administrator to view this panel.</p>
      </div>
    );
  }

  const handleSuccess = (text: string) => {
    setMessage({ text, type: "success" });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleError = (text: string) => {
    setMessage({ text, type: "error" });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Management</h1>
          <p className="text-slate-400 text-sm">Provision new applications and managing staff access</p>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("apps")}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${
              activeTab === "apps" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Applications
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${
              activeTab === "users" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Users / Devs
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg border flex items-center ${
            message.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div
        className="glass p-8 rounded-2xl"
        style={{ background: "rgba(17,24,39,0.5)", border: "1px solid var(--color-border)" }}
      >
        {activeTab === "apps" ? (
          <div>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <span className="w-2 h-6 bg-indigo-500 rounded-full" />
              Provisions New Application
            </h2>
            <CreateAppForm onSuccess={handleSuccess} onError={handleError} />
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-500 rounded-full" />
                Onboard User / Developer
              </h2>
              <CreateUserForm onSuccess={handleSuccess} onError={handleError} />
            </div>
            
            <div className="pt-8 border-t border-slate-800">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-500 rounded-full" />
                Assign Existing Dev to App
              </h2>
              <AssignAppForm onSuccess={handleSuccess} onError={handleError} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Notice</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Provisioning a new application generates a static resource key and managed account reference. 
            Ensure appropriate Vault paths are created before onboarding developers.
          </p>
        </div>
        <div className="p-4 bg-slate-900/30 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">ACL Rules</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            To allow a user access to all brokered applications, assign the wildcard <code>*</code> to their 
            allowed resource keys list.
          </p>
        </div>
      </div>
    </div>
  );
}
