"use client";
import { useState, useEffect } from "react";
import { Users, UserPlus, Shield, Trash2, KeyRound, Edit, X } from "lucide-react";
import Header from "@/components/layout/Header";

type User = {
  id: string;
  email?: string;
  role: string;
  display_name: string | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({ email: "", password: "", displayName: "", role: "response_team" });
  const [formLoading, setFormLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load or unauthorized");
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Creation failed");
      }
      setShowCreate(false);
      setFormData({ email: "", password: "", displayName: "", role: "response_team" });
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEdit) return;
    setFormLoading(true);
    try {
      const payload: any = { id: showEdit.id, displayName: formData.displayName, role: formData.role };
      if (formData.password) payload.password = formData.password;

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Update failed");
      }
      setShowEdit(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (error) {
    return (
      <div style={{ padding: "100px 24px", textAlign: "center" }}>
        <h2 style={{ color: "var(--color-risk-critical)" }}>Access Denied</h2>
        <p style={{ color: "var(--color-muted)" }}>You must be a superadmin to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-canvas)", paddingBottom: "2rem" }}>
      <Header />
      
      <main style={{ maxWidth: "1000px", margin: "0 auto", paddingTop: "100px", paddingLeft: "24px", paddingRight: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Shield size={24} color="var(--color-primary)" />
              Superadmin Dashboard
            </h1>
            <p style={{ color: "var(--color-muted)", marginTop: "0.25rem" }}>Manage response team members</p>
          </div>
          
          <button 
            className="btn btn-primary"
            onClick={() => {
              setFormData({ email: "", password: "", displayName: "", role: "response_team" });
              setShowCreate(true);
            }}
          >
            <UserPlus size={16} />
            Add User
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>Loading users...</div>
        ) : (
          <div className="card-elevated" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-hairline)", background: "rgba(255,255,255,0.02)" }}>
                  <th style={{ padding: "1rem", textAlign: "left", color: "var(--color-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>User</th>
                  <th style={{ padding: "1rem", textAlign: "left", color: "var(--color-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Role</th>
                  <th style={{ padding: "1rem", textAlign: "right", color: "var(--color-muted)", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--color-hairline)" }}>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ fontWeight: 600 }}>{u.display_name || "Unnamed"}</div>
                      <div style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>{u.email || u.id}</div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <span style={{ 
                        background: u.role === "superadmin" ? "rgba(168,85,247,0.1)" : "rgba(59,130,246,0.1)",
                        color: u.role === "superadmin" ? "#a855f7" : "#3b82f6",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "var(--rounded-full)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase"
                      }}>
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <button 
                        style={{ background: "none", border: "none", color: "var(--color-on-dark)", cursor: "pointer", padding: "0.5rem" }}
                        onClick={() => {
                          setFormData({ email: u.email || "", password: "", displayName: u.display_name || "", role: u.role });
                          setShowEdit(u);
                        }}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        style={{ background: "none", border: "none", color: "var(--color-risk-critical)", cursor: "pointer", padding: "0.5rem" }}
                        onClick={() => handleDelete(u.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* CREATE MODAL */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card-elevated" style={{ width: "100%", maxWidth: "400px", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Add User</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input required type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input required type="password" minLength={6} className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input required type="text" className="form-input" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="response_team">Response Team</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <button disabled={formLoading} type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
                {formLoading ? "Saving..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEdit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card-elevated" style={{ width: "100%", maxWidth: "400px", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Edit User</h2>
              <button onClick={() => setShowEdit(null)} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer" }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Email (Cannot change)</label>
                <input disabled type="email" className="form-input" value={formData.email} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password (Leave blank to keep)</label>
                <input type="password" minLength={6} className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input required type="text" className="form-input" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="response_team">Response Team</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <button disabled={formLoading} type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
                {formLoading ? "Saving..." : "Update User"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
