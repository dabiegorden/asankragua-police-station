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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Car,
  Fuel,
  User,
  Loader2,
  Eye,
  Calendar,
  FileText,
  Wrench,
  Droplet,
  ClipboardList,
  Package,
  Clock,
  MapPin,
  RotateCcw,
  Hash,
  Gauge,
  Send,
  Phone,
  Mail,
  Shield,
  Navigation,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// =====================================================================
// TypeScript Interfaces
// =====================================================================

interface UserRef {
  _id: string;
  firstName: string;
  lastName: string;
  badgeNumber?: string;
  email?: string;
}

interface DriverDetails {
  name: string;
  badgeNumber: string;
  phone: string;
  email: string;
  rank: string;
  unit: string;
}

interface DispatchRecord {
  _id?: string;
  dispatchedTo?: UserRef | string | null;
  driverDetails: DriverDetails;
  destination: string;
  operationName: string;
  operationType:
    | "patrol"
    | "escort"
    | "investigation"
    | "emergency"
    | "transport"
    | "training"
    | "other";
  purpose: string;
  dispatchedDate: string;
  expectedReturnDate?: string;
  returnedDate?: string;
  startMileage: number;
  endMileage?: number;
  dispatchedBy?: UserRef | string | null;
  notes: string;
}

interface MaintenanceRecord {
  _id?: string;
  date: string;
  type: "routine" | "repair" | "inspection" | "emergency";
  description: string;
  cost: number;
  performedBy: string;
  mileageAtService: number;
  nextServiceDue?: string;
}

interface FuelRecord {
  _id?: string;
  date: string;
  amount: number;
  cost: number;
  mileage: number;
  filledBy: UserRef | string;
}

interface AssignmentRecord {
  _id?: string;
  assignedTo: UserRef | string;
  assignedDate: string;
  returnedDate?: string;
  purpose: string;
  startMileage: number;
  endMileage?: number;
}

interface ReturnRecord {
  _id?: string;
  returnedDate: string;
  location: string;
  driverName: string;
  duty: string;
  fuelLevelOnReturn: string;
  returnTime: string;
  conditionNotes: string;
  endMileage?: number;
  returnedBy?: UserRef | string;
}

interface Equipment {
  name: string;
  serialNumber: string;
  condition: "excellent" | "good" | "fair" | "poor";
}

interface Vehicle {
  _id: string;
  vehicleNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  type: "patrol-car" | "motorcycle" | "van" | "truck" | "suv" | "other";
  typeOther?: string;
  mileage: number;
  fuelLevel: string;
  status: "available" | "in-use" | "maintenance" | "out-of-service";
  currentDriver?: UserRef | string | null;
  dispatchHistory: DispatchRecord[];
  assignmentHistory: AssignmentRecord[];
  returnHistory: ReturnRecord[];
  maintenanceHistory: MaintenanceRecord[];
  fuelHistory: FuelRecord[];
  equipment: Equipment[];
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VehicleFormData {
  licensePlate: string;
  make: string;
  model: string;
  type: string;
  typeOther: string;
  mileage: number;
  fuelLevel: string;
  status: string;
  equipment: Equipment[];
  notes: string;
}

interface DispatchFormData {
  // linked user
  dispatchedToUserId: string;
  // manual driver fields (all optional)
  driverName: string;
  driverBadgeNumber: string;
  driverPhone: string;
  driverEmail: string;
  driverRank: string;
  driverUnit: string;
  // operation fields (all optional)
  destination: string;
  operationName: string;
  operationType: string;
  purpose: string;
  expectedReturnDate: string;
  notes: string;
}

interface ReturnFormData {
  location: string;
  driverName: string;
  duty: string;
  fuelLevelOnReturn: string;
  returnTime: string;
  conditionNotes: string;
  endMileage: number;
}

// =====================================================================
// Constants
// =====================================================================

const EMPTY_VEHICLE_FORM: VehicleFormData = {
  licensePlate: "",
  make: "",
  model: "",
  type: "",
  typeOther: "",
  mileage: 0,
  fuelLevel: "",
  status: "available",
  equipment: [],
  notes: "",
};

const EMPTY_DISPATCH_FORM: DispatchFormData = {
  dispatchedToUserId: "",
  driverName: "",
  driverBadgeNumber: "",
  driverPhone: "",
  driverEmail: "",
  driverRank: "",
  driverUnit: "",
  destination: "",
  operationName: "",
  operationType: "patrol",
  purpose: "",
  expectedReturnDate: "",
  notes: "",
};

const EMPTY_RETURN_FORM: ReturnFormData = {
  location: "",
  driverName: "",
  duty: "",
  fuelLevelOnReturn: "",
  returnTime: "",
  conditionNotes: "",
  endMileage: 0,
};

const VEHICLE_TYPES = [
  "patrol-car",
  "motorcycle",
  "van",
  "truck",
  "suv",
  "other",
] as const;

const STATUSES = [
  "available",
  "in-use",
  "maintenance",
  "out-of-service",
] as const;

const OPERATION_TYPES = [
  "patrol",
  "escort",
  "investigation",
  "emergency",
  "transport",
  "training",
  "other",
] as const;

type VehicleStatus = (typeof STATUSES)[number];

const STATUS_COLORS: Record<VehicleStatus, string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "in-use": "bg-blue-100 text-blue-800 border-blue-200",
  maintenance: "bg-amber-100 text-amber-800 border-amber-200",
  "out-of-service": "bg-red-100 text-red-800 border-red-200",
};

const MAINTENANCE_TYPE_COLORS: Record<string, string> = {
  routine: "bg-blue-100 text-blue-800",
  repair: "bg-red-100 text-red-800",
  inspection: "bg-yellow-100 text-yellow-800",
  emergency: "bg-purple-100 text-purple-800",
};

const EQUIPMENT_CONDITION_COLORS: Record<string, string> = {
  excellent: "bg-green-100 text-green-800",
  good: "bg-blue-100 text-blue-800",
  fair: "bg-yellow-100 text-yellow-800",
  poor: "bg-red-100 text-red-800",
};

const OPERATION_TYPE_COLORS: Record<string, string> = {
  patrol: "bg-blue-100 text-blue-800",
  escort: "bg-indigo-100 text-indigo-800",
  investigation: "bg-purple-100 text-purple-800",
  emergency: "bg-red-100 text-red-800",
  transport: "bg-cyan-100 text-cyan-800",
  training: "bg-green-100 text-green-800",
  other: "bg-gray-100 text-gray-800",
};

// =====================================================================
// Helpers
// =====================================================================

const fmt = (s: string) =>
  s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const getStatusColor = (s: VehicleStatus) =>
  STATUS_COLORS[s] || "bg-gray-100 text-gray-800";

const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("token") : null;

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "N/A");

const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString() : "N/A");

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

// =====================================================================
// Sub-components
// =====================================================================

// ── Section Header ────────────────────────────────────────────────────
const SectionHeader = ({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
}) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon className="w-4 h-4 text-gray-500" />
    <h3 className="font-semibold text-gray-800">{title}</h3>
    {count !== undefined && (
      <Badge variant="outline" className="ml-auto text-xs">
        {count}
      </Badge>
    )}
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────
const EmptyState = ({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) => (
  <div className="text-center py-10 text-gray-400">
    <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
    <p className="text-sm">{message}</p>
  </div>
);

// ── Info Row ──────────────────────────────────────────────────────────
const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType;
  label: string;
  value?: string | React.ReactNode;
}) => (
  <div className="space-y-0.5">
    <p className="text-xs text-gray-500 flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </p>
    <p className="text-sm font-medium text-gray-900">{value || "—"}</p>
  </div>
);

// =====================================================================
// Dispatch Modal
// =====================================================================

interface DispatchModalProps {
  vehicle: Vehicle | null;
  personnel: UserRef[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (vehicleId: string, data: DispatchFormData) => Promise<void>;
  submitting: boolean;
}

const DispatchModal = ({
  vehicle,
  personnel,
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: DispatchModalProps) => {
  const [form, setForm] = useState<DispatchFormData>(EMPTY_DISPATCH_FORM);

  useEffect(() => {
    if (open) setForm(EMPTY_DISPATCH_FORM);
  }, [open]);

  if (!vehicle) return null;

  const set = (k: keyof DispatchFormData, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(vehicle._id, form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Send className="w-5 h-5 text-blue-600" />
            Dispatch Vehicle — {vehicle.licensePlate}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-0.5">
            {vehicle.make} {vehicle.model} · {vehicle.vehicleNumber}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* ── Linked User (optional) ── */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              Link to Personnel{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </Label>
            <Select
              value={form.dispatchedToUserId}
              onValueChange={(v) => set("dispatchedToUserId", v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select from personnel list…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {personnel.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.firstName} {p.lastName}
                    {p.badgeNumber ? ` · #${p.badgeNumber}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* ── Driver Details (all optional) ── */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4" /> Driver Details{" "}
              <span className="font-normal text-gray-400">(all optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="d-name" className="text-xs text-gray-500">
                  Full Name
                </Label>
                <Input
                  id="d-name"
                  placeholder="e.g. Sgt. John Mensah"
                  value={form.driverName}
                  onChange={(e) => set("driverName", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label htmlFor="d-badge" className="text-xs text-gray-500">
                  Badge / ID Number
                </Label>
                <Input
                  id="d-badge"
                  placeholder="e.g. GPS-00412"
                  value={form.driverBadgeNumber}
                  onChange={(e) => set("driverBadgeNumber", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label
                  htmlFor="d-phone"
                  className="text-xs text-gray-500 flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" /> Phone Number
                </Label>
                <Input
                  id="d-phone"
                  type="tel"
                  placeholder="+233 XX XXX XXXX"
                  value={form.driverPhone}
                  onChange={(e) => set("driverPhone", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label
                  htmlFor="d-email"
                  className="text-xs text-gray-500 flex items-center gap-1"
                >
                  <Mail className="w-3 h-3" /> Email Address
                </Label>
                <Input
                  id="d-email"
                  type="email"
                  placeholder="officer@police.gov.gh"
                  value={form.driverEmail}
                  onChange={(e) => set("driverEmail", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label
                  htmlFor="d-rank"
                  className="text-xs text-gray-500 flex items-center gap-1"
                >
                  <Shield className="w-3 h-3" /> Rank
                </Label>
                <Input
                  id="d-rank"
                  placeholder="e.g. Inspector, Constable"
                  value={form.driverRank}
                  onChange={(e) => set("driverRank", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label htmlFor="d-unit" className="text-xs text-gray-500">
                  Unit / Division
                </Label>
                <Input
                  id="d-unit"
                  placeholder="e.g. CID, Traffic, K9"
                  value={form.driverUnit}
                  onChange={(e) => set("driverUnit", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Operation / Destination (all optional) ── */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Navigation className="w-4 h-4" /> Operation & Destination{" "}
              <span className="font-normal text-gray-400">(all optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label
                  htmlFor="d-dest"
                  className="text-xs text-gray-500 flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" /> Destination / Location
                </Label>
                <Input
                  id="d-dest"
                  placeholder="e.g. Tema Motorway, Airport Hills"
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label htmlFor="d-opname" className="text-xs text-gray-500">
                  Operation Name
                </Label>
                <Input
                  id="d-opname"
                  placeholder="e.g. Op. Nightwatch"
                  value={form.operationName}
                  onChange={(e) => set("operationName", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label htmlFor="d-optype" className="text-xs text-gray-500">
                  Operation Type
                </Label>
                <Select
                  value={form.operationType}
                  onValueChange={(v) => set("operationType", v)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {fmt(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="d-purpose" className="text-xs text-gray-500">
                  Purpose / Brief
                </Label>
                <Input
                  id="d-purpose"
                  placeholder="Short description of the assignment"
                  value={form.purpose}
                  onChange={(e) => set("purpose", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label
                  htmlFor="d-expret"
                  className="text-xs text-gray-500 flex items-center gap-1"
                >
                  <Calendar className="w-3 h-3" /> Expected Return
                </Label>
                <Input
                  id="d-expret"
                  type="datetime-local"
                  max={new Date().toISOString().slice(0, 16)}
                  value={form.expectedReturnDate}
                  onChange={(e) => set("expectedReturnDate", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
              <div>
                <Label htmlFor="d-notes" className="text-xs text-gray-500">
                  Additional Notes
                </Label>
                <Input
                  id="d-notes"
                  placeholder="Any extra info…"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Dispatch Vehicle
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================================
// Return Modal
// =====================================================================

interface ReturnModalProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (vehicleId: string, data: ReturnFormData) => Promise<void>;
  submitting: boolean;
}

const ReturnModal = ({
  vehicle,
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: ReturnModalProps) => {
  const [form, setForm] = useState<ReturnFormData>(EMPTY_RETURN_FORM);

  useEffect(() => {
    if (open && vehicle) {
      setForm({
        ...EMPTY_RETURN_FORM,
        endMileage: vehicle.mileage,
        returnTime: new Date().toTimeString().slice(0, 5),
      });
    }
  }, [open, vehicle]);

  if (!vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location || !form.driverName || !form.duty) {
      toast.error("Location, driver name and duty are required");
      return;
    }
    await onSubmit(vehicle._id, form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-600" />
            Return Vehicle — {vehicle.licensePlate}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="ret-location">
                Return Location <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  id="ret-location"
                  className="pl-9"
                  placeholder="e.g. Central Station, Depot A"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="col-span-2">
              <Label htmlFor="ret-driver">
                Name of Driver <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  id="ret-driver"
                  className="pl-9"
                  placeholder="Full name of returning driver"
                  value={form.driverName}
                  onChange={(e) =>
                    setForm({ ...form, driverName: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="col-span-2">
              <Label htmlFor="ret-duty">
                Duty / Assignment <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ret-duty"
                placeholder="e.g. Town Patrol, Airport Escort"
                value={form.duty}
                onChange={(e) => setForm({ ...form, duty: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ret-fuel">Fuel Level on Return</Label>
              <Input
                id="ret-fuel"
                placeholder="e.g. Half, Full, Quarter"
                value={form.fuelLevelOnReturn}
                onChange={(e) =>
                  setForm({ ...form, fuelLevelOnReturn: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ret-time">Return Time</Label>
              <Input
                id="ret-time"
                type="time"
                value={form.returnTime}
                onChange={(e) =>
                  setForm({ ...form, returnTime: e.target.value })
                }
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="ret-mileage">End Mileage (km)</Label>
              <Input
                id="ret-mileage"
                type="number"
                min={vehicle.mileage}
                value={form.endMileage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    endMileage: parseInt(e.target.value) || 0,
                  })
                }
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="ret-notes">Condition Notes</Label>
              <Textarea
                id="ret-notes"
                placeholder="Any damage, issues, or observations…"
                value={form.conditionNotes}
                onChange={(e) =>
                  setForm({ ...form, conditionNotes: e.target.value })
                }
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <RotateCcw className="w-4 h-4 mr-2" />
              Confirm Return
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================================
// Details Modal
// =====================================================================

type DetailTab =
  | "details"
  | "dispatch"
  | "maintenance"
  | "fuel"
  | "returns"
  | "equipment";

interface DetailsModalProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const DetailsModal = ({ vehicle, open, onOpenChange }: DetailsModalProps) => {
  const [tab, setTab] = useState<DetailTab>("details");

  useEffect(() => {
    if (open) setTab("details");
  }, [open]);

  if (!vehicle) return null;

  const driver =
    vehicle.currentDriver && typeof vehicle.currentDriver === "object"
      ? (vehicle.currentDriver as UserRef)
      : null;

  const tabs: {
    id: DetailTab;
    label: string;
    icon: React.ElementType;
    count?: number;
  }[] = [
    { id: "details", label: "Details", icon: FileText },
    {
      id: "dispatch",
      label: "Dispatches",
      icon: Send,
      count: vehicle.dispatchHistory?.length,
    },
    {
      id: "maintenance",
      label: "Maintenance",
      icon: Wrench,
      count: vehicle.maintenanceHistory?.length,
    },
    {
      id: "fuel",
      label: "Fuel",
      icon: Droplet,
      count: vehicle.fuelHistory?.length,
    },
    {
      id: "returns",
      label: "Returns",
      icon: RotateCcw,
      count: vehicle.returnHistory?.length,
    },
    {
      id: "equipment",
      label: "Equipment",
      icon: Package,
      count: vehicle.equipment?.length,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Car className="w-6 h-6 text-blue-600" />
            {vehicle.licensePlate} — {vehicle.make} {vehicle.model}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500 font-mono">
              {vehicle.vehicleNumber}
            </span>
            <Badge
              className={`${getStatusColor(vehicle.status as VehicleStatus)} text-xs`}
            >
              {fmt(vehicle.status)}
            </Badge>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b pb-2">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <Button
              key={id}
              variant={tab === id ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(id)}
              className="gap-1.5 h-8 text-xs"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0 text-xs font-semibold ${
                    tab === id
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4 pt-1">
          {/* ── DETAILS ── */}
          {tab === "details" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                <InfoRow
                  icon={Hash}
                  label="Vehicle Number"
                  value={vehicle.vehicleNumber}
                />
                <InfoRow
                  icon={Car}
                  label="License Plate"
                  value={vehicle.licensePlate}
                />
                <InfoRow
                  label="Make / Model"
                  value={`${vehicle.make} ${vehicle.model}`}
                />
                <InfoRow
                  label="Type"
                  value={
                    <Badge variant="outline">
                      {vehicle.type === "other" && vehicle.typeOther
                        ? vehicle.typeOther
                        : fmt(vehicle.type)}
                    </Badge>
                  }
                />
                <InfoRow
                  icon={Gauge}
                  label="Mileage"
                  value={`${vehicle.mileage.toLocaleString()} km`}
                />
                <InfoRow
                  icon={Fuel}
                  label="Fuel Level"
                  value={vehicle.fuelLevel || "N/A"}
                />
                {driver && (
                  <InfoRow
                    icon={User}
                    label="Current Driver"
                    value={`${driver.firstName} ${driver.lastName}`}
                  />
                )}
              </div>
              {vehicle.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                  <SectionHeader icon={FileText} title="Notes" />
                  <p className="text-sm text-gray-700">{vehicle.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── DISPATCH HISTORY ── */}
          {tab === "dispatch" && (
            <div className="space-y-3">
              <SectionHeader
                icon={Send}
                title="Dispatch Records"
                count={vehicle.dispatchHistory?.length}
              />
              {vehicle.dispatchHistory?.length > 0 ? (
                [...vehicle.dispatchHistory].reverse().map((rec, i) => {
                  const dispatchedTo =
                    rec.dispatchedTo && typeof rec.dispatchedTo === "object"
                      ? (rec.dispatchedTo as UserRef)
                      : null;
                  const dispatchedBy =
                    rec.dispatchedBy && typeof rec.dispatchedBy === "object"
                      ? (rec.dispatchedBy as UserRef)
                      : null;

                  return (
                    <Card
                      key={rec._id || i}
                      className="border-l-4 border-l-blue-400"
                    >
                      <CardContent className="pt-4 pb-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                OPERATION_TYPE_COLORS[rec.operationType] ||
                                "bg-gray-100"
                              }
                            >
                              {fmt(rec.operationType)}
                            </Badge>
                            {rec.operationName && (
                              <span className="font-semibold text-sm">
                                {rec.operationName}
                              </span>
                            )}
                          </div>
                          <Badge
                            variant={rec.returnedDate ? "outline" : "default"}
                            className="text-xs"
                          >
                            {rec.returnedDate ? "Returned" : "Active"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {/* Driver details */}
                          {(rec.driverDetails?.name || dispatchedTo) && (
                            <div className="col-span-2 md:col-span-1">
                              <InfoRow
                                icon={User}
                                label="Driver"
                                value={
                                  rec.driverDetails?.name ||
                                  (dispatchedTo
                                    ? `${dispatchedTo.firstName} ${dispatchedTo.lastName}`
                                    : undefined)
                                }
                              />
                            </div>
                          )}
                          {rec.driverDetails?.badgeNumber && (
                            <InfoRow
                              icon={Hash}
                              label="Badge #"
                              value={rec.driverDetails.badgeNumber}
                            />
                          )}
                          {rec.driverDetails?.rank && (
                            <InfoRow
                              icon={Shield}
                              label="Rank"
                              value={rec.driverDetails.rank}
                            />
                          )}
                          {rec.driverDetails?.unit && (
                            <InfoRow
                              label="Unit"
                              value={rec.driverDetails.unit}
                            />
                          )}
                          {rec.driverDetails?.phone && (
                            <InfoRow
                              icon={Phone}
                              label="Phone"
                              value={rec.driverDetails.phone}
                            />
                          )}
                          {rec.driverDetails?.email && (
                            <InfoRow
                              icon={Mail}
                              label="Email"
                              value={rec.driverDetails.email}
                            />
                          )}
                          {rec.destination && (
                            <InfoRow
                              icon={MapPin}
                              label="Destination"
                              value={rec.destination}
                            />
                          )}
                          {rec.purpose && (
                            <InfoRow label="Purpose" value={rec.purpose} />
                          )}
                          <InfoRow
                            icon={Calendar}
                            label="Dispatched"
                            value={fmtDateTime(rec.dispatchedDate)}
                          />
                          {rec.expectedReturnDate && (
                            <InfoRow
                              icon={Clock}
                              label="Expected Return"
                              value={fmtDateTime(rec.expectedReturnDate)}
                            />
                          )}
                          {rec.returnedDate && (
                            <InfoRow
                              icon={RotateCcw}
                              label="Returned"
                              value={fmtDateTime(rec.returnedDate)}
                            />
                          )}
                          <InfoRow
                            icon={Gauge}
                            label="Start Mileage"
                            value={`${rec.startMileage?.toLocaleString()} km`}
                          />
                          {rec.endMileage != null && (
                            <InfoRow
                              icon={Gauge}
                              label="End Mileage"
                              value={`${rec.endMileage.toLocaleString()} km`}
                            />
                          )}
                          {dispatchedBy && (
                            <InfoRow
                              icon={User}
                              label="Dispatched By"
                              value={`${dispatchedBy.firstName} ${dispatchedBy.lastName}`}
                            />
                          )}
                        </div>

                        {rec.notes && (
                          <p className="mt-3 text-xs text-gray-500 italic border-t pt-2">
                            {rec.notes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <EmptyState icon={Send} message="No dispatch records found" />
              )}
            </div>
          )}

          {/* ── MAINTENANCE ── */}
          {tab === "maintenance" && (
            <div className="space-y-3">
              <SectionHeader
                icon={Wrench}
                title="Maintenance History"
                count={vehicle.maintenanceHistory?.length}
              />
              {vehicle.maintenanceHistory?.length > 0 ? (
                [...vehicle.maintenanceHistory].reverse().map((rec, i) => (
                  <Card key={rec._id || i}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={MAINTENANCE_TYPE_COLORS[rec.type]}>
                            {rec.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {fmtDate(rec.date)}
                          </span>
                        </div>
                        <span className="font-semibold text-sm">
                          {fmtCurrency(rec.cost)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-2">
                        {rec.description}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <InfoRow label="Performed By" value={rec.performedBy} />
                        <InfoRow
                          icon={Gauge}
                          label="Mileage at Service"
                          value={`${rec.mileageAtService?.toLocaleString()} km`}
                        />
                        {rec.nextServiceDue && (
                          <InfoRow
                            icon={Calendar}
                            label="Next Service Due"
                            value={fmtDate(rec.nextServiceDue)}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={Wrench}
                  message="No maintenance records found"
                />
              )}
            </div>
          )}

          {/* ── FUEL ── */}
          {tab === "fuel" && (
            <div className="space-y-3">
              <SectionHeader
                icon={Droplet}
                title="Fuel Records"
                count={vehicle.fuelHistory?.length}
              />
              {vehicle.fuelHistory?.length > 0 ? (
                [...vehicle.fuelHistory].reverse().map((rec, i) => {
                  const filledBy =
                    typeof rec.filledBy === "object" ? rec.filledBy : null;
                  return (
                    <Card key={rec._id || i}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-500">
                            {fmtDate(rec.date)}
                          </span>
                          <span className="font-semibold text-sm">
                            {fmtCurrency(rec.cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <InfoRow label="Amount" value={`${rec.amount} L`} />
                          <InfoRow
                            icon={Gauge}
                            label="Mileage"
                            value={`${rec.mileage?.toLocaleString()} km`}
                          />
                          {filledBy && (
                            <InfoRow
                              icon={User}
                              label="Filled By"
                              value={`${filledBy.firstName} ${filledBy.lastName}`}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <EmptyState icon={Droplet} message="No fuel records found" />
              )}
            </div>
          )}

          {/* ── RETURNS ── */}
          {tab === "returns" && (
            <div className="space-y-3">
              <SectionHeader
                icon={RotateCcw}
                title="Return Records"
                count={vehicle.returnHistory?.length}
              />
              {vehicle.returnHistory?.length > 0 ? (
                [...vehicle.returnHistory].reverse().map((rec, i) => (
                  <Card
                    key={rec._id || i}
                    className="border-l-4 border-l-emerald-400"
                  >
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-semibold text-sm">
                          {rec.driverName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {fmtDate(rec.returnedDate)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <InfoRow
                          icon={MapPin}
                          label="Location"
                          value={rec.location}
                        />
                        <InfoRow label="Duty" value={rec.duty} />
                        <InfoRow
                          icon={Fuel}
                          label="Fuel on Return"
                          value={rec.fuelLevelOnReturn || "N/A"}
                        />
                        <InfoRow
                          icon={Clock}
                          label="Return Time"
                          value={rec.returnTime || "N/A"}
                        />
                        {rec.endMileage != null && (
                          <InfoRow
                            icon={Gauge}
                            label="End Mileage"
                            value={`${rec.endMileage.toLocaleString()} km`}
                          />
                        )}
                        {rec.conditionNotes && (
                          <div className="col-span-2 md:col-span-3">
                            <InfoRow
                              label="Condition Notes"
                              value={rec.conditionNotes}
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <EmptyState
                  icon={RotateCcw}
                  message="No return records found"
                />
              )}
            </div>
          )}

          {/* ── EQUIPMENT ── */}
          {tab === "equipment" && (
            <div>
              <SectionHeader
                icon={Package}
                title="Equipment"
                count={vehicle.equipment?.length}
              />
              {vehicle.equipment?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vehicle.equipment.map((item, i) => (
                    <Card key={i}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              SN: {item.serialNumber}
                            </p>
                          </div>
                          <Badge
                            className={
                              EQUIPMENT_CONDITION_COLORS[item.condition]
                            }
                          >
                            {item.condition.toUpperCase()}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Package}
                  message="No equipment records found"
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================================
// Vehicle Form (create / edit)
// =====================================================================

interface VehicleFormProps {
  formData: VehicleFormData;
  setFormData: (d: VehicleFormData) => void;
  isEdit: boolean;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onClose: () => void;
}

const VehicleForm = ({
  formData,
  setFormData,
  isEdit,
  submitting,
  onSubmit,
  onClose,
}: VehicleFormProps) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="licensePlate">
          License Plate <span className="text-red-500">*</span>
        </Label>
        <Input
          id="licensePlate"
          value={formData.licensePlate}
          onChange={(e) =>
            setFormData({ ...formData, licensePlate: e.target.value })
          }
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="type">
          Vehicle Type <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.type}
          onValueChange={(v) => setFormData({ ...formData, type: v })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {fmt(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {formData.type === "other" && (
          <Input
            className="mt-2"
            placeholder="Specify vehicle type"
            value={formData.typeOther}
            onChange={(e) =>
              setFormData({ ...formData, typeOther: e.target.value })
            }
            required
          />
        )}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="make">
          Make <span className="text-red-500">*</span>
        </Label>
        <Input
          id="make"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="model">
          Model <span className="text-red-500">*</span>
        </Label>
        <Input
          id="model"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          required
          className="mt-1"
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="mileage">Mileage (km)</Label>
        <Input
          id="mileage"
          type="number"
          min="0"
          value={formData.mileage}
          onChange={(e) =>
            setFormData({ ...formData, mileage: parseInt(e.target.value) || 0 })
          }
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="fuelLevel">Fuel Level</Label>
        <Input
          id="fuelLevel"
          placeholder="Full, Half, Quarter, Empty"
          value={formData.fuelLevel}
          onChange={(e) =>
            setFormData({ ...formData, fuelLevel: e.target.value })
          }
          className="mt-1"
        />
      </div>
    </div>

    <div>
      <Label htmlFor="status">Status</Label>
      <Select
        value={formData.status}
        onValueChange={(v) => setFormData({ ...formData, status: v })}
      >
        <SelectTrigger className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {fmt(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div>
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        rows={3}
        className="mt-1"
      />
    </div>

    <div className="flex justify-end gap-2 pt-2 border-t">
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {isEdit ? "Update Vehicle" : "Create Vehicle"}
      </Button>
    </div>
  </form>
);

// =====================================================================
// Main Page Component
// =====================================================================

const VehiclesPage = () => {
  // Data
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [personnel, setPersonnel] = useState<UserRef[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Filters / pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);

  // Selected items
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [dispatchingVehicle, setDispatchingVehicle] = useState<Vehicle | null>(
    null,
  );
  const [returningVehicle, setReturningVehicle] = useState<Vehicle | null>(
    null,
  );

  // Form data
  const [vehicleForm, setVehicleForm] =
    useState<VehicleFormData>(EMPTY_VEHICLE_FORM);

  // ── Debounce search ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    fetchVehicles();
  }, [currentPage, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  // ── API helpers ──────────────────────────────────────────────────────
  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  });

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
      });

      const res = await fetch(`/api/vehicles?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.ok) {
        const data = await res.json();
        setVehicles(data.vehicles);
        setTotalPages(data.pagination.pages);
        setTotalCount(data.pagination.total);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to fetch vehicles");
      }
    } catch {
      toast.error("Failed to fetch vehicles");
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, typeFilter]);

  const fetchPersonnel = async () => {
    try {
      const res = await fetch("/api/personnel?limit=200", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPersonnel(data.personnel || []);
      }
    } catch {
      console.error("Failed to fetch personnel");
    }
  };

  // ── CRUD ─────────────────────────────────────────────────────────────
  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vehicleForm.type === "other" && !vehicleForm.typeOther.trim()) {
      toast.error("Please specify the vehicle type");
      return;
    }
    setSubmitting(true);
    try {
      const url = selectedVehicle
        ? `/api/vehicles/${selectedVehicle._id}`
        : "/api/vehicles";
      const method = selectedVehicle ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify({
          ...vehicleForm,
          typeOther:
            vehicleForm.type === "other" ? vehicleForm.typeOther.trim() : "",
          mileage: Number(vehicleForm.mileage),
        }),
      });

      if (res.ok) {
        toast.success(
          `Vehicle ${selectedVehicle ? "updated" : "created"} successfully`,
        );
        setIsCreateOpen(false);
        setIsEditOpen(false);
        resetVehicleForm();
        fetchVehicles();
      } else {
        const err = await res.json();
        toast.error(err.error || "Operation failed");
      }
    } catch {
      toast.error("Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vehicleId: string) => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        toast.success("Vehicle deleted");
        fetchVehicles();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to delete vehicle");
      }
    } catch {
      toast.error("Failed to delete vehicle");
    }
  };

  const handleDispatch = async (vehicleId: string, data: DispatchFormData) => {
    setDispatchSubmitting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ action: "dispatch-vehicle", ...data }),
      });
      if (res.ok) {
        toast.success("Vehicle dispatched successfully");
        setIsDispatchOpen(false);
        setDispatchingVehicle(null);
        fetchVehicles();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to dispatch vehicle");
      }
    } catch {
      toast.error("Failed to dispatch vehicle");
    } finally {
      setDispatchSubmitting(false);
    }
  };

  const handleReturn = async (vehicleId: string, data: ReturnFormData) => {
    setReturnSubmitting(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ action: "return-vehicle", ...data }),
      });
      if (res.ok) {
        toast.success("Vehicle returned successfully");
        setIsReturnOpen(false);
        setReturningVehicle(null);
        fetchVehicles();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to return vehicle");
      }
    } catch {
      toast.error("Failed to return vehicle");
    } finally {
      setReturnSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const resetVehicleForm = () => {
    setVehicleForm(EMPTY_VEHICLE_FORM);
    setSelectedVehicle(null);
  };

  const openEdit = (v: Vehicle) => {
    setSelectedVehicle(v);
    setVehicleForm({
      licensePlate: v.licensePlate,
      make: v.make,
      model: v.model,
      type: v.type,
      typeOther: v.typeOther || "",
      mileage: v.mileage,
      fuelLevel: v.fuelLevel || "",
      status: v.status,
      equipment: v.equipment || [],
      notes: v.notes || "",
    });
    setIsEditOpen(true);
  };

  const openView = (v: Vehicle) => {
    setViewingVehicle(v);
    setIsViewOpen(true);
  };

  const openDispatch = (v: Vehicle) => {
    setDispatchingVehicle(v);
    setIsDispatchOpen(true);
  };

  const openReturn = (v: Vehicle) => {
    setReturningVehicle(v);
    setIsReturnOpen(true);
  };

  // ── Summary stats ─────────────────────────────────────────────────────
  const stats = STATUSES.map((s) => ({
    status: s,
    count: vehicles.filter((v) => v.status === s).length,
  }));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pt-12 px-1">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Vehicle Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} vehicle{totalCount !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Dialog
          open={isCreateOpen}
          onOpenChange={(o) => {
            setIsCreateOpen(o);
            if (!o) resetVehicleForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={resetVehicleForm} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Register New Vehicle</DialogTitle>
            </DialogHeader>
            <VehicleForm
              formData={vehicleForm}
              setFormData={setVehicleForm}
              isEdit={false}
              submitting={submitting}
              onSubmit={handleVehicleSubmit}
              onClose={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(({ status, count }) => (
          <button
            key={status}
            onClick={() =>
              setStatusFilter(statusFilter === status ? "all" : status)
            }
            className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${
              statusFilter === status
                ? "ring-2 ring-offset-1 ring-blue-500"
                : "bg-white"
            }`}
          >
            <p className="text-xs text-gray-500 capitalize mb-1">
              {fmt(status)}
            </p>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <div
              className={`mt-2 h-1.5 rounded-full ${
                status === "available"
                  ? "bg-emerald-400"
                  : status === "in-use"
                    ? "bg-blue-400"
                    : status === "maintenance"
                      ? "bg-amber-400"
                      : "bg-red-400"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-56 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search plate, make, model…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {fmt(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {VEHICLE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {fmt(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading && vehicles.length === 0 ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Fuel</th>
                    <th className="text-left px-4 py-3 font-medium">Mileage</th>
                    <th className="text-left px-4 py-3 font-medium">
                      Current Driver
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vehicles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12 text-gray-400"
                      >
                        <Car className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        No vehicles found
                      </td>
                    </tr>
                  ) : (
                    vehicles.map((v) => {
                      const driver =
                        v.currentDriver && typeof v.currentDriver === "object"
                          ? (v.currentDriver as UserRef)
                          : null;
                      // Last dispatch for driver name fallback
                      const lastDispatch =
                        v.dispatchHistory?.[v.dispatchHistory.length - 1];
                      const dispatchDriverName =
                        lastDispatch?.driverDetails?.name;

                      return (
                        <tr
                          key={v._id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                <Car className="w-4 h-4 text-gray-500" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {v.licensePlate}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {v.make} {v.model} · {v.vehicleNumber}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {v.type === "other" && v.typeOther
                                ? v.typeOther
                                : fmt(v.type)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={`${getStatusColor(v.status as VehicleStatus)} text-xs border`}
                            >
                              {fmt(v.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-gray-600">
                              <Fuel className="w-3.5 h-3.5" />
                              <span className="text-xs">
                                {v.fuelLevel || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {v.mileage.toLocaleString()} km
                          </td>
                          <td className="px-4 py-3">
                            {driver ? (
                              <div className="text-xs">
                                <p className="font-medium text-gray-800">
                                  {driver.firstName} {driver.lastName}
                                </p>
                                {driver.badgeNumber && (
                                  <p className="text-gray-400">
                                    #{driver.badgeNumber}
                                  </p>
                                )}
                              </div>
                            ) : dispatchDriverName ? (
                              <span className="text-xs text-gray-600">
                                {dispatchDriverName}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                title="View details"
                                onClick={() => openView(v)}
                                className="h-7 w-7 p-0"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Edit"
                                onClick={() => openEdit(v)}
                                className="h-7 w-7 p-0"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Dispatch vehicle"
                                onClick={() => openDispatch(v)}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Return vehicle"
                                onClick={() => openReturn(v)}
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Delete"
                                onClick={() => handleDelete(v._id)}
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {currentPage} of {totalPages} · {totalCount} total
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-7 px-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(p + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="h-7 px-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Modal ── */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(o) => {
          setIsEditOpen(o);
          if (!o) resetVehicleForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
          </DialogHeader>
          <VehicleForm
            formData={vehicleForm}
            setFormData={setVehicleForm}
            isEdit
            submitting={submitting}
            onSubmit={handleVehicleSubmit}
            onClose={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── View Details Modal ── */}
      <DetailsModal
        vehicle={viewingVehicle}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />

      {/* ── Dispatch Modal ── */}
      <DispatchModal
        vehicle={dispatchingVehicle}
        personnel={personnel}
        open={isDispatchOpen}
        onOpenChange={setIsDispatchOpen}
        onSubmit={handleDispatch}
        submitting={dispatchSubmitting}
      />

      {/* ── Return Modal ── */}
      <ReturnModal
        vehicle={returningVehicle}
        open={isReturnOpen}
        onOpenChange={setIsReturnOpen}
        onSubmit={handleReturn}
        submitting={returnSubmitting}
      />
    </div>
  );
};

export default VehiclesPage;
