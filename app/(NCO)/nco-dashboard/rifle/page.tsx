"use client";

import {
  useState,
  useEffect,
  Suspense,
  useCallback,
  useMemo,
  useDeferredValue,
} from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Shield,
  ShieldCheck,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useSearchParams } from "next/navigation";
import { debounce } from "lodash";

// ─── Types ─────────────────────────────────────────────────────────────────

interface IInsurance {
  policyNumber?: string;
  provider?: string;
  coverageStartDate?: string;
  coverageEndDate?: string;
  notes?: string;
}

interface IWeaponReturn {
  returnedBy?: string;
  receivedBy?: string;
  returnDate?: string;
  ammunitionReturned?: number;
  conditionOnReturn?: "good" | "damaged" | "lost";
  notes?: string;
}

interface RifleBooking {
  _id: string;
  bookingNumber: string;
  typeOfRifle: string;
  rifleNumber: string;
  serialNumber: string;
  sdNumber: string;
  ammunitionType: string;
  numberOfAmmunition: number;
  dateOfBooking: string;
  typeOfDuty: string;
  nameOfPersonnel: string;
  issuedBy: string;
  receivedBy: string;
  insurance?: IInsurance;
  weaponReturn?: IWeaponReturn;
  status: "active" | "returned" | "overdue";
  createdAt: string;
}

interface FormData {
  // Core
  typeOfRifle: string;
  rifleNumber: string;
  serialNumber: string;
  sdNumber: string;
  ammunitionType: string;
  numberOfAmmunition: number;
  dateOfBooking: string;
  typeOfDuty: string;
  nameOfPersonnel: string;
  issuedBy: string;
  receivedBy: string;
  // Insurance
  insurancePolicyNumber: string;
  insuranceProvider: string;
  insuranceCoverageStart: string;
  insuranceCoverageEnd: string;
  insuranceNotes: string;
  // Return
  returnReturnedBy: string;
  returnReceivedBy: string;
  returnDate: string;
  returnAmmunitionReturned: number;
  returnCondition: "good" | "damaged" | "lost" | "";
  returnNotes: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const EMPTY_FORM: FormData = {
  typeOfRifle: "",
  rifleNumber: "",
  serialNumber: "",
  sdNumber: "",
  ammunitionType: "",
  numberOfAmmunition: 0,
  dateOfBooking: new Date().toISOString().split("T")[0],
  typeOfDuty: "",
  nameOfPersonnel: "",
  issuedBy: "",
  receivedBy: "",
  insurancePolicyNumber: "",
  insuranceProvider: "",
  insuranceCoverageStart: "",
  insuranceCoverageEnd: "",
  insuranceNotes: "",
  returnReturnedBy: "",
  returnReceivedBy: "",
  returnDate: "",
  returnAmmunitionReturned: 0,
  returnCondition: "",
  returnNotes: "",
};

function formDataToPayload(f: FormData, isEdit: boolean) {
  const insurance: IInsurance = {};
  if (f.insurancePolicyNumber) insurance.policyNumber = f.insurancePolicyNumber;
  if (f.insuranceProvider) insurance.provider = f.insuranceProvider;
  if (f.insuranceCoverageStart)
    insurance.coverageStartDate = f.insuranceCoverageStart;
  if (f.insuranceCoverageEnd)
    insurance.coverageEndDate = f.insuranceCoverageEnd;
  if (f.insuranceNotes) insurance.notes = f.insuranceNotes;

  const weaponReturn: IWeaponReturn = {};
  if (f.returnReturnedBy) weaponReturn.returnedBy = f.returnReturnedBy;
  if (f.returnReceivedBy) weaponReturn.receivedBy = f.returnReceivedBy;
  if (f.returnDate) weaponReturn.returnDate = f.returnDate;
  if (f.returnAmmunitionReturned)
    weaponReturn.ammunitionReturned = f.returnAmmunitionReturned;
  if (f.returnCondition) weaponReturn.conditionOnReturn = f.returnCondition;
  if (f.returnNotes) weaponReturn.notes = f.returnNotes;

  return {
    typeOfRifle: f.typeOfRifle,
    rifleNumber: f.rifleNumber,
    serialNumber: f.serialNumber,
    sdNumber: f.sdNumber,
    ammunitionType: f.ammunitionType,
    numberOfAmmunition: f.numberOfAmmunition,
    dateOfBooking: f.dateOfBooking,
    typeOfDuty: f.typeOfDuty,
    nameOfPersonnel: f.nameOfPersonnel,
    issuedBy: f.issuedBy,
    receivedBy: f.receivedBy,
    insurance,
    weaponReturn,
  };
}

function bookingToForm(b: RifleBooking): FormData {
  return {
    typeOfRifle: b.typeOfRifle,
    rifleNumber: b.rifleNumber,
    serialNumber: b.serialNumber,
    sdNumber: b.sdNumber,
    ammunitionType: b.ammunitionType,
    numberOfAmmunition: b.numberOfAmmunition,
    dateOfBooking: b.dateOfBooking ? b.dateOfBooking.split("T")[0] : "",
    typeOfDuty: b.typeOfDuty,
    nameOfPersonnel: b.nameOfPersonnel,
    issuedBy: b.issuedBy,
    receivedBy: b.receivedBy,
    insurancePolicyNumber: b.insurance?.policyNumber ?? "",
    insuranceProvider: b.insurance?.provider ?? "",
    insuranceCoverageStart: b.insurance?.coverageStartDate
      ? b.insurance.coverageStartDate.split("T")[0]
      : "",
    insuranceCoverageEnd: b.insurance?.coverageEndDate
      ? b.insurance.coverageEndDate.split("T")[0]
      : "",
    insuranceNotes: b.insurance?.notes ?? "",
    returnReturnedBy: b.weaponReturn?.returnedBy ?? "",
    returnReceivedBy: b.weaponReturn?.receivedBy ?? "",
    returnDate: b.weaponReturn?.returnDate
      ? b.weaponReturn.returnDate.split("T")[0]
      : "",
    returnAmmunitionReturned: b.weaponReturn?.ammunitionReturned ?? 0,
    returnCondition: b.weaponReturn?.conditionOnReturn ?? "",
    returnNotes: b.weaponReturn?.notes ?? "",
  };
}

const STATUS_STYLES: Record<RifleBooking["status"], string> = {
  active: "bg-blue-100 text-blue-800 border border-blue-200",
  returned: "bg-green-100 text-green-800 border border-green-200",
  overdue: "bg-red-100 text-red-800 border border-red-200",
};

// ─── Search Input Component ─────────────────────────────────────────────────

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  isLoading = false,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);

  const debouncedOnChange = useMemo(
    () => debounce((val: string) => onChange(val), 300),
    [onChange],
  );

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  const handleClear = () => {
    setLocalValue("");
    onChange("");
  };

  return (
    <div className="relative flex-1">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <Input
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── View Record Modal ─────────────────────────────────────────────────────

interface ViewRecordModalProps {
  booking: RifleBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ViewRecordModal({
  booking,
  open,
  onOpenChange,
}: ViewRecordModalProps) {
  if (!booking) return null;

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Booking Details
            <Badge className={STATUS_STYLES[booking.status]}>
              {booking.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="core">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="core">
              <Shield className="h-4 w-4 mr-1" /> Booking Info
            </TabsTrigger>
            <TabsTrigger value="insurance">
              <ShieldCheck className="h-4 w-4 mr-1" /> Insurance
            </TabsTrigger>
            <TabsTrigger value="return">
              <RotateCcw className="h-4 w-4 mr-1" /> Return Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="core" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Booking Number</Label>
                <p className="font-mono font-medium">{booking.bookingNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Date of Booking</Label>
                <p>{fmtDate(booking.dateOfBooking)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Type of Rifle</Label>
                <p className="font-medium">{booking.typeOfRifle}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Rifle Number</Label>
                <p>{booking.rifleNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Serial Number</Label>
                <p className="font-mono">{booking.serialNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">SD Number</Label>
                <p>{booking.sdNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Ammunition Type</Label>
                <p>{booking.ammunitionType}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  Ammunition Count
                </Label>
                <p>{booking.numberOfAmmunition}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Type of Duty</Label>
              <p>{booking.typeOfDuty}</p>
            </div>

            <div>
              <Label className="text-muted-foreground">Name of Personnel</Label>
              <p className="font-medium">{booking.nameOfPersonnel}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Issued By</Label>
                <p>{booking.issuedBy}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Received By</Label>
                <p>{booking.receivedBy}</p>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Created At</Label>
              <p>{new Date(booking.createdAt).toLocaleString()}</p>
            </div>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-4 pt-4">
            {booking.insurance?.policyNumber ? (
              <>
                <div>
                  <Label className="text-muted-foreground">Policy Number</Label>
                  <p className="font-medium">
                    {booking.insurance.policyNumber}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Provider</Label>
                  <p>{booking.insurance.provider || "—"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">
                      Coverage Start
                    </Label>
                    <p>{fmtDate(booking.insurance.coverageStartDate)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Coverage End
                    </Label>
                    <p>{fmtDate(booking.insurance.coverageEndDate)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{booking.insurance.notes || "—"}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No insurance information available
              </p>
            )}
          </TabsContent>

          <TabsContent value="return" className="space-y-4 pt-4">
            {booking.weaponReturn?.returnDate ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Returned By</Label>
                    <p>{booking.weaponReturn.returnedBy || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Received By</Label>
                    <p>{booking.weaponReturn.receivedBy || "—"}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Return Date</Label>
                  <p>{fmtDate(booking.weaponReturn.returnDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Ammunition Returned
                  </Label>
                  <p>{booking.weaponReturn.ammunitionReturned ?? 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Condition on Return
                  </Label>
                  <Badge
                    className={
                      booking.weaponReturn.conditionOnReturn === "good"
                        ? "bg-green-100 text-green-800"
                        : booking.weaponReturn.conditionOnReturn === "damaged"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                    }
                  >
                    {booking.weaponReturn.conditionOnReturn}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{booking.weaponReturn.notes || "—"}</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Weapon not yet returned
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared form sections (unchanged) ──────────────────────────────────────

function CoreFields({
  data,
  onChange,
  prefix = "",
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  prefix?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}typeOfRifle`}>Type of Rifle *</Label>
          <Input
            id={`${prefix}typeOfRifle`}
            placeholder="e.g. AK-47, M16"
            value={data.typeOfRifle}
            onChange={(e) => onChange({ typeOfRifle: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}rifleNumber`}>Rifle Number *</Label>
          <Input
            id={`${prefix}rifleNumber`}
            placeholder="e.g. RFL-001"
            value={data.rifleNumber}
            onChange={(e) => onChange({ rifleNumber: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}serialNumber`}>Serial Number *</Label>
          <Input
            id={`${prefix}serialNumber`}
            placeholder="Unique serial number"
            value={data.serialNumber}
            onChange={(e) => onChange({ serialNumber: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}sdNumber`}>SD Number *</Label>
          <Input
            id={`${prefix}sdNumber`}
            placeholder="SD Number"
            value={data.sdNumber}
            onChange={(e) => onChange({ sdNumber: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}ammunitionType`}>Ammunition Type *</Label>
          <Input
            id={`${prefix}ammunitionType`}
            placeholder="e.g. 7.62mm"
            value={data.ammunitionType}
            onChange={(e) => onChange({ ammunitionType: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}numberOfAmmunition`}>
            Ammunition Count *
          </Label>
          <Input
            id={`${prefix}numberOfAmmunition`}
            type="number"
            min="0"
            value={data.numberOfAmmunition}
            onChange={(e) =>
              onChange({ numberOfAmmunition: parseInt(e.target.value) || 0 })
            }
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}dateOfBooking`}>Date of Booking *</Label>
          <Input
            id={`${prefix}dateOfBooking`}
            type="date"
            value={data.dateOfBooking}
            onChange={(e) => onChange({ dateOfBooking: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}typeOfDuty`}>Type of Duty *</Label>
          <Input
            id={`${prefix}typeOfDuty`}
            placeholder="e.g. Patrol, Guard Duty"
            value={data.typeOfDuty}
            onChange={(e) => onChange({ typeOfDuty: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${prefix}nameOfPersonnel`}>Name of Personnel *</Label>
        <Input
          id={`${prefix}nameOfPersonnel`}
          placeholder="Full name"
          value={data.nameOfPersonnel}
          onChange={(e) => onChange({ nameOfPersonnel: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}issuedBy`}>Issued By *</Label>
          <Input
            id={`${prefix}issuedBy`}
            placeholder="Issuing officer"
            value={data.issuedBy}
            onChange={(e) => onChange({ issuedBy: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}receivedBy`}>Received By *</Label>
          <Input
            id={`${prefix}receivedBy`}
            placeholder="Receiving officer"
            value={data.receivedBy}
            onChange={(e) => onChange({ receivedBy: e.target.value })}
            required
          />
        </div>
      </div>
    </>
  );
}

function InsuranceFields({
  data,
  onChange,
  prefix = "",
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  prefix?: string;
}) {
  return (
    <div className="space-y-4 rounded-md border p-4 bg-muted/30">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Insurance Details (optional)
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}insurancePolicyNumber`}>
            Policy Number
          </Label>
          <Input
            id={`${prefix}insurancePolicyNumber`}
            placeholder="e.g. POL-2024-001"
            value={data.insurancePolicyNumber}
            onChange={(e) =>
              onChange({ insurancePolicyNumber: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}insuranceProvider`}>Provider</Label>
          <Input
            id={`${prefix}insuranceProvider`}
            placeholder="Insurance provider name"
            value={data.insuranceProvider}
            onChange={(e) => onChange({ insuranceProvider: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}insuranceCoverageStart`}>
            Coverage Start
          </Label>
          <Input
            id={`${prefix}insuranceCoverageStart`}
            type="date"
            value={data.insuranceCoverageStart}
            onChange={(e) =>
              onChange({ insuranceCoverageStart: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}insuranceCoverageEnd`}>Coverage End</Label>
          <Input
            id={`${prefix}insuranceCoverageEnd`}
            type="date"
            value={data.insuranceCoverageEnd}
            onChange={(e) => onChange({ insuranceCoverageEnd: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${prefix}insuranceNotes`}>Insurance Notes</Label>
        <Textarea
          id={`${prefix}insuranceNotes`}
          placeholder="Any relevant insurance notes..."
          value={data.insuranceNotes}
          onChange={(e) => onChange({ insuranceNotes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

function ReturnFields({
  data,
  onChange,
  prefix = "",
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  prefix?: string;
}) {
  return (
    <div className="space-y-4 rounded-md border p-4 bg-muted/30">
      <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <RotateCcw className="h-4 w-4" /> Weapon Return Details (optional)
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}returnReturnedBy`}>Returned By</Label>
          <Input
            id={`${prefix}returnReturnedBy`}
            placeholder="Name of returning officer"
            value={data.returnReturnedBy}
            onChange={(e) => onChange({ returnReturnedBy: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}returnReceivedBy`}>Received By</Label>
          <Input
            id={`${prefix}returnReceivedBy`}
            placeholder="Name of receiving officer"
            value={data.returnReceivedBy}
            onChange={(e) => onChange({ returnReceivedBy: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}returnDate`}>Return Date</Label>
          <Input
            id={`${prefix}returnDate`}
            type="date"
            value={data.returnDate}
            onChange={(e) => onChange({ returnDate: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}returnAmmunitionReturned`}>
            Ammunition Returned
          </Label>
          <Input
            id={`${prefix}returnAmmunitionReturned`}
            type="number"
            min="0"
            value={data.returnAmmunitionReturned}
            onChange={(e) =>
              onChange({
                returnAmmunitionReturned: parseInt(e.target.value) || 0,
              })
            }
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${prefix}returnCondition`}>Condition on Return</Label>
        <Select
          value={data.returnCondition}
          onValueChange={(v) =>
            onChange({
              returnCondition: v as FormData["returnCondition"],
            })
          }
        >
          <SelectTrigger id={`${prefix}returnCondition`}>
            <SelectValue placeholder="Select condition" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`${prefix}returnNotes`}>Return Notes</Label>
        <Textarea
          id={`${prefix}returnNotes`}
          placeholder="Notes about the returned weapon/ammunition..."
          value={data.returnNotes}
          onChange={(e) => onChange({ returnNotes: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}

// ─── Booking form modal (unchanged) ────────────────────────────────────────

function BookingForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  isEdit,
}: {
  formData: FormData;
  onChange: (patch: Partial<FormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Tabs defaultValue="core">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="core">
            <Shield className="h-4 w-4 mr-1" /> Booking
          </TabsTrigger>
          <TabsTrigger value="insurance">
            <ShieldCheck className="h-4 w-4 mr-1" /> Insurance
          </TabsTrigger>
          <TabsTrigger value="return">
            <RotateCcw className="h-4 w-4 mr-1" /> Return
          </TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="space-y-4 pt-2">
          <CoreFields
            data={formData}
            onChange={onChange}
            prefix={isEdit ? "edit-" : ""}
          />
        </TabsContent>

        <TabsContent value="insurance" className="pt-2">
          <InsuranceFields
            data={formData}
            onChange={onChange}
            prefix={isEdit ? "edit-" : ""}
          />
        </TabsContent>

        <TabsContent value="return" className="pt-2">
          <ReturnFields
            data={formData}
            onChange={onChange}
            prefix={isEdit ? "edit-" : ""}
          />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {isEdit ? "Update Booking" : "Create Booking"}
        </Button>
      </div>
    </form>
  );
}

// ─── Main page content ─────────────────────────────────────────────────────

function RifleBookingContent() {
  const [bookings, setBookings] = useState<RifleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<RifleBooking | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Read initial search param (unchanged behaviour)
  useSearchParams();

  const patchForm = useCallback((patch: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setIsSearching(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });
      if (deferredSearchTerm) params.append("search", deferredSearchTerm);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/rifle-bookings?${params}`);
      const data = (await response.json()) as {
        bookings: RifleBooking[];
        pagination: Pagination;
        error?: string;
      };

      if (response.ok) {
        setBookings(data.bookings);
        setPagination(data.pagination);
      } else {
        toast.error(data.error ?? "Failed to fetch rifle bookings");
      }
    } catch {
      toast.error("Failed to fetch rifle bookings");
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  }, [currentPage, deferredSearchTerm, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setSelectedBooking(null);
  };

  const openEditModal = (booking: RifleBooking) => {
    setSelectedBooking(booking);
    setFormData(bookingToForm(booking));
    setIsEditModalOpen(true);
  };

  const openViewModal = (booking: RifleBooking) => {
    setSelectedBooking(booking);
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = selectedBooking
      ? `/api/rifle-bookings/${selectedBooking._id}`
      : "/api/rifle-bookings";
    const method = selectedBooking ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formDataToPayload(formData, !!selectedBooking)),
      });

      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (response.ok) {
        toast.success(
          data.message ??
            `Rifle booking ${selectedBooking ? "updated" : "created"} successfully`,
        );
        await fetchBookings();
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
      } else {
        toast.error(data.error ?? "Failed to save rifle booking");
      }
    } catch {
      toast.error("Failed to save rifle booking");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rifle booking?")) return;

    try {
      const response = await fetch(`/api/rifle-bookings/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (response.ok) {
        toast.success(data.message ?? "Rifle booking deleted successfully");
        await fetchBookings();
      } else {
        toast.error(data.error ?? "Failed to delete rifle booking");
      }
    } catch {
      toast.error("Failed to delete rifle booking");
    }
  };

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—");

  if (loading && !isSearching) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Rifle Bookings</h1>
          <p className="text-muted-foreground">
            Manage rifle assignments, insurance, and returns
          </p>
        </div>

        <Dialog
          open={isCreateModalOpen}
          onOpenChange={(open) => {
            setIsCreateModalOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Rifle Booking</DialogTitle>
            </DialogHeader>
            <BookingForm
              formData={formData}
              onChange={patchForm}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsCreateModalOpen(false);
                resetForm();
              }}
              isEdit={false}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Search &amp; Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <SearchBar
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by booking number, serial, personnel... (type to search)"
              isLoading={isSearching}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              Searching for: "{searchTerm}"
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Table ───────────────────────────────────────────────────── */}
      {bookings.length === 0 ? (
        <EmptyState
          type="no-results"
          title="No rifle bookings found"
          description={
            searchTerm
              ? "Try adjusting your search terms"
              : "Create your first rifle booking to get started"
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide">
                    <th className="text-left p-3">Booking #</th>
                    <th className="text-left p-3">Personnel</th>
                    <th className="text-left p-3">Rifle</th>
                    <th className="text-left p-3">Serial</th>
                    <th className="text-left p-3">Duty</th>
                    <th className="text-left p-3">Booking Date</th>
                    <th className="text-left p-3">Insurance</th>
                    <th className="text-left p-3">Return</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr
                      key={booking._id}
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-3 font-mono font-medium">
                        {booking.bookingNumber}
                      </td>

                      <td className="p-3">
                        <div className="font-medium">
                          {booking.nameOfPersonnel}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          SD: {booking.sdNumber}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-medium">{booking.typeOfRifle}</div>
                        <div className="text-xs text-muted-foreground">
                          #{booking.rifleNumber}
                        </div>
                      </td>

                      <td className="p-3 font-mono text-xs">
                        {booking.serialNumber}
                      </td>

                      <td className="p-3">{booking.typeOfDuty}</td>

                      <td className="p-3">{fmtDate(booking.dateOfBooking)}</td>

                      <td className="p-3">
                        {booking.insurance?.policyNumber ? (
                          <div>
                            <div className="font-medium text-xs">
                              {booking.insurance.policyNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.insurance.provider ?? "—"}
                            </div>
                            {booking.insurance.coverageEndDate && (
                              <div className="text-xs text-muted-foreground">
                                Exp:{" "}
                                {fmtDate(booking.insurance.coverageEndDate)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {booking.weaponReturn?.returnDate ? (
                          <div>
                            <div className="text-xs font-medium">
                              {fmtDate(booking.weaponReturn.returnDate)}
                            </div>
                            {booking.weaponReturn.conditionOnReturn && (
                              <Badge
                                variant="outline"
                                className={
                                  booking.weaponReturn.conditionOnReturn ===
                                  "good"
                                    ? "text-green-700 border-green-300 text-xs"
                                    : booking.weaponReturn.conditionOnReturn ===
                                        "damaged"
                                      ? "text-orange-700 border-orange-300 text-xs"
                                      : "text-red-700 border-red-300 text-xs"
                                }
                              >
                                {booking.weaponReturn.conditionOnReturn}
                              </Badge>
                            )}
                            {booking.weaponReturn.ammunitionReturned !==
                              undefined && (
                              <div className="text-xs text-muted-foreground">
                                Ammo back:{" "}
                                {booking.weaponReturn.ammunitionReturned}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not returned
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <Badge className={STATUS_STYLES[booking.status]}>
                          {booking.status}
                        </Badge>
                      </td>

                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewModal(booking)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(booking)}
                            title="Edit booking"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(booking._id)}
                            title="Delete booking"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {pagination.pages} &middot; {pagination.total}{" "}
            total
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((p) => Math.min(pagination.pages, p + 1))
            }
            disabled={currentPage === pagination.pages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Edit modal ──────────────────────────────────────────────── */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Rifle Booking{" "}
              {selectedBooking && (
                <span className="font-mono text-muted-foreground text-sm ml-1">
                  {selectedBooking.bookingNumber}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <BookingForm
            formData={formData}
            onChange={patchForm}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsEditModalOpen(false);
              resetForm();
            }}
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* ─── View modal ──────────────────────────────────────────────── */}
      <ViewRecordModal
        booking={selectedBooking}
        open={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
      />
    </div>
  );
}

// ─── Page wrapper ──────────────────────────────────────────────────────────

export default function RifleBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <RifleBookingContent />
    </Suspense>
  );
}
