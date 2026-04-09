"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  Users,
  Eye,
} from "lucide-react";

// ─── Types aligned to ISchedule / IPersonnel models ───────────────────────────

type ScheduleType =
  | "shift"
  | "patrol"
  | "training"
  | "meeting"
  | "court"
  | "investigation"
  | "other";

type ScheduleStatus = "scheduled" | "in-progress" | "completed" | "cancelled";
type Priority = "low" | "medium" | "high" | "urgent";
type RecurrenceType = "none" | "daily" | "weekly" | "monthly";

interface PopulatedPersonnel {
  _id: string;
  firstName: string;
  lastName: string;
  badgeNumber?: string;
  rank?: string;
}

interface PopulatedCase {
  _id: string;
  caseNumber: string;
  title: string;
  status: string;
}

interface PopulatedVehicle {
  _id: string;
  vehicleNumber: string;
  licensePlate: string;
  make: string;
  model: string;
}

interface Recurrence {
  type: RecurrenceType;
  interval: number;
  endDate?: string;
}

interface Schedule {
  _id: string;
  title: string;
  description?: string;
  type: ScheduleType;
  startDate: string;
  endDate: string;
  location: string;
  assignedPersonnel?: PopulatedPersonnel[];
  createdBy?: PopulatedPersonnel;
  status: ScheduleStatus;
  priority: Priority;
  relatedCase?: PopulatedCase;
  vehicleAssigned?: PopulatedVehicle;
  recurrence?: Recurrence;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Leaner types for the dropdown lists
interface PersonnelOption {
  _id: string;
  firstName: string;
  lastName: string;
  badgeNumber?: string;
  rank?: string;
}

interface CaseOption {
  _id: string;
  caseNumber: string;
  title: string;
}

interface VehicleOption {
  _id: string;
  licensePlate: string;
  make: string;
  model: string;
}

// ─── Form state type ───────────────────────────────────────────────────────────

interface ScheduleFormData {
  title: string;
  description: string;
  type: ScheduleType | "";
  startDate: string;
  endDate: string;
  assignedPersonnel: string[]; // array of _id strings
  location: string;
  priority: Priority;
  relatedCase: string; // _id or "none"
  vehicleAssigned: string; // _id or "none"
  recurrence: Recurrence;
  notes: string;
}

// ─── API payload sent to POST / PUT ───────────────────────────────────────────

interface SchedulePayload {
  title: string;
  description: string;
  type: ScheduleType | "";
  startDate: string;
  endDate: string;
  assignedPersonnel: string[];
  location: string;
  priority: Priority;
  relatedCase?: string;
  vehicleAssigned?: string;
  recurrence: Recurrence;
  notes: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SCHEDULE_TYPES: ScheduleType[] = [
  "shift",
  "patrol",
  "training",
  "meeting",
  "court",
  "investigation",
  "other",
];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUSES: ScheduleStatus[] = [
  "scheduled",
  "in-progress",
  "completed",
  "cancelled",
];
const RECURRENCE_TYPES: RecurrenceType[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
];

const EMPTY_FORM: ScheduleFormData = {
  title: "",
  description: "",
  type: "",
  startDate: "",
  endDate: "",
  assignedPersonnel: [],
  location: "",
  priority: "medium",
  relatedCase: "none",
  vehicleAssigned: "none",
  recurrence: { type: "none", interval: 1 },
  notes: "",
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("token");
}

function authHeaders(extra: Record<string, string> = {}): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ""}`, ...extra };
}

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

function toDatetimeLocal(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

// Converts "none" sentinel back to undefined so the API ignores the field
function buildPayload(form: ScheduleFormData): SchedulePayload {
  return {
    title: form.title,
    description: form.description,
    type: form.type,
    startDate: form.startDate,
    endDate: form.endDate,
    assignedPersonnel: form.assignedPersonnel,
    location: form.location,
    priority: form.priority,
    relatedCase: form.relatedCase !== "none" ? form.relatedCase : undefined,
    vehicleAssigned:
      form.vehicleAssigned !== "none" ? form.vehicleAssigned : undefined,
    recurrence: form.recurrence,
    notes: form.notes,
  };
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function PersonnelMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: PersonnelOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
      {options.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">
          No personnel available
        </p>
      )}
      {options.map((p) => (
        <label
          key={p._id}
          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(p._id)}
            onChange={() => toggle(p._id)}
            className="accent-blue-600"
          />
          <span>
            {p.firstName} {p.lastName}
          </span>
          {p.badgeNumber && (
            <span className="text-gray-400 text-xs">#{p.badgeNumber}</span>
          )}
          {p.rank && (
            <Badge variant="outline" className="text-xs ml-auto">
              {p.rank}
            </Badge>
          )}
        </label>
      ))}
    </div>
  );
}

// Shared form body used in both Create and Edit dialogs
function ScheduleForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEdit,
  personnelOptions,
  caseOptions,
  vehicleOptions,
}: {
  formData: ScheduleFormData;
  setFormData: React.Dispatch<React.SetStateAction<ScheduleFormData>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  isEdit: boolean;
  personnelOptions: PersonnelOption[];
  caseOptions: CaseOption[];
  vehicleOptions: VehicleOption[];
}) {
  function field<K extends keyof ScheduleFormData>(
    key: K,
    value: ScheduleFormData[K],
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Title + Type */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => field("title", e.target.value)}
            placeholder="Schedule title"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(v) => field("type", v as ScheduleType)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => field("description", e.target.value)}
          placeholder="Optional details..."
          rows={3}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="startDate">Start Date & Time *</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={formData.startDate}
            onChange={(e) => field("startDate", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endDate">End Date & Time *</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={formData.endDate}
            onChange={(e) => field("endDate", e.target.value)}
            required
          />
        </div>
      </div>

      {/* Location + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="location">Location *</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => field("location", e.target.value)}
            placeholder="e.g. Sector 4 HQ"
            required
          />
        </div>
        <div className="space-y-1">
          <Label>Priority</Label>
          <Select
            value={formData.priority}
            onValueChange={(v) => field("priority", v as Priority)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assigned Personnel */}
      <div className="space-y-1">
        <Label className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> Assigned Personnel
        </Label>
        <PersonnelMultiSelect
          options={personnelOptions}
          selected={formData.assignedPersonnel}
          onChange={(ids) => field("assignedPersonnel", ids)}
        />
        {formData.assignedPersonnel.length > 0 && (
          <p className="text-xs text-gray-500">
            {formData.assignedPersonnel.length} personnel selected
          </p>
        )}
      </div>

      {/* Related Case + Vehicle */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Related Case</Label>
          <Select
            value={formData.relatedCase}
            onValueChange={(v) => field("relatedCase", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No case</SelectItem>
              {caseOptions.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.caseNumber} – {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Assigned Vehicle</Label>
          <Select
            value={formData.vehicleAssigned}
            onValueChange={(v) => field("vehicleAssigned", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No vehicle</SelectItem>
              {vehicleOptions.map((v) => (
                <SelectItem key={v._id} value={v._id}>
                  {v.licensePlate} – {v.make} {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recurrence */}
      <div className="space-y-2 border rounded-md p-3 bg-gray-50">
        <Label className="text-sm font-medium">Recurrence</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Repeat</Label>
            <Select
              value={formData.recurrence.type}
              onValueChange={(v) =>
                field("recurrence", {
                  ...formData.recurrence,
                  type: v as RecurrenceType,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_TYPES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {formData.recurrence.type !== "none" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">
                  Every N intervals
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.recurrence.interval}
                  onChange={(e) =>
                    field("recurrence", {
                      ...formData.recurrence,
                      interval: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-gray-500">
                  Recurrence End Date (optional)
                </Label>
                <Input
                  type="date"
                  value={formData.recurrence.endDate ?? ""}
                  onChange={(e) =>
                    field("recurrence", {
                      ...formData.recurrence,
                      endDate: e.target.value,
                    })
                  }
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => field("notes", e.target.value)}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isEdit ? "Update Schedule" : "Create Schedule"}
        </Button>
      </div>
    </form>
  );
}

// View Schedule Component
function ViewSchedule({ schedule }: { schedule: Schedule }) {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="border-b pb-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-semibold">{schedule.title}</h3>
          <div className="flex gap-2">
            <Badge className={`${STATUS_COLORS[schedule.status]} capitalize`}>
              {schedule.status}
            </Badge>
            <Badge
              className={`${PRIORITY_COLORS[schedule.priority]} capitalize`}
            >
              {schedule.priority}
            </Badge>
          </div>
        </div>
        {schedule.description && (
          <p className="text-gray-600 mt-2">{schedule.description}</p>
        )}
      </div>

      {/* Time and Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                Start Date & Time
              </p>
              <p className="text-gray-600">
                {new Date(schedule.startDate).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                End Date & Time
              </p>
              <p className="text-gray-600">
                {new Date(schedule.endDate).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-700">Location</p>
              <p className="text-gray-600">{schedule.location}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="capitalize">
              Type: {schedule.type}
            </Badge>
          </div>
        </div>
      </div>

      {/* Assigned Personnel */}
      {schedule.assignedPersonnel && schedule.assignedPersonnel.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Assigned Personnel ({schedule.assignedPersonnel.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {schedule.assignedPersonnel.map((person) => (
              <div
                key={person._id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div>
                  <p className="text-sm font-medium">
                    {person.firstName} {person.lastName}
                  </p>
                  {person.badgeNumber && (
                    <p className="text-xs text-gray-500">
                      Badge: #{person.badgeNumber}
                    </p>
                  )}
                </div>
                {person.rank && (
                  <Badge variant="outline" className="text-xs">
                    {person.rank}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedule.relatedCase && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Related Case
            </h4>
            <div className="p-3 bg-gray-50 rounded">
              <p className="font-medium">{schedule.relatedCase.caseNumber}</p>
              <p className="text-sm text-gray-600">
                {schedule.relatedCase.title}
              </p>
              <Badge variant="outline" className="mt-1 text-xs">
                {schedule.relatedCase.status}
              </Badge>
            </div>
          </div>
        )}

        {schedule.vehicleAssigned && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Assigned Vehicle
            </h4>
            <div className="p-3 bg-gray-50 rounded">
              <p className="font-medium">
                {schedule.vehicleAssigned.licensePlate}
              </p>
              <p className="text-sm text-gray-600">
                {schedule.vehicleAssigned.make} {schedule.vehicleAssigned.model}
              </p>
              <p className="text-xs text-gray-500">
                #{schedule.vehicleAssigned.vehicleNumber}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recurrence Information */}
      {schedule.recurrence && schedule.recurrence.type !== "none" && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Recurrence</h4>
          <div className="p-3 bg-gray-50 rounded">
            <p className="capitalize">
              {schedule.recurrence.type} - Every {schedule.recurrence.interval}{" "}
              interval(s)
            </p>
            {schedule.recurrence.endDate && (
              <p className="text-sm text-gray-600 mt-1">
                Ends on:{" "}
                {new Date(schedule.recurrence.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {schedule.notes && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-gray-600 whitespace-pre-wrap">
              {schedule.notes}
            </p>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="border-t pt-4 text-xs text-gray-400">
        <p>Created: {new Date(schedule.createdAt).toLocaleString()}</p>
        <p>Last Updated: {new Date(schedule.updatedAt).toLocaleString()}</p>
        {schedule.createdBy && (
          <p>
            Created by: {schedule.createdBy.firstName}{" "}
            {schedule.createdBy.lastName}
            {schedule.createdBy.badgeNumber &&
              ` (${schedule.createdBy.badgeNumber})`}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────────

const SchedulePage = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [personnelOptions, setPersonnelOptions] = useState<PersonnelOption[]>(
    [],
  );
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(
    null,
  );
  const [formData, setFormData] = useState<ScheduleFormData>(EMPTY_FORM);

  // ── Data fetchers ─────────────────────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const res = await fetch(`/api/schedule?${params}`, {
        headers: authHeaders(),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to fetch schedules");
      }

      const data = (await res.json()) as {
        schedules: Schedule[];
        pagination: { pages: number; total: number };
      };

      setSchedules(data.schedules);
      setTotalPages(data.pagination.pages);
      setTotalCount(data.pagination.total);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch schedules",
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, typeFilter, statusFilter]);

  const fetchDropdownData = useCallback(async () => {
    const headers = authHeaders();

    const [personnelRes, casesRes, vehiclesRes] = await Promise.allSettled([
      fetch("/api/personnel?limit=100", { headers }),
      fetch("/api/cases?limit=100", { headers }),
      fetch("/api/vehicles?limit=100", { headers }),
    ]);

    if (personnelRes.status === "fulfilled" && personnelRes.value.ok) {
      const d = (await personnelRes.value.json()) as {
        personnel: PersonnelOption[];
      };
      setPersonnelOptions(d.personnel ?? []);
    }
    if (casesRes.status === "fulfilled" && casesRes.value.ok) {
      const d = (await casesRes.value.json()) as { cases: CaseOption[] };
      setCaseOptions(d.cases ?? []);
    }
    if (vehiclesRes.status === "fulfilled" && vehiclesRes.value.ok) {
      const d = (await vehiclesRes.value.json()) as {
        vehicles: VehicleOption[];
      };
      setVehicleOptions(d.vehicles ?? []);
    }
  }, []);

  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type) {
      toast.error("Please select a schedule type");
      return;
    }

    setSubmitting(true);
    try {
      const url = selectedSchedule
        ? `/api/schedule/${selectedSchedule._id}`
        : "/api/schedule";
      const method = selectedSchedule ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildPayload(formData)),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Operation failed");
      }

      toast.success(
        `Schedule ${selectedSchedule ? "updated" : "created"} successfully`,
      );
      setIsCreateOpen(false);
      setIsEditOpen(false);
      resetForm();
      await fetchSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      const res = await fetch(`/api/schedule/${scheduleId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to delete schedule");
      }

      toast.success("Schedule deleted successfully");
      // If we just deleted the last item on this page, go back one page
      if (schedules.length === 1 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      } else {
        await fetchSchedules();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete schedule",
      );
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setSelectedSchedule(null);
  };

  const openViewModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setIsViewOpen(true);
  };

  const openEditModal = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      title: schedule.title,
      description: schedule.description ?? "",
      type: schedule.type,
      startDate: schedule.startDate ? toDatetimeLocal(schedule.startDate) : "",
      endDate: schedule.endDate ? toDatetimeLocal(schedule.endDate) : "",
      // Backend populates these; extract just the _id for the form
      assignedPersonnel: schedule.assignedPersonnel?.map((p) => p._id) ?? [],
      location: schedule.location,
      priority: schedule.priority,
      relatedCase: schedule.relatedCase?._id ?? "none",
      vehicleAssigned: schedule.vehicleAssigned?._id ?? "none",
      recurrence: schedule.recurrence ?? { type: "none", interval: 1 },
      notes: schedule.notes ?? "",
    });
    setIsEditOpen(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const sharedFormProps = {
    formData,
    setFormData,
    onSubmit: handleSubmit,
    personnelOptions,
    caseOptions,
    vehicleOptions,
  };

  return (
    <div className="space-y-6 pt-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Schedule Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} schedule{totalCount !== 1 ? "s" : ""} total
          </p>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Schedule</DialogTitle>
            </DialogHeader>
            <ScheduleForm
              {...sharedFormProps}
              onCancel={() => setIsCreateOpen(false)}
              isEdit={false}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by title, location, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SCHEDULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Schedules{" "}
            <span className="text-base font-normal text-gray-500">
              ({schedules.length} on this page)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center text-gray-500 py-16">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No schedules found</p>
              <p className="text-sm">
                Try adjusting your filters or create one.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">
                      Title
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Type
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Start
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      End
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Location
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Personnel
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Priority
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Status
                    </th>
                    <th className="text-left p-3 font-medium text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr
                      key={schedule._id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-3">
                        <p className="font-medium text-gray-900">
                          {schedule.title}
                        </p>
                        {schedule.description && (
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">
                            {schedule.description}
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="capitalize">
                          {schedule.type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>
                            {new Date(schedule.startDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400 mt-0.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs">
                            {new Date(schedule.startDate).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>
                            {new Date(schedule.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400 mt-0.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs">
                            {new Date(schedule.endDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {schedule.location}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {schedule.assignedPersonnel &&
                        schedule.assignedPersonnel.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="text-gray-700">
                              {schedule.assignedPersonnel.length}
                            </span>
                            <span className="text-gray-400 text-xs hidden sm:inline">
                              assigned
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">None</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`${PRIORITY_COLORS[schedule.priority]} capitalize border-0`}
                        >
                          {schedule.priority}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          className={`${STATUS_COLORS[schedule.status]} capitalize border-0`}
                        >
                          {schedule.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openViewModal(schedule)}
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(schedule)}
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(schedule._id)}
                            title="Delete"
                            className="text-red-500 hover:text-red-700 hover:border-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      <Dialog
        open={isViewOpen}
        onOpenChange={(open) => {
          setIsViewOpen(open);
          if (!open) setSelectedSchedule(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Details</DialogTitle>
          </DialogHeader>
          {selectedSchedule && <ViewSchedule schedule={selectedSchedule} />}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>
          <ScheduleForm
            {...sharedFormProps}
            onCancel={() => setIsEditOpen(false)}
            isEdit
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchedulePage;
