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
import { Separator } from "@/components/ui/separator";
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
  PackageCheck,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useSearchParams } from "next/navigation";
import { debounce } from "lodash";
import { useStation } from "@/context/StationContext";

// ─── Types ─────────────────────────────────────────────────────────────────

interface IInsurance {
  policyNumber?: string;
  provider?: string;
  coverageStartDate?: string;
  coverageEndDate?: string;
  notes?: string;
}

interface IWeaponReturn {
  // Mirror of booking core fields — captured at return time
  typeOfRifle?: string;
  rifleNumber?: string;
  serialNumber?: string;
  sdNumber?: string;
  ammunitionType?: string;
  numberOfAmmunition?: number;
  dateOfBooking?: string;
  typeOfDuty?: string;
  nameOfPersonnel?: string;
  issuedBy?: string;
  receivedBy?: string;
  // Return-specific fields
  returnedBy?: string;
  returnReceivedBy?: string;
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

interface BookingFormData {
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
  insurancePolicyNumber: string;
  insuranceProvider: string;
  insuranceCoverageStart: string;
  insuranceCoverageEnd: string;
  insuranceNotes: string;
}

interface ReturnFormData {
  // Booking info (pre-filled from booking, editable)
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
  // Return-specific
  returnedBy: string;
  returnReceivedBy: string;
  returnDate: string;
  ammunitionReturned: number;
  conditionOnReturn: "good" | "damaged" | "lost" | "";
  notes: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const EMPTY_BOOKING_FORM: BookingFormData = {
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
};

const EMPTY_RETURN_FORM: ReturnFormData = {
  typeOfRifle: "",
  rifleNumber: "",
  serialNumber: "",
  sdNumber: "",
  ammunitionType: "",
  numberOfAmmunition: 0,
  dateOfBooking: "",
  typeOfDuty: "",
  nameOfPersonnel: "",
  issuedBy: "",
  receivedBy: "",
  returnedBy: "",
  returnReceivedBy: "",
  returnDate: new Date().toISOString().split("T")[0],
  ammunitionReturned: 0,
  conditionOnReturn: "",
  notes: "",
};

function bookingToReturnForm(b: RifleBooking): ReturnFormData {
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
    returnedBy: b.weaponReturn?.returnedBy ?? "",
    returnReceivedBy:
      b.weaponReturn?.returnReceivedBy ?? b.weaponReturn?.receivedBy ?? "",
    returnDate: b.weaponReturn?.returnDate
      ? b.weaponReturn.returnDate.split("T")[0]
      : new Date().toISOString().split("T")[0],
    ammunitionReturned: b.weaponReturn?.ammunitionReturned ?? 0,
    conditionOnReturn: b.weaponReturn?.conditionOnReturn ?? "",
    notes: b.weaponReturn?.notes ?? "",
  };
}

function bookingToEditForm(b: RifleBooking): BookingFormData {
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
  };
}

const STATUS_STYLES: Record<RifleBooking["status"], string> = {
  active: "bg-blue-100 text-blue-800 border border-blue-200",
  returned: "bg-green-100 text-green-800 border border-green-200",
  overdue: "bg-red-100 text-red-800 border border-red-200",
};

const fmtDate = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ─── Search Bar ────────────────────────────────────────────────────────────

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
    setLocalValue(e.target.value);
    debouncedOnChange(e.target.value);
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
          onClick={() => {
            setLocalValue("");
            onChange("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─── Core Booking Fields (reusable) ────────────────────────────────────────

interface CoreFieldsProps {
  data: Pick<
    BookingFormData | ReturnFormData,
    | "typeOfRifle"
    | "rifleNumber"
    | "serialNumber"
    | "sdNumber"
    | "ammunitionType"
    | "numberOfAmmunition"
    | "dateOfBooking"
    | "typeOfDuty"
    | "nameOfPersonnel"
    | "issuedBy"
    | "receivedBy"
  >;
  onChange: (patch: Partial<BookingFormData & ReturnFormData>) => void;
  idPrefix?: string;
  readOnly?: boolean;
}

function CoreFields({
  data,
  onChange,
  idPrefix = "",
  readOnly = false,
}: CoreFieldsProps) {
  const p = idPrefix;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}typeOfRifle`}>Type of Rifle *</Label>
          <Input
            id={`${p}typeOfRifle`}
            placeholder="e.g. AK-47, M16"
            value={data.typeOfRifle}
            onChange={(e) => onChange({ typeOfRifle: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${p}rifleNumber`}>Rifle Number *</Label>
          <Input
            id={`${p}rifleNumber`}
            placeholder="e.g. RFL-001"
            value={data.rifleNumber}
            onChange={(e) => onChange({ rifleNumber: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}serialNumber`}>Serial Number *</Label>
          <Input
            id={`${p}serialNumber`}
            placeholder="Unique serial number"
            value={data.serialNumber}
            onChange={(e) => onChange({ serialNumber: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${p}sdNumber`}>SD Number *</Label>
          <Input
            id={`${p}sdNumber`}
            placeholder="SD Number"
            value={data.sdNumber}
            onChange={(e) => onChange({ sdNumber: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}ammunitionType`}>Ammunition Type *</Label>
          <Input
            id={`${p}ammunitionType`}
            placeholder="e.g. 7.62mm"
            value={data.ammunitionType}
            onChange={(e) => onChange({ ammunitionType: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${p}numberOfAmmunition`}>
            Ammunition Count (Issued) *
          </Label>
          <Input
            id={`${p}numberOfAmmunition`}
            type="number"
            min="0"
            value={data.numberOfAmmunition}
            onChange={(e) =>
              onChange({ numberOfAmmunition: parseInt(e.target.value) || 0 })
            }
            readOnly={readOnly}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}dateOfBooking`}>Date of Booking *</Label>
          <Input
            id={`${p}dateOfBooking`}
            type="date"
            max={new Date().toISOString().split("T")[0]}
            value={data.dateOfBooking}
            onChange={(e) => onChange({ dateOfBooking: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${p}typeOfDuty`}>Type of Duty *</Label>
          <Input
            id={`${p}typeOfDuty`}
            placeholder="e.g. Patrol, Guard Duty"
            value={data.typeOfDuty}
            onChange={(e) => onChange({ typeOfDuty: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${p}nameOfPersonnel`}>Name of Personnel *</Label>
        <Input
          id={`${p}nameOfPersonnel`}
          placeholder="Full name"
          value={data.nameOfPersonnel}
          onChange={(e) => onChange({ nameOfPersonnel: e.target.value })}
          readOnly={readOnly}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}issuedBy`}>Issued By *</Label>
          <Input
            id={`${p}issuedBy`}
            placeholder="Issuing officer"
            value={data.issuedBy}
            onChange={(e) => onChange({ issuedBy: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
        <div>
          <Label htmlFor={`${p}receivedBy`}>Received By *</Label>
          <Input
            id={`${p}receivedBy`}
            placeholder="Receiving officer"
            value={data.receivedBy}
            onChange={(e) => onChange({ receivedBy: e.target.value })}
            readOnly={readOnly}
            required
          />
        </div>
      </div>
    </div>
  );
}

// ─── Insurance Fields ──────────────────────────────────────────────────────

function InsuranceFields({
  data,
  onChange,
  idPrefix = "",
}: {
  data: BookingFormData;
  onChange: (patch: Partial<BookingFormData>) => void;
  idPrefix?: string;
}) {
  const p = idPrefix;
  return (
    <div className="space-y-4 rounded-md border p-4 bg-muted/30">
      {/* <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-4 w-4" /> Issuance Details (optional)
      </p> */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}insurancePolicyNumber`}>Policy Number</Label>
          <Input
            id={`${p}insurancePolicyNumber`}
            placeholder="e.g. POL-2024-001"
            value={data.insurancePolicyNumber}
            onChange={(e) =>
              onChange({ insurancePolicyNumber: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${p}insuranceProvider`}>Provider</Label>
          <Input
            id={`${p}insuranceProvider`}
            placeholder="Insurance provider name"
            value={data.insuranceProvider}
            onChange={(e) => onChange({ insuranceProvider: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${p}insuranceCoverageStart`}>Coverage Start</Label>
          <Input
            id={`${p}insuranceCoverageStart`}
            type="date"
            max={new Date().toISOString().split("T")[0]}
            value={data.insuranceCoverageStart}
            onChange={(e) =>
              onChange({ insuranceCoverageStart: e.target.value })
            }
          />
        </div>
        <div>
          <Label htmlFor={`${p}insuranceCoverageEnd`}>Coverage End</Label>
          <Input
            id={`${p}insuranceCoverageEnd`}
            type="date"
            min={data.insuranceCoverageStart || undefined}
            max={new Date().toISOString().split("T")[0]}
            value={data.insuranceCoverageEnd}
            onChange={(e) => onChange({ insuranceCoverageEnd: e.target.value })}
          />
        </div>
      </div>
      {/* <div>
        <Label htmlFor={`${p}insuranceNotes`}>Issuance Notes</Label>
        <Textarea
          id={`${p}insuranceNotes`}
          placeholder="Any relevant issuance notes..."
          value={data.insuranceNotes}
          onChange={(e) => onChange({ insuranceNotes: e.target.value })}
          rows={2}
        />
      </div> */}
    </div>
  );
}

// ─── Create / Edit Booking Modal Form ─────────────────────────────────────

function BookingModalForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  isEdit,
}: {
  formData: BookingFormData;
  onChange: (patch: Partial<BookingFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Tabs defaultValue="core">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="core">
            <Shield className="h-4 w-4 mr-1" /> Booking Info
          </TabsTrigger>
          {/* <TabsTrigger value="insurance">
            <ShieldCheck className="h-4 w-4 mr-1" /> Issuance
          </TabsTrigger> */}
        </TabsList>

        <TabsContent value="core" className="space-y-4 pt-2">
          <CoreFields
            data={formData}
            onChange={onChange}
            idPrefix={isEdit ? "edit-" : "create-"}
          />
        </TabsContent>

        <TabsContent value="insurance" className="pt-2">
          <InsuranceFields
            data={formData}
            onChange={onChange}
            idPrefix={isEdit ? "edit-" : "create-"}
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

// ─── Return Modal Form ─────────────────────────────────────────────────────
// Shows ALL booking fields (pre-filled, editable) + return-specific fields

function ReturnModalForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  bookingNumber,
  isSubmitting,
}: {
  formData: ReturnFormData;
  onChange: (patch: Partial<ReturnFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  bookingNumber: string;
  isSubmitting: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ── Section: Booking Details (pre-filled, editable) ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Booking Details
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          These fields are pre-filled from the original booking. Amend if needed
          before saving the return.
        </p>
        <div className="rounded-md border bg-muted/20 p-4">
          <CoreFields
            data={formData}
            onChange={onChange}
            idPrefix="return-booking-"
          />
        </div>
      </div>

      <Separator />

      {/* ── Section: Return Details ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Return Details
          </h3>
        </div>
        <div className="space-y-4 rounded-md border p-4 bg-muted/20">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returnedBy">Returned By *</Label>
              <Input
                id="returnedBy"
                placeholder="Name of returning officer"
                value={formData.returnedBy}
                onChange={(e) => onChange({ returnedBy: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="returnReceivedBy">Received By *</Label>
              <Input
                id="returnReceivedBy"
                placeholder="Name of receiving officer"
                value={formData.returnReceivedBy}
                onChange={(e) => onChange({ returnReceivedBy: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="returnDate">Return Date *</Label>
              <Input
                id="returnDate"
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={formData.returnDate}
                onChange={(e) => onChange({ returnDate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="ammunitionReturned">Ammunition Returned *</Label>
              <Input
                id="ammunitionReturned"
                type="number"
                min="0"
                value={formData.ammunitionReturned}
                onChange={(e) =>
                  onChange({
                    ammunitionReturned: parseInt(e.target.value) || 0,
                  })
                }
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="conditionOnReturn">Condition on Return *</Label>
            <Select
              value={formData.conditionOnReturn}
              onValueChange={(v) =>
                onChange({
                  conditionOnReturn: v as ReturnFormData["conditionOnReturn"],
                })
              }
            >
              <SelectTrigger id="conditionOnReturn">
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
            <Label htmlFor="returnNotes">Return Notes</Label>
            <Textarea
              id="returnNotes"
              placeholder="Notes about the returned weapon or ammunition..."
              value={formData.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving Return...
            </>
          ) : (
            <>
              <PackageCheck className="h-4 w-4 mr-2" /> Save Return
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ─── View Record Modal ─────────────────────────────────────────────────────

function ViewRecordModal({
  booking,
  open,
  onOpenChange,
}: {
  booking: RifleBooking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!booking) return null;

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
            {/* <TabsTrigger value="insurance">
              <ShieldCheck className="h-4 w-4 mr-1" /> Issuance
            </TabsTrigger> */}
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
                No issuance information available
              </p>
            )}
          </TabsContent>

          <TabsContent value="return" className="space-y-4 pt-4">
            {booking.weaponReturn?.returnDate ? (
              <>
                {/* Booking snapshot saved at return time */}
                <div className="rounded-md border bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Booking Details at Return
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Type of Rifle
                      </Label>
                      <p>
                        {booking.weaponReturn.typeOfRifle ||
                          booking.typeOfRifle}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Rifle Number
                      </Label>
                      <p>
                        {booking.weaponReturn.rifleNumber ||
                          booking.rifleNumber}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Serial Number
                      </Label>
                      <p className="font-mono">
                        {booking.weaponReturn.serialNumber ||
                          booking.serialNumber}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        SD Number
                      </Label>
                      <p>{booking.weaponReturn.sdNumber || booking.sdNumber}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Ammunition Type
                      </Label>
                      <p>
                        {booking.weaponReturn.ammunitionType ||
                          booking.ammunitionType}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Ammo Issued
                      </Label>
                      <p>
                        {booking.weaponReturn.numberOfAmmunition ??
                          booking.numberOfAmmunition}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Type of Duty
                      </Label>
                      <p>
                        {booking.weaponReturn.typeOfDuty || booking.typeOfDuty}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Personnel
                      </Label>
                      <p>
                        {booking.weaponReturn.nameOfPersonnel ||
                          booking.nameOfPersonnel}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Issued By
                      </Label>
                      <p>{booking.weaponReturn.issuedBy || booking.issuedBy}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">
                        Received By
                      </Label>
                      <p>
                        {booking.weaponReturn.receivedBy || booking.receivedBy}
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Returned By</Label>
                    <p>{booking.weaponReturn.returnedBy || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Received By (Return)
                    </Label>
                    <p>{booking.weaponReturn.returnReceivedBy || "—"}</p>
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
                  <div className="mt-1">
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

// ─── Main Page Content ─────────────────────────────────────────────────────

function RifleBookingContent() {
  const { stationParam } = useStation();
  const [bookings, setBookings] = useState<RifleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isReturnSubmitting, setIsReturnSubmitting] = useState(false);
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

  const [bookingForm, setBookingForm] =
    useState<BookingFormData>(EMPTY_BOOKING_FORM);
  const [returnForm, setReturnForm] =
    useState<ReturnFormData>(EMPTY_RETURN_FORM);

  const deferredSearch = useDeferredValue(searchTerm);
  useSearchParams();

  const patchBookingForm = useCallback((patch: Partial<BookingFormData>) => {
    setBookingForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchReturnForm = useCallback((patch: Partial<ReturnFormData>) => {
    setReturnForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setIsSearching(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });
      if (deferredSearch) params.append("search", deferredSearch);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (stationParam) params.append("stationId", stationParam);

      const res = await fetch(`/api/rifle-bookings?${params}`);
      const data = (await res.json()) as {
        bookings: RifleBooking[];
        pagination: Pagination;
        error?: string;
      };

      if (res.ok) {
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
  }, [currentPage, deferredSearch, statusFilter, stationParam]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const resetBookingForm = () => {
    setBookingForm(EMPTY_BOOKING_FORM);
    setSelectedBooking(null);
  };
  const resetReturnForm = () => {
    setReturnForm(EMPTY_RETURN_FORM);
    setSelectedBooking(null);
  };

  const openEditModal = (booking: RifleBooking) => {
    setSelectedBooking(booking);
    setBookingForm(bookingToEditForm(booking));
    setIsEditOpen(true);
  };

  const openViewModal = (booking: RifleBooking) => {
    setSelectedBooking(booking);
    setIsViewOpen(true);
  };

  const openReturnModal = (booking: RifleBooking) => {
    setSelectedBooking(booking);
    setReturnForm(bookingToReturnForm(booking));
    setIsReturnOpen(true);
  };

  // ── Create / Update booking ──────────────────────────────────────────────
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const insurance: IInsurance = {};
    if (bookingForm.insurancePolicyNumber)
      insurance.policyNumber = bookingForm.insurancePolicyNumber;
    if (bookingForm.insuranceProvider)
      insurance.provider = bookingForm.insuranceProvider;
    if (bookingForm.insuranceCoverageStart)
      insurance.coverageStartDate = bookingForm.insuranceCoverageStart;
    if (bookingForm.insuranceCoverageEnd)
      insurance.coverageEndDate = bookingForm.insuranceCoverageEnd;
    if (bookingForm.insuranceNotes)
      insurance.notes = bookingForm.insuranceNotes;

    const payload = {
      ...(stationParam && { stationId: stationParam }),
      typeOfRifle: bookingForm.typeOfRifle,
      rifleNumber: bookingForm.rifleNumber,
      serialNumber: bookingForm.serialNumber,
      sdNumber: bookingForm.sdNumber,
      ammunitionType: bookingForm.ammunitionType,
      numberOfAmmunition: bookingForm.numberOfAmmunition,
      dateOfBooking: bookingForm.dateOfBooking,
      typeOfDuty: bookingForm.typeOfDuty,
      nameOfPersonnel: bookingForm.nameOfPersonnel,
      issuedBy: bookingForm.issuedBy,
      receivedBy: bookingForm.receivedBy,
      insurance,
    };

    const url = selectedBooking
      ? `/api/rifle-bookings/${selectedBooking._id}`
      : "/api/rifle-bookings";
    const method = selectedBooking ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (res.ok) {
        toast.success(
          data.message ??
            `Booking ${selectedBooking ? "updated" : "created"} successfully`,
        );
        await fetchBookings();
        setIsCreateOpen(false);
        setIsEditOpen(false);
        resetBookingForm();
      } else {
        toast.error(data.error ?? "Failed to save booking");
      }
    } catch {
      toast.error("Failed to save booking");
    }
  };

  // ── Save return ──────────────────────────────────────────────────────────
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setIsReturnSubmitting(true);

    // Build weaponReturn payload — includes all booking fields as a snapshot
    const weaponReturn: IWeaponReturn = {
      // Booking snapshot fields
      typeOfRifle: returnForm.typeOfRifle,
      rifleNumber: returnForm.rifleNumber,
      serialNumber: returnForm.serialNumber,
      sdNumber: returnForm.sdNumber,
      ammunitionType: returnForm.ammunitionType,
      numberOfAmmunition: returnForm.numberOfAmmunition,
      dateOfBooking: returnForm.dateOfBooking,
      typeOfDuty: returnForm.typeOfDuty,
      nameOfPersonnel: returnForm.nameOfPersonnel,
      issuedBy: returnForm.issuedBy,
      receivedBy: returnForm.receivedBy,
      // Return-specific fields
      returnedBy: returnForm.returnedBy,
      returnReceivedBy: returnForm.returnReceivedBy,
      returnDate: returnForm.returnDate,
      ammunitionReturned: returnForm.ammunitionReturned,
      ...(returnForm.conditionOnReturn && {
        conditionOnReturn: returnForm.conditionOnReturn,
      }),
      notes: returnForm.notes,
    };

    try {
      const res = await fetch(`/api/rifle-bookings/${selectedBooking._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weaponReturn,
          status: "returned",
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (res.ok) {
        toast.success(data.message ?? "Return recorded successfully");
        await fetchBookings();
        setIsReturnOpen(false);
        resetReturnForm();
      } else {
        toast.error(data.error ?? "Failed to record return");
      }
    } catch {
      toast.error("Failed to record return");
    } finally {
      setIsReturnSubmitting(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rifle booking?")) return;
    try {
      const res = await fetch(`/api/rifle-bookings/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (res.ok) {
        toast.success(data.message ?? "Booking deleted");
        await fetchBookings();
      } else {
        toast.error(data.error ?? "Failed to delete booking");
      }
    } catch {
      toast.error("Failed to delete booking");
    }
  };

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
            Manage rifle assignments, and returns
          </p>
        </div>

        {/* Create Booking Dialog */}
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetBookingForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={resetBookingForm}>
              <Plus className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Rifle Booking</DialogTitle>
            </DialogHeader>
            <BookingModalForm
              formData={bookingForm}
              onChange={patchBookingForm}
              onSubmit={handleBookingSubmit}
              onCancel={() => {
                setIsCreateOpen(false);
                resetBookingForm();
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
              placeholder="Search by booking number, serial, personnel..."
              isLoading={isSearching}
            />
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
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
              Searching for: &ldquo;{searchTerm}&rdquo;
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
                    {/* <th className="text-left p-3">Issuance</th> */}
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

                      {/* Issuance cell */}
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

                      {/* Return summary cell */}
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
                                Ammo: {booking.weaponReturn.ammunitionReturned}
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

                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          {/* View */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewModal(booking)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(booking)}
                            title="Edit booking"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          {/* Return — only shown when not yet returned */}
                          {booking.status !== "returned" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReturnModal(booking)}
                              title="Record return"
                              className="text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Delete */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(booking._id)}
                            title="Delete booking"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
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
            <ChevronLeft className="h-4 w-4" /> Previous
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
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────── */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) resetBookingForm();
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
          <BookingModalForm
            formData={bookingForm}
            onChange={patchBookingForm}
            onSubmit={handleBookingSubmit}
            onCancel={() => {
              setIsEditOpen(false);
              resetBookingForm();
            }}
            isEdit
          />
        </DialogContent>
      </Dialog>

      {/* ── Return Modal ─────────────────────────────────────────────── */}
      <Dialog
        open={isReturnOpen}
        onOpenChange={(open) => {
          setIsReturnOpen(open);
          if (!open) resetReturnForm();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-600" />
              Record Weapon Return
              {selectedBooking && (
                <span className="font-mono text-muted-foreground text-sm ml-1">
                  {selectedBooking.bookingNumber}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <ReturnModalForm
            formData={returnForm}
            onChange={patchReturnForm}
            onSubmit={handleReturnSubmit}
            onCancel={() => {
              setIsReturnOpen(false);
              resetReturnForm();
            }}
            bookingNumber={selectedBooking?.bookingNumber ?? ""}
            isSubmitting={isReturnSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* ── View Modal ───────────────────────────────────────────────── */}
      <ViewRecordModal
        booking={selectedBooking}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />
    </div>
  );
}

// ─── Page Wrapper ──────────────────────────────────────────────────────────

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
