"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
  Shield,
  CreditCard,
  Hash,
  PaintBucket,
  Gauge,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

// ==================== TypeScript Interfaces ====================

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  badgeNumber?: string;
  email?: string;
}

interface InsuranceDetails {
  provider: string;
  policyNumber: string;
  expiryDate: string;
  coverage: string;
}

interface RegistrationDetails {
  registrationNumber: string;
  expiryDate: string;
  registeredTo: string;
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
  filledBy: User | string;
}

interface AssignmentRecord {
  _id?: string;
  assignedTo: User | string;
  assignedDate: string;
  returnedDate?: string;
  purpose: string;
  startMileage: number;
  endMileage?: number;
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
  year: number;
  color: string;
  type: "patrol-car" | "motorcycle" | "van" | "truck" | "suv" | "other";
  vin?: string;
  mileage: number;
  fuelLevel: number;
  status: "available" | "in-use" | "maintenance" | "out-of-service";
  currentDriver?: User | string;
  insuranceDetails: InsuranceDetails;
  registrationDetails: RegistrationDetails;
  maintenanceHistory: MaintenanceRecord[];
  fuelHistory: FuelRecord[];
  assignmentHistory: AssignmentRecord[];
  equipment: Equipment[];
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VehicleFormData {
  licensePlate: string;
  make: string;
  model: string;
  year: string;
  color: string;
  type: string;
  vin: string;
  mileage: number;
  fuelLevel: number;
  status: string;
  insuranceDetails: InsuranceDetails;
  registrationDetails: RegistrationDetails;
  equipment: Equipment[];
  notes: string;
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
  personnel: User[];
}

// ==================== Constants ====================

const EMPTY_FORM: VehicleFormData = {
  licensePlate: "",
  make: "",
  model: "",
  year: "",
  color: "",
  type: "",
  vin: "",
  mileage: 0,
  fuelLevel: 100,
  status: "available",
  insuranceDetails: {
    provider: "",
    policyNumber: "",
    expiryDate: "",
    coverage: "",
  },
  registrationDetails: {
    registrationNumber: "",
    expiryDate: "",
    registeredTo: "",
  },
  equipment: [],
  notes: "",
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

type VehicleType = (typeof VEHICLE_TYPES)[number];
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

const formatStatus = (status: string): string => {
  return status.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const getStatusColor = (status: VehicleStatus): string => {
  return STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
};

const getFuelLevelColor = (level: number): string => {
  if (level > 50) return "text-green-600";
  if (level > 25) return "text-yellow-600";
  return "text-red-600";
};

const getToken = (): string | null => localStorage.getItem("token");

const formatDate = (dateString: string): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString();
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
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
    "details" | "maintenance" | "fuel" | "assignments" | "equipment"
  >("details");

  if (!vehicle) return null;

  const driver =
    typeof vehicle.currentDriver === "object" ? vehicle.currentDriver : null;

  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const expiryDate = new Date(date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (date: string) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Car className="w-6 h-6" />
            {vehicle.licensePlate} - {vehicle.make} {vehicle.model}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          {[
            { id: "details", label: "Details", icon: FileText },
            { id: "maintenance", label: "Maintenance", icon: Wrench },
            { id: "fuel", label: "Fuel Records", icon: Droplet },
            { id: "assignments", label: "Assignments", icon: ClipboardList },
            { id: "equipment", label: "Equipment", icon: Package },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.id as any)}
              className="gap-2"
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Basic Info */}
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
                  <Label className="text-xs text-gray-500 flex items-center gap-1">
                    <PaintBucket className="w-3 h-3" /> Color
                  </Label>
                  <p>{vehicle.color}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Make/Model</Label>
                  <p>
                    {vehicle.make} {vehicle.model}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Year</Label>
                  <p>{vehicle.year}</p>
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
                  <p className={getFuelLevelColor(vehicle.fuelLevel)}>
                    {vehicle.fuelLevel}%
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Status</Label>
                  <Badge
                    className={getStatusColor(vehicle.status as VehicleStatus)}
                  >
                    {formatStatus(vehicle.status)}
                  </Badge>
                </div>
                {vehicle.vin && (
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs text-gray-500">VIN</Label>
                    <p className="font-mono text-sm">{vehicle.vin}</p>
                  </div>
                )}
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

              {/* Insurance Details */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" /> Insurance Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Provider</Label>
                    <p>{vehicle.insuranceDetails?.provider || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">
                      Policy Number
                    </Label>
                    <p>{vehicle.insuranceDetails?.policyNumber || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Expiry Date
                    </Label>
                    <div className="flex items-center gap-2">
                      <span>
                        {formatDate(vehicle.insuranceDetails?.expiryDate)}
                      </span>
                      {isExpiringSoon(vehicle.insuranceDetails?.expiryDate) && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-100 text-yellow-800"
                        >
                          Expiring Soon
                        </Badge>
                      )}
                      {isExpired(vehicle.insuranceDetails?.expiryDate) && (
                        <Badge
                          variant="outline"
                          className="bg-red-100 text-red-800"
                        >
                          Expired
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Coverage</Label>
                    <p>{vehicle.insuranceDetails?.coverage || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Registration Details */}
              <div className="border-t pt-4">
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <CreditCard className="w-4 h-4" /> Registration Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">
                      Registration Number
                    </Label>
                    <p>
                      {vehicle.registrationDetails?.registrationNumber || "N/A"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">
                      Registered To
                    </Label>
                    <p>{vehicle.registrationDetails?.registeredTo || "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Expiry Date
                    </Label>
                    <div className="flex items-center gap-2">
                      <span>
                        {formatDate(vehicle.registrationDetails?.expiryDate)}
                      </span>
                      {isExpiringSoon(
                        vehicle.registrationDetails?.expiryDate,
                      ) && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-100 text-yellow-800"
                        >
                          Expiring Soon
                        </Badge>
                      )}
                      {isExpired(vehicle.registrationDetails?.expiryDate) && (
                        <Badge
                          variant="outline"
                          className="bg-red-100 text-red-800"
                        >
                          Expired
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
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

          {activeTab === "maintenance" && (
            <div className="space-y-4">
              {vehicle.maintenanceHistory &&
              vehicle.maintenanceHistory.length > 0 ? (
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
                          {record.mileageAtService.toLocaleString()} km
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

          {activeTab === "fuel" && (
            <div className="space-y-4">
              {vehicle.fuelHistory && vehicle.fuelHistory.length > 0 ? (
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
                            <p>{record.mileage.toLocaleString()} km</p>
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

          {activeTab === "assignments" && (
            <div className="space-y-4">
              {vehicle.assignmentHistory &&
              vehicle.assignmentHistory.length > 0 ? (
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
                            {record.startMileage.toLocaleString()} km
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

          {activeTab === "equipment" && (
            <div className="space-y-4">
              {vehicle.equipment && vehicle.equipment.length > 0 ? (
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

// ==================== Vehicle Form Component ====================

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
    {/* Basic Info */}
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="licensePlate">License Plate *</Label>
        <Input
          id="licensePlate"
          value={formData.licensePlate}
          onChange={(e) =>
            setFormData({ ...formData, licensePlate: e.target.value })
          }
          required
        />
      </div>
      <div>
        <Label htmlFor="type">Vehicle Type *</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value })}
        >
          <SelectTrigger>
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

    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label htmlFor="make">Make *</Label>
        <Input
          id="make"
          value={formData.make}
          onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="model">Model *</Label>
        <Input
          id="model"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="year">Year *</Label>
        <Input
          id="year"
          type="number"
          min="1900"
          max={new Date().getFullYear() + 1}
          value={formData.year}
          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
          required
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label htmlFor="color">Color *</Label>
        <Input
          id="color"
          value={formData.color}
          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="vin">VIN</Label>
        <Input
          id="vin"
          value={formData.vin}
          onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
        />
      </div>
    </div>

    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label htmlFor="mileage">Mileage</Label>
        <Input
          id="mileage"
          type="number"
          min="0"
          value={formData.mileage}
          onChange={(e) =>
            setFormData({
              ...formData,
              mileage: parseInt(e.target.value) || 0,
            })
          }
        />
      </div>
      <div>
        <Label htmlFor="fuelLevel">Fuel Level (%)</Label>
        <Input
          id="fuelLevel"
          type="number"
          min="0"
          max="100"
          value={formData.fuelLevel}
          onChange={(e) =>
            setFormData({
              ...formData,
              fuelLevel: parseInt(e.target.value) || 0,
            })
          }
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value })}
        >
          <SelectTrigger>
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
    </div>

    {/* Insurance */}
    <div>
      <Label className="text-sm font-semibold">Insurance Details</Label>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Input
          placeholder="Provider"
          value={formData.insuranceDetails.provider}
          onChange={(e) =>
            setFormData({
              ...formData,
              insuranceDetails: {
                ...formData.insuranceDetails,
                provider: e.target.value,
              },
            })
          }
        />
        <Input
          placeholder="Policy Number"
          value={formData.insuranceDetails.policyNumber}
          onChange={(e) =>
            setFormData({
              ...formData,
              insuranceDetails: {
                ...formData.insuranceDetails,
                policyNumber: e.target.value,
              },
            })
          }
        />
        <div>
          <Label className="text-xs text-gray-500">Expiry Date</Label>
          <Input
            type="date"
            value={formData.insuranceDetails.expiryDate}
            onChange={(e) =>
              setFormData({
                ...formData,
                insuranceDetails: {
                  ...formData.insuranceDetails,
                  expiryDate: e.target.value,
                },
              })
            }
          />
        </div>
        <Input
          placeholder="Coverage"
          value={formData.insuranceDetails.coverage}
          onChange={(e) =>
            setFormData({
              ...formData,
              insuranceDetails: {
                ...formData.insuranceDetails,
                coverage: e.target.value,
              },
            })
          }
        />
      </div>
    </div>

    {/* Registration */}
    <div>
      <Label className="text-sm font-semibold">Registration Details</Label>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Input
          placeholder="Registration Number"
          value={formData.registrationDetails.registrationNumber}
          onChange={(e) =>
            setFormData({
              ...formData,
              registrationDetails: {
                ...formData.registrationDetails,
                registrationNumber: e.target.value,
              },
            })
          }
        />
        <Input
          placeholder="Registered To"
          value={formData.registrationDetails.registeredTo}
          onChange={(e) =>
            setFormData({
              ...formData,
              registrationDetails: {
                ...formData.registrationDetails,
                registeredTo: e.target.value,
              },
            })
          }
        />
        <div>
          <Label className="text-xs text-gray-500">Expiry Date</Label>
          <Input
            type="date"
            value={formData.registrationDetails.expiryDate}
            onChange={(e) =>
              setFormData({
                ...formData,
                registrationDetails: {
                  ...formData.registrationDetails,
                  expiryDate: e.target.value,
                },
              })
            }
          />
        </div>
      </div>
    </div>

    <div>
      <Label htmlFor="notes">Notes</Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        rows={3}
      />
    </div>

    <div className="flex justify-end space-x-2 pt-2">
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
  const [personnel, setPersonnel] = useState<User[]>([]);
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
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [viewingVehicle, setViewingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, typeFilter]);

  // ==================== API Calls ====================

  useEffect(() => {
    fetchVehicles();
  }, [currentPage, debouncedSearchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const fetchVehicles = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(statusFilter && statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter && typeFilter !== "all" && { type: typeFilter }),
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
    } catch (error) {
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
        year: Number(formData.year),
        mileage: Number(formData.mileage),
        fuelLevel: Number(formData.fuelLevel),
        vin: formData.vin || undefined,
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
    endMileage: number,
  ): Promise<void> => {
    try {
      const token = getToken();
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "return-vehicle", endMileage }),
      });

      if (response.ok) {
        toast.success("Vehicle returned successfully");
        fetchVehicles();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to return vehicle");
      }
    } catch {
      toast.error("Failed to return vehicle");
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
      year: vehicle.year.toString(),
      color: vehicle.color,
      type: vehicle.type,
      vin: vehicle.vin || "",
      mileage: vehicle.mileage,
      fuelLevel: vehicle.fuelLevel,
      status: vehicle.status,
      insuranceDetails: {
        ...vehicle.insuranceDetails,
        expiryDate: vehicle.insuranceDetails?.expiryDate
          ? vehicle.insuranceDetails.expiryDate.slice(0, 10)
          : "",
      },
      registrationDetails: {
        ...vehicle.registrationDetails,
        expiryDate: vehicle.registrationDetails?.expiryDate
          ? vehicle.registrationDetails.expiryDate.slice(0, 10)
          : "",
      },
      equipment: vehicle.equipment || [],
      notes: vehicle.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const openViewModal = (vehicle: Vehicle): void => {
    setViewingVehicle(vehicle);
    setIsViewModalOpen(true);
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
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
              }}
            >
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
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
              }}
            >
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
                  <th className="text-left p-2">Current Driver</th>
                  <th className="text-left p-2">Fuel</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-gray-500">
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  vehicles.map((vehicle) => {
                    const driver =
                      typeof vehicle.currentDriver === "object"
                        ? vehicle.currentDriver
                        : null;

                    return (
                      <tr
                        key={vehicle._id}
                        className="border-b hover:bg-gray-50"
                      >
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
                          {vehicle.make} {vehicle.model} ({vehicle.year})
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
                          {driver ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center space-x-1">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">
                                  {driver.firstName} {driver.lastName}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-6 px-2"
                                onClick={() =>
                                  handleReturnVehicle(
                                    vehicle._id,
                                    vehicle.mileage,
                                  )
                                }
                              >
                                Return
                              </Button>
                            </div>
                          ) : (
                            <Select
                              onValueChange={(value) =>
                                handleAssignDriver(vehicle._id, value)
                              }
                            >
                              <SelectTrigger className="w-36 h-8">
                                <SelectValue placeholder="Assign driver" />
                              </SelectTrigger>
                              <SelectContent>
                                {personnel.map((p) => (
                                  <SelectItem key={p._id} value={p._id}>
                                    {p.firstName} {p.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-2">
                          <div className="flex items-center space-x-1">
                            <Fuel className="w-4 h-4 text-gray-400" />
                            <span
                              className={`text-sm font-medium ${getFuelLevelColor(
                                vehicle.fuelLevel,
                              )}`}
                            >
                              {vehicle.fuelLevel}%
                            </span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openViewModal(vehicle)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(vehicle)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(vehicle._id)}
                            >
                              <Trash2 className="w-4 h-4" />
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
    </div>
  );
};

export default Vehicles;
