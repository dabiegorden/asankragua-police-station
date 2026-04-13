"use client";
import { useState, useEffect } from "react";
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
  AlertCircle,
  Clock,
  MapPin,
  RotateCcw,
  Hash,
  Gauge,
} from "lucide-react";

// ==================== TypeScript Interfaces ====================

interface UserRef {
  _id: string;
  firstName: string;
  lastName: string;
  badgeNumber?: string;
  email?: string;
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
  mileage: number;
  fuelLevel: string;
  status: "available" | "in-use" | "maintenance" | "out-of-service";
  currentDriver?: UserRef | string;
  maintenanceHistory: MaintenanceRecord[];
  fuelHistory: FuelRecord[];
  assignmentHistory: AssignmentRecord[];
  returnHistory: ReturnRecord[];
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
  mileage: number;
  fuelLevel: string;
  status: string;
  equipment: Equipment[];
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

interface VehiclesResponse {
  vehicles: Vehicle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface PersonnelResponse {
  personnel: UserRef[];
}

// ==================== Constants ====================

const EMPTY_FORM: VehicleFormData = {
  licensePlate: "",
  make: "",
  model: "",
  type: "",
  mileage: 0,
  fuelLevel: "",
  status: "available",
  equipment: [],
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

type VehicleStatus = (typeof STATUSES)[number];

const STATUS_COLORS: Record<VehicleStatus, string> = {
  available: "bg-green-100 text-green-800",
  "in-use": "bg-blue-100 text-blue-800",
  maintenance: "bg-yellow-100 text-yellow-800",
  "out-of-service": "bg-red-100 text-red-800",
};

const MAINTENANCE_TYPE_COLORS = {
  routine: "bg-blue-100 text-blue-800",
  repair: "bg-red-100 text-red-800",
  inspection: "bg-yellow-100 text-yellow-800",
  emergency: "bg-purple-100 text-purple-800",
};

const EQUIPMENT_CONDITION_COLORS = {
  excellent: "bg-green-100 text-green-800",
  good: "bg-blue-100 text-blue-800",
  fair: "bg-yellow-100 text-yellow-800",
  poor: "bg-red-100 text-red-800",
};

// ==================== Helper Functions ====================

const formatStatus = (status: string): string =>
  status.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());

const getStatusColor = (status: VehicleStatus): string =>
  STATUS_COLORS[status] || "bg-gray-100 text-gray-800";

const getToken = (): string | null => localStorage.getItem("token");

const formatDate = (dateString: string): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString();
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    amount,
  );

// ==================== Vehicle Return Modal ====================

interface VehicleReturnModalProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (vehicleId: string, data: ReturnFormData) => Promise<void>;
  submitting: boolean;
}

const VehicleReturnModal = ({
  vehicle,
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: VehicleReturnModalProps) => {
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
    setForm(EMPTY_RETURN_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-600" />
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
                placeholder="Any damage, issues, or observations..."
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
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Return
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ==================== Vehicle Details Modal ====================

interface VehicleDetailsModalProps {
  vehicle: Vehicle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VehicleDetailsModal = ({
  vehicle,
  open,
  onOpenChange,
}: VehicleDetailsModalProps) => {
  const [activeTab, setActiveTab] = useState<
    "details" | "maintenance" | "fuel" | "assignments" | "returns" | "equipment"
  >("details");

  if (!vehicle) return null;

  const driver =
    typeof vehicle.currentDriver === "object" ? vehicle.currentDriver : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Car className="w-6 h-6" />
            {vehicle.licensePlate} — {vehicle.make} {vehicle.model}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-2">
          {[
            { id: "details", label: "Details", icon: FileText },
            { id: "maintenance", label: "Maintenance", icon: Wrench },
            { id: "fuel", label: "Fuel Records", icon: Droplet },
            { id: "assignments", label: "Assignments", icon: ClipboardList },
            { id: "returns", label: "Returns", icon: RotateCcw },
            { id: "equipment", label: "Equipment", icon: Package },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="gap-1"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {/* ---- DETAILS ---- */}
          {activeTab === "details" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Hash className="w-3 h-3" /> Vehicle Number
                  </Label>
                  <p className="font-mono text-sm font-medium">
                    {vehicle.vehicleNumber}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Car className="w-3 h-3" /> License Plate
                  </Label>
                  <p className="font-medium">{vehicle.licensePlate}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Make / Model</Label>
                  <p>
                    {vehicle.make} {vehicle.model}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Type</Label>
                  <Badge variant="outline">{formatStatus(vehicle.type)}</Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> Mileage
                  </Label>
                  <p>{vehicle.mileage.toLocaleString()} km</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <Fuel className="w-3 h-3" /> Fuel Level
                  </Label>
                  <p className="font-medium">{vehicle.fuelLevel || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Status</Label>
                  <Badge
                    className={getStatusColor(vehicle.status as VehicleStatus)}
                  >
                    {formatStatus(vehicle.status)}
                  </Badge>
                </div>
                {driver && (
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="w-3 h-3" /> Current Driver
                    </Label>
                    <p>
                      {driver.firstName} {driver.lastName}
                    </p>
                  </div>
                )}
              </div>

              {vehicle.notes && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4" /> Notes
                  </h3>
                  <p className="text-sm text-gray-600">{vehicle.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ---- MAINTENANCE ---- */}
          {activeTab === "maintenance" && (
            <div className="space-y-4">
              {vehicle.maintenanceHistory?.length > 0 ? (
                vehicle.maintenanceHistory.map((record, index) => (
                  <Card key={record._id || index}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={MAINTENANCE_TYPE_COLORS[record.type]}
                          >
                            {record.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            <Calendar className="inline w-3 h-3 mr-1" />
                            {formatDate(record.date)}
                          </span>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(record.cost)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {record.description}
                      </p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Performed By: {record.performedBy}</p>
                        <p>
                          Mileage at Service:{" "}
                          {record.mileageAtService?.toLocaleString()} km
                        </p>
                        {record.nextServiceDue && (
                          <p>
                            Next Service Due:{" "}
                            {formatDate(record.nextServiceDue)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Wrench className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No maintenance records found</p>
                </div>
              )}
            </div>
          )}

          {/* ---- FUEL ---- */}
          {activeTab === "fuel" && (
            <div className="space-y-4">
              {vehicle.fuelHistory?.length > 0 ? (
                vehicle.fuelHistory.map((record, index) => {
                  const filledBy =
                    typeof record.filledBy === "object"
                      ? record.filledBy
                      : null;
                  return (
                    <Card key={record._id || index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <Droplet className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-gray-500">
                              <Calendar className="inline w-3 h-3 mr-1" />
                              {formatDate(record.date)}
                            </span>
                          </div>
                          <span className="font-semibold">
                            {formatCurrency(record.cost)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <Label className="text-xs text-gray-500">
                              Amount
                            </Label>
                            <p>{record.amount} L</p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">
                              Mileage
                            </Label>
                            <p>{record.mileage?.toLocaleString()} km</p>
                          </div>
                          {filledBy && (
                            <div className="col-span-2">
                              <Label className="text-xs text-gray-500">
                                Filled By
                              </Label>
                              <p>
                                {filledBy.firstName} {filledBy.lastName}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Droplet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No fuel records found</p>
                </div>
              )}
            </div>
          )}

          {/* ---- ASSIGNMENTS ---- */}
          {activeTab === "assignments" && (
            <div className="space-y-4">
              {vehicle.assignmentHistory?.length > 0 ? (
                vehicle.assignmentHistory.map((record, index) => {
                  const assignedTo =
                    typeof record.assignedTo === "object"
                      ? record.assignedTo
                      : null;
                  return (
                    <Card key={record._id || index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">
                              {assignedTo
                                ? `${assignedTo.firstName} ${assignedTo.lastName}`
                                : "Unknown"}
                            </span>
                          </div>
                          <Badge
                            variant={
                              record.returnedDate ? "outline" : "default"
                            }
                          >
                            {record.returnedDate ? "Returned" : "Active"}
                          </Badge>
                        </div>
                        <div className="text-sm space-y-1">
                          <p>
                            <Calendar className="inline w-3 h-3 mr-1" />
                            Assigned: {formatDate(record.assignedDate)}
                          </p>
                          {record.returnedDate && (
                            <p>
                              <Clock className="inline w-3 h-3 mr-1" />
                              Returned: {formatDate(record.returnedDate)}
                            </p>
                          )}
                          <p>Purpose: {record.purpose}</p>
                          <p>
                            Start Mileage:{" "}
                            {record.startMileage?.toLocaleString()} km
                          </p>
                          {record.endMileage && (
                            <p>
                              End Mileage: {record.endMileage.toLocaleString()}{" "}
                              km
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No assignment records found</p>
                </div>
              )}
            </div>
          )}

          {/* ---- RETURNS ---- */}
          {activeTab === "returns" && (
            <div className="space-y-4">
              {vehicle.returnHistory?.length > 0 ? (
                vehicle.returnHistory.map((record, index) => (
                  <Card key={record._id || index}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-sm">
                            {record.driverName}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          <Calendar className="inline w-3 h-3 mr-1" />
                          {formatDate(record.returnedDate)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <Label className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Location
                          </Label>
                          <p>{record.location}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Duty</Label>
                          <p>{record.duty}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 flex items-center gap-1">
                            <Fuel className="w-3 h-3" /> Fuel on Return
                          </Label>
                          <p>{record.fuelLevelOnReturn || "N/A"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Return Time
                          </Label>
                          <p>{record.returnTime || "N/A"}</p>
                        </div>
                        {record.conditionNotes && (
                          <div className="col-span-2">
                            <Label className="text-xs text-gray-500">
                              Condition Notes
                            </Label>
                            <p className="text-gray-700">
                              {record.conditionNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No return records found</p>
                </div>
              )}
            </div>
          )}

          {/* ---- EQUIPMENT ---- */}
          {activeTab === "equipment" && (
            <div className="space-y-4">
              {vehicle.equipment?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {vehicle.equipment.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{item.name}</h4>
                          <Badge
                            className={
                              EQUIPMENT_CONDITION_COLORS[item.condition]
                            }
                          >
                            {item.condition.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          Serial: {item.serialNumber}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No equipment records found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ==================== Vehicle Form ====================

interface VehicleFormProps {
  formData: VehicleFormData;
  setFormData: (data: VehicleFormData) => void;
  selectedVehicle: Vehicle | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onClose: () => void;
}

const VehicleForm = ({
  formData,
  setFormData,
  selectedVehicle,
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
          onValueChange={(value) => setFormData({ ...formData, type: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {formatStatus(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          placeholder="e.g. Full, Half, Quarter, Empty"
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
        onValueChange={(value) => setFormData({ ...formData, status: value })}
      >
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {formatStatus(s)}
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
        {selectedVehicle ? "Update Vehicle" : "Create Vehicle"}
      </Button>
    </div>
  </form>
);

// ==================== Main Component ====================

const Vehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [personnel, setPersonnel] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [returningVehicle, setReturningVehicle] = useState<Vehicle | null>(
    null,
  );
  const [formData, setFormData] = useState<VehicleFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [returnSubmitting, setReturnSubmitting] = useState<boolean>(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    fetchVehicles();
  }, [currentPage, debouncedSearchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  // ==================== API ====================

  const fetchVehicles = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
      });

      const response = await fetch(`/api/vehicles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: VehiclesResponse = await response.json();
        setVehicles(data.vehicles);
        setTotalPages(data.pagination.pages);
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to fetch vehicles");
      }
    } catch {
      toast.error("Failed to fetch vehicles");
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonnel = async (): Promise<void> => {
    try {
      const token = getToken();
      const response = await fetch("/api/personnel?limit=200", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data: PersonnelResponse = await response.json();
        setPersonnel(data.personnel || []);
      }
    } catch {
      console.error("Failed to fetch personnel");
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = getToken();
      const url = selectedVehicle
        ? `/api/vehicles/${selectedVehicle._id}`
        : "/api/vehicles";
      const method = selectedVehicle ? "PUT" : "POST";

      const payload = {
        ...formData,
        mileage: Number(formData.mileage),
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(
          `Vehicle ${selectedVehicle ? "updated" : "created"} successfully`,
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchVehicles();
      } else {
        const err = await response.json();
        toast.error(err.error || "Operation failed");
      }
    } catch {
      toast.error("Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vehicleId: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this vehicle?")) return;
    try {
      const token = getToken();
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success("Vehicle deleted successfully");
        fetchVehicles();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete vehicle");
      }
    } catch {
      toast.error("Failed to delete vehicle");
    }
  };

  const handleAssignDriver = async (
    vehicleId: string,
    driverId: string,
  ): Promise<void> => {
    try {
      const token = getToken();
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "assign-driver",
          driverId,
          purpose: "Patrol duty",
        }),
      });
      if (response.ok) {
        toast.success("Driver assigned successfully");
        fetchVehicles();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to assign driver");
      }
    } catch {
      toast.error("Failed to assign driver");
    }
  };

  const handleReturnVehicle = async (
    vehicleId: string,
    data: ReturnFormData,
  ): Promise<void> => {
    setReturnSubmitting(true);
    try {
      const token = getToken();
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "return-vehicle",
          ...data,
        }),
      });
      if (response.ok) {
        toast.success("Vehicle returned successfully");
        setIsReturnModalOpen(false);
        setReturningVehicle(null);
        fetchVehicles();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to return vehicle");
      }
    } catch {
      toast.error("Failed to return vehicle");
    } finally {
      setReturnSubmitting(false);
    }
  };

  const resetForm = (): void => {
    setFormData(EMPTY_FORM);
    setSelectedVehicle(null);
  };

  const openEditModal = (vehicle: Vehicle): void => {
    setSelectedVehicle(vehicle);
    setFormData({
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      type: vehicle.type,
      mileage: vehicle.mileage,
      fuelLevel: vehicle.fuelLevel || "",
      status: vehicle.status,
      equipment: vehicle.equipment || [],
      notes: vehicle.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (vehicle: Vehicle): void => {
    setViewingVehicle(vehicle);
    setIsViewModalOpen(true);
  };

  const openReturnModal = (vehicle: Vehicle): void => {
    setReturningVehicle(vehicle);
    setIsReturnModalOpen(true);
  };

  // ==================== Render ====================

  if (loading && vehicles.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Vehicle Management</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
            </DialogHeader>
            <VehicleForm
              formData={formData}
              setFormData={setFormData}
              selectedVehicle={selectedVehicle}
              submitting={submitting}
              onSubmit={handleSubmit}
              onClose={() => setIsCreateModalOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-50">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by plate, make, model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatStatus(s)}
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
                    {formatStatus(t)}
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
          <CardTitle>Vehicles ({vehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Vehicle #</th>
                  <th className="text-left p-2">License Plate</th>
                  <th className="text-left p-2">Make / Model</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Fuel</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-gray-500">
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle) => (
                    <tr key={vehicle._id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-mono text-sm">
                        {vehicle.vehicleNumber}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center space-x-2">
                          <Car className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {vehicle.licensePlate}
                          </span>
                        </div>
                      </td>
                      <td className="p-2">
                        {vehicle.make} {vehicle.model}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">
                          {formatStatus(vehicle.type)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge
                          className={getStatusColor(
                            vehicle.status as VehicleStatus,
                          )}
                        >
                          {formatStatus(vehicle.status)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center space-x-1">
                          <Fuel className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">
                            {vehicle.fuelLevel || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            title="View details"
                            onClick={() => openViewModal(vehicle)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Edit"
                            onClick={() => openEditModal(vehicle)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Return vehicle"
                            onClick={() => openReturnModal(vehicle)}
                            className="text-green-700 border-green-300 hover:bg-green-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Delete"
                            onClick={() => handleDelete(vehicle._id)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
          </DialogHeader>
          <VehicleForm
            formData={formData}
            setFormData={setFormData}
            selectedVehicle={selectedVehicle}
            submitting={submitting}
            onSubmit={handleSubmit}
            onClose={() => setIsEditModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Details Modal */}
      <VehicleDetailsModal
        vehicle={viewingVehicle}
        open={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
      />

      {/* Return Vehicle Modal */}
      <VehicleReturnModal
        vehicle={returningVehicle}
        open={isReturnModalOpen}
        onOpenChange={setIsReturnModalOpen}
        onSubmit={handleReturnVehicle}
        submitting={returnSubmitting}
      />
    </div>
  );
};

export default Vehicles;
