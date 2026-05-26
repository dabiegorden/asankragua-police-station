"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  User,
  Mail,
  Building2,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = "admin" | "nco" | "cid" | "so";

interface SystemUser {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  stationId?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Station {
  id: string;
  name: string;
}

interface StationsApiResponse {
  stations: Station[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  role: UserRole | "";
  stationId: string;
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ["admin", "nco", "cid", "so"];

/** These roles must be assigned to a station */
const STATION_ROLES: UserRole[] = ["nco", "cid", "so"];

const EMPTY_FORM: UserFormData = {
  fullName: "",
  email: "",
  password: "",
  role: "",
  stationId: "",
  isActive: true,
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-red-100 text-red-800 border-red-200",
  nco: "bg-blue-100 text-blue-800 border-blue-200",
  cid: "bg-indigo-100 text-indigo-800 border-indigo-200",
  so: "bg-purple-100 text-purple-800 border-purple-200",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  nco: "NCO / Station Orderly",
  cid: "CID Investigator",
  so: "Station Officer",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

// ─── Station picker sub-component ─────────────────────────────────────────────

interface StationPickerProps {
  value: string;
  onChange: (stationId: string) => void;
  stations: Station[];
  loadingStations: boolean;
  stationsError: string | null;
  onRetryStations: () => void;
  disabled?: boolean;
  required?: boolean;
}

function StationPicker({
  value,
  onChange,
  stations,
  loadingStations,
  stationsError,
  onRetryStations,
  disabled = false,
  required = false,
}: StationPickerProps) {
  if (loadingStations) {
    return (
      <div className="h-10 flex items-center gap-2 px-3 border border-gray-200 rounded-md bg-gray-50 text-sm text-gray-400">
        <Loader2 size={13} className="animate-spin" />
        Loading stations…
      </div>
    );
  }

  if (stationsError) {
    return (
      <div className="h-10 flex items-center justify-between px-3 border border-red-200 rounded-md bg-red-50">
        <span className="text-xs text-red-600 flex items-center gap-1.5">
          <AlertCircle size={12} />
          {stationsError}
        </span>
        <button
          type="button"
          onClick={onRetryStations}
          className="text-xs text-red-700 hover:text-red-900 flex items-center gap-1 font-medium"
        >
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    );
  }

  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger
        className={
          required && !value && !disabled
            ? "border-amber-400 ring-1 ring-amber-300"
            : ""
        }
      >
        <SelectValue placeholder="Select station" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-gray-400 italic">
            {disabled ? "Admin — no station" : "No station assigned"}
          </span>
        </SelectItem>
        {stations.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <div className="flex items-center gap-2">
              <Building2 size={12} className="text-amber-600" />
              {s.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── User Form ────────────────────────────────────────────────────────────────

interface UserFormProps {
  formData: UserFormData;
  onChange: (patch: Partial<UserFormData>) => void;
  stations: Station[];
  loadingStations: boolean;
  stationsError: string | null;
  onRetryStations: () => void;
  isEdit: boolean;
}

function UserForm({
  formData,
  onChange,
  stations,
  loadingStations,
  stationsError,
  onRetryStations,
  isEdit,
}: UserFormProps) {
  const isAdminRole = formData.role === "admin";
  const needsStation =
    formData.role !== "" && STATION_ROLES.includes(formData.role as UserRole);
  const selectedStation = stations.find((s) => s.id === formData.stationId);

  return (
    <div className="space-y-4">
      {/* Full Name */}
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full Name *</Label>
        <Input
          id="fullName"
          value={formData.fullName}
          onChange={(e) => onChange({ fullName: e.target.value })}
          placeholder="e.g. Kwame Mensah"
          required
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="officer@ghanapolice.gov.gh"
          required
        />
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password">
          {isEdit ? "New Password (leave blank to keep current)" : "Password *"}
        </Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => onChange({ password: e.target.value })}
          placeholder={
            isEdit ? "Leave blank to keep current" : "Min 6 characters"
          }
          required={!isEdit}
          minLength={6}
        />
      </div>

      {/* Role + Station */}
      <div className="grid grid-cols-2 gap-4">
        {/* Role */}
        <div className="space-y-1.5">
          <Label>Role *</Label>
          <Select
            value={formData.role}
            onValueChange={(v) =>
              onChange({
                role: v as UserRole,
                stationId: v === "admin" ? "" : formData.stationId,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[r]}`}
                    >
                      {r.toUpperCase()}
                    </span>
                    <span className="text-sm">{ROLE_LABELS[r]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Station */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Building2 size={12} className="text-gray-500" />
            Police Station
            {needsStation && <span className="text-red-500 ml-0.5">*</span>}
          </Label>

          <StationPicker
            value={formData.stationId}
            onChange={(stationId) => onChange({ stationId })}
            stations={stations}
            loadingStations={loadingStations}
            stationsError={stationsError}
            onRetryStations={onRetryStations}
            disabled={isAdminRole || formData.role === ""}
            required={needsStation}
          />

          {needsStation &&
            !formData.stationId &&
            !loadingStations &&
            !stationsError && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                <Building2 size={10} />
                Assign a station to scope this officer's records.
              </p>
            )}
          {formData.stationId && selectedStation && (
            <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
              <CheckCircle size={10} />
              {selectedStation.name}
            </p>
          )}
        </div>
      </div>

      {/* Active toggle (edit only) */}
      {isEdit && (
        <div className="space-y-1.5">
          <Label>Account Status</Label>
          <Select
            value={formData.isActive ? "true" : "false"}
            onValueChange={(v) => onChange({ isActive: v === "true" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">
                <div className="flex items-center gap-2">
                  <CheckCircle size={13} className="text-green-600" /> Active
                </div>
              </SelectItem>
              <SelectItem value="false">
                <div className="flex items-center gap-2">
                  <XCircle size={13} className="text-red-600" /> Inactive
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700 font-medium mb-1 flex items-center gap-1.5">
          <Building2 size={11} /> Why does station matter?
        </p>
        <p className="text-xs text-blue-600 leading-relaxed">
          Each officer's records (cases, arrests, etc.) are tagged to their
          station. Officers at the same station share the same workflow — NCO
          logs a case, CID investigates, SO reviews, DC decides.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function UsersManagementPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [stations, setStations] = useState<Station[]>([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [stationsError, setStationsError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm, setCreateForm] = useState<UserFormData>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<UserFormData>(EMPTY_FORM);

  // ── Fetch stations ────────────────────────────────────────────────────────────

  const fetchStations = useCallback(async () => {
    setLoadingStations(true);
    setStationsError(null);
    try {
      const res = await fetch("/api/stations", { headers: authHeaders() });

      if (res.status === 401 || res.status === 403)
        throw new Error("Not authorised to load stations");
      if (!res.ok) throw new Error(`Station fetch failed (${res.status})`);

      const data: StationsApiResponse = await res.json();
      if (!Array.isArray(data.stations))
        throw new Error("Unexpected response format from /api/stations");

      setStations(data.stations);
    } catch (err: any) {
      setStationsError(err.message ?? "Could not load station list");
      toast.error(err.message ?? "Could not load station list");
    } finally {
      setLoadingStations(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  // ── Fetch users ───────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(search && { search }),
        ...(roleFilter !== "all" && { role: roleFilter }),
        ...(stationFilter !== "all" && { stationId: stationFilter }),
        ...(activeFilter !== "all" && { isActive: activeFilter }),
      });

      const res = await fetch(`/api/users?${params}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch users");

      const data = await res.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, stationFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, stationFilter, activeFilter]);

  // ── Create user ───────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.role) {
      toast.error("Please select a role");
      return;
    }
    if (
      STATION_ROLES.includes(createForm.role as UserRole) &&
      !createForm.stationId
    ) {
      toast.error("Please assign a police station for this role");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          fullName: createForm.fullName,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
          stationId: createForm.stationId || null,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create user");

      toast.success(`${createForm.fullName} has been created successfully`);
      setIsCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Edit user ─────────────────────────────────────────────────────────────────

  function openEditModal(u: SystemUser) {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      email: u.email,
      password: "",
      role: u.role,
      stationId: u.stationId ?? "",
      isActive: u.isActive,
    });
    setIsEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: editForm.fullName,
        email: editForm.email,
        role: editForm.role,
        stationId: editForm.stationId || null,
        isActive: editForm.isActive,
      };
      if (editForm.password) payload.password = editForm.password;

      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update user");

      toast.success(`${editForm.fullName} updated successfully`);
      setIsEditOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────────────

  async function handleDelete(u: SystemUser) {
    if (!confirm(`Delete ${u.fullName}? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/users/${u._id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete user");

      toast.success(`${u.fullName} deleted`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function stationName(id?: string | null): string {
    if (!id) return "—";
    return stations.find((s) => s.id === id)?.name ?? id;
  }

  const sharedFormProps = {
    stations,
    loadingStations,
    stationsError,
    onRetryStations: fetchStations,
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage system accounts for all police stations
          </p>
        </div>

        {stationsError && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} />
            Station data unavailable.
            <button
              onClick={fetchStations}
              className="underline font-medium hover:text-amber-900"
            >
              Retry
            </button>
          </div>
        )}

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) setCreateForm(EMPTY_FORM);
          }}
        >
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus size={15} /> Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-2">
              <UserForm
                formData={createForm}
                onChange={(patch) =>
                  setCreateForm((prev) => ({ ...prev, ...patch }))
                }
                isEdit={false}
                {...sharedFormProps}
              />
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && (
                    <Loader2 size={14} className="animate-spin mr-2" />
                  )}
                  Create User
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stationFilter} onValueChange={setStationFilter}>
              <SelectTrigger className="w-52">
                {loadingStations ? (
                  <span className="flex items-center gap-2 text-gray-400 text-sm">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </span>
                ) : (
                  <SelectValue placeholder="All Stations" />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stations</SelectItem>
                <SelectItem value="none">No Station (Admin)</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <Building2 size={11} className="text-amber-600" />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User size={16} className="text-gray-500" />
            Users ({pagination?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <User size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No users found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left py-2 px-3">Name</th>
                    <th className="text-left py-2 px-3">Email</th>
                    <th className="text-left py-2 px-3">Role</th>
                    <th className="text-left py-2 px-3">Station</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id} className="border-b hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">
                        {u.fullName}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Mail size={11} className="text-gray-400" />
                          {u.email}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${
                            ROLE_COLORS[u.role] ??
                            "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {u.stationId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <Building2 size={10} />
                            {stationName(u.stationId)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <CheckCircle size={10} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            <XCircle size={10} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(u)}
                            className="h-7 px-2.5 text-xs"
                          >
                            <Edit size={12} className="mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(u)}
                            className="h-7 px-2.5 text-xs text-red-600 hover:text-red-700 hover:border-red-300"
                          >
                            <Trash2 size={12} className="mr-1" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Page {pagination.page} of {pagination.totalPages} —{" "}
                {pagination.total} users
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(p + 1, pagination.totalPages))
                  }
                  disabled={page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User — {editingUser?.fullName}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            <UserForm
              formData={editForm}
              onChange={(patch) =>
                setEditForm((prev) => ({ ...prev, ...patch }))
              }
              isEdit
              {...sharedFormProps}
            />
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2 size={14} className="animate-spin mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
