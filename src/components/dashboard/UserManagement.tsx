"use client";

import { useState, useEffect } from "react";
import { Plus, Shield, User, Trash2, CheckCircle2, XCircle } from "lucide-react";

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("response_team");
  const [password, setPassword] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      
      setFormMessage({ type: 'success', text: "User created successfully!" });
      setShowInvite(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
      fetchUsers();
    } catch (err: any) {
      setFormMessage({ type: 'error', text: err.message });
    } finally {
      setFormLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, role: newRole })
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId })
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>User Management</h2>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowInvite(!showInvite)}
        >
          <Plus size={16} /> New User
        </button>
      </div>

      {formMessage && (
        <div style={{ 
          padding: "1rem", 
          marginBottom: "1rem", 
          borderRadius: "var(--radius-sm)", 
          background: formMessage.type === 'success' ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${formMessage.type === 'success' ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          color: formMessage.type === 'success' ? "var(--color-accent-emerald)" : "var(--color-accent-rose)"
        }}>
          {formMessage.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {formMessage.text}
        </div>
      )}

      {showInvite && (
        <form 
          onSubmit={handleCreateUser} 
          style={{ 
            background: "var(--color-surface-elevated)", 
            padding: "1.5rem", 
            borderRadius: "var(--radius-card)", 
            border: "1px solid var(--color-border)",
            marginBottom: "2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem"
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem" }}>Provision New Account</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input required type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input required type="text" className="form-input" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input required type="text" className="form-input" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                <option value="response_team">Response Team</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={formLoading}>
              {formLoading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-muted)" }}>Loading users...</div>
      ) : error ? (
        <div style={{ color: "var(--color-risk-high)" }}>{error}</div>
      ) : (
        <div style={{ background: "var(--color-surface)", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-text-muted)" }}>
                <th style={{ padding: "1rem" }}>Name & Email</th>
                <th style={{ padding: "1rem" }}>Role</th>
                <th style={{ padding: "1rem" }}>Joined</th>
                <th style={{ padding: "1rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "1rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{u.display_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "1rem" }}>
                    <span className={`badge ${u.role === 'superadmin' ? 'badge-critical' : 'badge-low'}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      {u.role === 'superadmin' ? <Shield size={12} /> : <User size={12} />}
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "1rem", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <select 
                      className="form-input" 
                      style={{ width: "auto", minHeight: "32px", height: "32px", padding: "0 8px", fontSize: "12px" }}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="response_team">Response Team</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ color: "var(--color-accent-rose)", borderColor: "var(--color-hairline)" }}
                      onClick={() => handleDelete(u.id)}
                      title="Delete User"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
