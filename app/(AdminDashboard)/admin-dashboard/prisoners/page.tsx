"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
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
import { toast } from "sonner";
import {
  Plus,
  Edit,
  Trash2,
  User,
  Calendar,
  MapPin,
  Loader2,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useSearchParams } from "next/navigation";

// ==================== Type Definitions ====================

interface Address {
  street: string;
  city: string;
  region: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface Charge {
  charge: string;
  severity: "misdemeanor" | "felony";
}

interface ArrestDetails {
  arrestDate: string;
  arrestLocation: string;
  arrestingOfficer:
    | string
    | {
        _id: string;
        fullName: string;
        email: string;
        role: string;
        stationId: string;
      }
    | null;
  otherArrestingOfficer?: string;
  charges: Charge[];
}

interface MedicalInfo {
  allergies: string[];
  medications: string[];
  medicalConditions: string[];
  lastCheckup?: string;
}

interface PersonalEffect {
  item: string;
  description: string;
  quantity: number;
  condition: string;
}

interface VisitorLog {
  visitorName: string;
  relationship: string;
  visitDate: string;
  duration: number;
  notes: string;
}

interface ReleaseDetails {
  releaseDate?: string;
  releaseType?:
    | "bail"
    | "court-order"
    | "charges-dropped"
    | "sentence-completed";
  releasedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    badgeNumber: string;
  };
  bailAmount?: number;
  notes?: string;
}

interface Case {
  _id: string;
  caseNumber: string;
  title: string;
  status: string;
}

interface Prisoner {
  _id: string;
  prisonerNumber: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  nationality: string;
  address: Address;
  phoneNumber?: string;
  emergencyContact: EmergencyContact;
  mugshot?: string | null;
  fingerprints?: string | null;
  arrestDetails: ArrestDetails;
  caseId?: Case | string | null;
  otherCase?: string;
  cellNumber: "Male" | "Female";
  status: "Jailed" | "Bailed" | "Remanded" | "Transferred";
  releaseDetails?: ReleaseDetails;
  briefNote: string;
  medicalInfo: MedicalInfo;
  personalEffects: PersonalEffect[];
  visitorLog: VisitorLog[];
  createdAt: string;
  updatedAt: string;
}

interface UserModel {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
}

interface PrisonerFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  nationality: string;
  address: Address;
  phoneNumber: string;
  emergencyContact: EmergencyContact;
  arrestDetails: {
    arrestDate: string;
    arrestLocation: string;
    /** ObjectId string, "others", or "" */
    arrestingOfficer: string;
    /** free-text name shown when arrestingOfficer === "others" */
    otherArrestingOfficer: string;
    charges: Charge[];
  };
  /** ObjectId string, "none", "others", or "" */
  caseId: string;
  /** free-text description shown when caseId === "others" */
  otherCase: string;
  cellNumber: "Male" | "Female";
  status: "Jailed" | "Bailed" | "Remanded" | "Transferred";
  briefNote: string;
  medicalInfo: {
    allergies: string[];
    medications: string[];
    medicalConditions: string[];
  };
  personalEffects: PersonalEffect[];
  mugshot: string | null;
}

// ==================== Constants ====================

const GENDERS: ("male" | "female" | "other")[] = ["male", "female", "other"];
const STATUSES: ("Jailed" | "Bailed" | "Remanded" | "Transferred")[] = [
  "Jailed",
  "Bailed",
  "Remanded",
  "Transferred",
];
const CELL_NUMBERS: ("Male" | "Female")[] = ["Male", "Female"];

const getToken = (): string | null => localStorage.getItem("token");

const getStatusColor = (status: Prisoner["status"]): string => {
  const colors: Record<Prisoner["status"], string> = {
    Jailed: "bg-red-100 text-red-800",
    Bailed: "bg-green-100 text-green-800",
    Remanded: "bg-blue-100 text-blue-800",
    Transferred: "bg-purple-100 text-purple-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

// ==================== Custom Debounce Hook ====================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// ==================== Default form state ====================

const defaultForm = (): PrisonerFormData => ({
  firstName: "",
  lastName: "",
  middleName: "",
  dateOfBirth: "",
  gender: "male",
  nationality: "Ghanaian",
  address: { street: "", city: "", region: "" },
  phoneNumber: "",
  emergencyContact: { name: "", relationship: "", phone: "" },
  arrestDetails: {
    arrestDate: "",
    arrestLocation: "",
    arrestingOfficer: "",
    otherArrestingOfficer: "",
    charges: [],
  },
  caseId: "",
  otherCase: "",
  cellNumber: "Male",
  status: "Jailed",
  briefNote: "",
  medicalInfo: { allergies: [], medications: [], medicalConditions: [] },
  personalEffects: [],
  mugshot: null,
});

// ==================== Shared Form Fields Component ====================

interface PrisonerFormFieldsProps {
  formData: PrisonerFormData;
  setFormData: React.Dispatch<React.SetStateAction<PrisonerFormData>>;
  users: UserModel[];
  cases: Case[];
  uploadingImage: boolean;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isEdit?: boolean;
}

const PrisonerFormFields = ({
  formData,
  setFormData,
  users,
  cases,
  uploadingImage,
  handleImageUpload,
  isEdit = false,
}: PrisonerFormFieldsProps) => {
  const prefix = isEdit ? "edit-" : "";
  const isOtherOfficer = formData.arrestDetails.arrestingOfficer === "others";
  const isOtherCase = formData.caseId === "others";

  return (
    <div className="space-y-4">
      {/* ── Image Upload ── */}
      {!isEdit && (
        <div>
          <Label>Inmate Photo (Max 5MB)</Label>
          <div className="mt-2">
            {formData.mugshot && (
              <div className="mb-4">
                <img
                  src={formData.mugshot}
                  alt="Inmate photo"
                  className="w-24 h-24 rounded-lg object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData((p) => ({ ...p, mugshot: null }))}
                  className="mt-2"
                >
                  Remove Image
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="flex-1"
              />
              {uploadingImage && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>
        </div>
      )}

      {/* ── Photo for edit modal ── */}
      {isEdit && (
        <div>
          <Label>Inmate Photo (Max 5MB)</Label>
          <div className="mt-2">
            {formData.mugshot && (
              <div className="mb-4">
                <img
                  src={formData.mugshot}
                  alt="Inmate photo"
                  className="w-24 h-24 rounded-lg object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData((p) => ({ ...p, mugshot: null }))}
                  className="mt-2"
                >
                  Remove Image
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="flex-1"
              />
              {uploadingImage && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>
        </div>
      )}

      {/* ── Name ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}firstName`}>First Name *</Label>
          <Input
            id={`${prefix}firstName`}
            value={formData.firstName}
            onChange={(e) =>
              setFormData((p) => ({ ...p, firstName: e.target.value }))
            }
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}lastName`}>Last Name *</Label>
          <Input
            id={`${prefix}lastName`}
            value={formData.lastName}
            onChange={(e) =>
              setFormData((p) => ({ ...p, lastName: e.target.value }))
            }
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}middleName`}>Middle Name</Label>
          <Input
            id={`${prefix}middleName`}
            value={formData.middleName}
            onChange={(e) =>
              setFormData((p) => ({ ...p, middleName: e.target.value }))
            }
          />
        </div>
      </div>

      {/* ── Personal Info ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}dateOfBirth`}>Date of Birth *</Label>
          <Input
            id={`${prefix}dateOfBirth`}
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) =>
              setFormData((p) => ({ ...p, dateOfBirth: e.target.value }))
            }
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}gender`}>Gender *</Label>
          <Select
            value={formData.gender}
            onValueChange={(value: "male" | "female" | "other") =>
              setFormData((p) => ({ ...p, gender: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}phoneNumber`}>Phone Number</Label>
          <Input
            id={`${prefix}phoneNumber`}
            value={formData.phoneNumber}
            onChange={(e) =>
              setFormData((p) => ({ ...p, phoneNumber: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}cellNumber`}>Cell Type *</Label>
          <Select
            value={formData.cellNumber}
            onValueChange={(value: "Male" | "Female") =>
              setFormData((p) => ({ ...p, cellNumber: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CELL_NUMBERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Address ── */}
      <div>
        <Label>Address</Label>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <Input
            placeholder="Street"
            value={formData.address.street}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                address: { ...p.address, street: e.target.value },
              }))
            }
          />
          <Input
            placeholder="City"
            value={formData.address.city}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                address: { ...p.address, city: e.target.value },
              }))
            }
          />
          <Input
            placeholder="Region"
            value={formData.address.region}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                address: { ...p.address, region: e.target.value },
              }))
            }
          />
        </div>
      </div>

      {/* ── Arrest Details ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}arrestDate`}>Arrest Date *</Label>
          <Input
            id={`${prefix}arrestDate`}
            type="date"
            value={formData.arrestDetails.arrestDate}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                arrestDetails: {
                  ...p.arrestDetails,
                  arrestDate: e.target.value,
                },
              }))
            }
            required
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}arrestLocation`}>Arrest Location *</Label>
          <Input
            id={`${prefix}arrestLocation`}
            value={formData.arrestDetails.arrestLocation}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                arrestDetails: {
                  ...p.arrestDetails,
                  arrestLocation: e.target.value,
                },
              }))
            }
            required
          />
        </div>
      </div>

      {/* ── Arresting Officer (with Others) ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}arrestingOfficer`}>
            Arresting Officer *
          </Label>
          <Select
            value={formData.arrestDetails.arrestingOfficer}
            onValueChange={(value) =>
              setFormData((p) => ({
                ...p,
                arrestDetails: {
                  ...p.arrestDetails,
                  arrestingOfficer: value,
                  // Clear the free-text field when switching back to a real officer
                  otherArrestingOfficer:
                    value === "others"
                      ? p.arrestDetails.otherArrestingOfficer
                      : "",
                },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select arresting officer" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.fullName} ({u.role.toUpperCase()})
                </SelectItem>
              ))}
              {/* ── Others option ── */}
              <SelectItem value="others">Others</SelectItem>
            </SelectContent>
          </Select>

          {/* Free-text field revealed when "Others" is selected */}
          {isOtherOfficer && (
            <Input
              placeholder="Enter arresting officer name"
              value={formData.arrestDetails.otherArrestingOfficer}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  arrestDetails: {
                    ...p.arrestDetails,
                    otherArrestingOfficer: e.target.value,
                  },
                }))
              }
              required
              autoFocus
            />
          )}
        </div>

        {/* ── Related Case (with Others) ── */}
        <div className="space-y-2">
          <Label htmlFor={`${prefix}relatedCase`}>Related Case</Label>
          <Select
            value={formData.caseId || "none"}
            onValueChange={(value) =>
              setFormData((p) => ({
                ...p,
                caseId: value,
                // Clear free-text when switching away from "others"
                otherCase: value === "others" ? p.otherCase : "",
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select case" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.caseNumber} – {c.title}
                </SelectItem>
              ))}
              {/* ── Others option ── */}
              <SelectItem value="others">Others</SelectItem>
            </SelectContent>
          </Select>

          {/* Free-text field revealed when "Others" is selected */}
          {isOtherCase && (
            <Input
              placeholder="Enter case reference / description"
              value={formData.otherCase}
              onChange={(e) =>
                setFormData((p) => ({ ...p, otherCase: e.target.value }))
              }
              autoFocus
            />
          )}
        </div>
      </div>

      {/* ── Status ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${prefix}status`}>Status *</Label>
          <Select
            value={formData.status}
            onValueChange={(value: Prisoner["status"]) =>
              setFormData((p) => ({ ...p, status: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Brief Note ── */}
      <div>
        <Label htmlFor={`${prefix}briefNote`}>Brief Note (Optional)</Label>
        <textarea
          id={`${prefix}briefNote`}
          className="w-full p-2 border rounded-md"
          rows={3}
          placeholder="Add any additional notes about the inmate..."
          value={formData.briefNote}
          onChange={(e) =>
            setFormData((p) => ({ ...p, briefNote: e.target.value }))
          }
        />
      </div>

      {/* ── Emergency Contact ── */}
      <div>
        <Label>Emergency Contact</Label>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <Input
            placeholder="Name"
            value={formData.emergencyContact.name}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                emergencyContact: {
                  ...p.emergencyContact,
                  name: e.target.value,
                },
              }))
            }
          />
          <Input
            placeholder="Relationship"
            value={formData.emergencyContact.relationship}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                emergencyContact: {
                  ...p.emergencyContact,
                  relationship: e.target.value,
                },
              }))
            }
          />
          <Input
            placeholder="Phone"
            value={formData.emergencyContact.phone}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                emergencyContact: {
                  ...p.emergencyContact,
                  phone: e.target.value,
                },
              }))
            }
          />
        </div>
      </div>

      {/* ── Medical Information ── */}
      <div>
        <Label>Medical Information</Label>
        <div className="grid grid-cols-1 gap-4 mt-2">
          <Input
            placeholder="Allergies (comma-separated)"
            value={formData.medicalInfo.allergies.join(", ")}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                medicalInfo: {
                  ...p.medicalInfo,
                  allergies: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
          <Input
            placeholder="Medications (comma-separated)"
            value={formData.medicalInfo.medications.join(", ")}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                medicalInfo: {
                  ...p.medicalInfo,
                  medications: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
          <Input
            placeholder="Medical Conditions (comma-separated)"
            value={formData.medicalInfo.medicalConditions.join(", ")}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                medicalInfo: {
                  ...p.medicalInfo,
                  medicalConditions: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              }))
            }
          />
        </div>
      </div>
    </div>
  );
};

// ==================== Main Component ====================

const PrisonersContent = () => {
  useSearchParams(); // keep router sync

  // Data state
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [users, setUsers] = useState<UserModel[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<Prisoner["status"] | "all">(
    "all",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPrisoner, setSelectedPrisoner] = useState<Prisoner | null>(
    null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);

  // Shared form state
  const [formData, setFormData] = useState<PrisonerFormData>(defaultForm());

  const debouncedSearchTerm = useDebounce(searchInput, 500);

  // ── Fetch helpers ──

  const fetchPrisoners = useCallback(async () => {
    try {
      setSearching(true);
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });
      if (debouncedSearchTerm.trim())
        params.append("search", debouncedSearchTerm.trim());
      if (statusFilter && statusFilter !== "all")
        params.append("status", statusFilter);

      const response = await fetch(`/api/prisoners?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPrisoners(data.prisoners || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalResults(data.pagination?.total || 0);
      } else {
        throw new Error("Failed to fetch persons detained");
      }
    } catch (error) {
      console.error("Fetch prisoners error:", error);
      toast.error("Failed to fetch persons detained");
      setPrisoners([]);
      setTotalPages(1);
      setTotalResults(0);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, [currentPage, debouncedSearchTerm, statusFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/users/arresting-officers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch arresting officers:", error);
    }
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/cases?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCases(data.cases || []);
      }
    } catch (error) {
      console.error("Failed to fetch cases:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchCases();
  }, [fetchUsers, fetchCases]);
  useEffect(() => {
    fetchPrisoners();
  }, [fetchPrisoners]);
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  // ── Image upload ──

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      e.target.value = "";
      return;
    }

    try {
      setUploadingImage(true);
      const fd = new FormData();
      fd.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: fd });
      if (response.ok) {
        const data = await response.json();
        setFormData((p) => ({ ...p, mugshot: data.url }));
        toast.success("Image uploaded successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to upload image");
      }
      e.target.value = "";
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
      e.target.value = "";
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Submit (create / update) ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side guard: officer must be supplied
    const hasOfficerId =
      formData.arrestDetails.arrestingOfficer &&
      formData.arrestDetails.arrestingOfficer !== "others";
    const hasOtherOfficer =
      !!formData.arrestDetails.otherArrestingOfficer.trim();
    if (!hasOfficerId && !hasOtherOfficer) {
      toast.error(
        "Please select an arresting officer or enter a name under 'Others'.",
      );
      return;
    }

    try {
      const token = getToken();
      const url = selectedPrisoner
        ? `/api/prisoners/${selectedPrisoner._id}`
        : "/api/prisoners";
      const method = selectedPrisoner ? "PUT" : "POST";

      const dataToSend = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        dateOfBirth: formData.dateOfBirth
          ? new Date(formData.dateOfBirth).toISOString()
          : undefined,
        gender: formData.gender,
        nationality: formData.nationality,
        address: formData.address,
        phoneNumber: formData.phoneNumber || undefined,
        emergencyContact: formData.emergencyContact,
        arrestDetails: {
          arrestDate: formData.arrestDetails.arrestDate
            ? new Date(formData.arrestDetails.arrestDate).toISOString()
            : undefined,
          arrestLocation: formData.arrestDetails.arrestLocation,
          // Send ObjectId or null
          arrestingOfficer: hasOfficerId
            ? formData.arrestDetails.arrestingOfficer
            : null,
          // Send free-text only when "others"
          otherArrestingOfficer: hasOfficerId
            ? ""
            : formData.arrestDetails.otherArrestingOfficer.trim(),
          charges: formData.arrestDetails.charges,
        },
        // ObjectId, "others" sentinel, or null
        caseId:
          formData.caseId === "none" || !formData.caseId
            ? null
            : formData.caseId === "others"
              ? "others"
              : formData.caseId,
        otherCase:
          formData.caseId === "others" ? formData.otherCase.trim() : "",
        cellNumber: formData.cellNumber,
        status: formData.status,
        briefNote: formData.briefNote || undefined,
        medicalInfo: formData.medicalInfo,
        personalEffects: formData.personalEffects,
        mugshot: formData.mugshot || undefined,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        toast.success(
          `Person detained ${selectedPrisoner ? "updated" : "created"} successfully`,
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchPrisoners();
      } else {
        const err = await response.json();
        toast.error(err.error || "Operation failed");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Operation failed");
    }
  };

  // ── Delete ──

  const handleDelete = async (prisonerId: string) => {
    if (
      !confirm("Are you sure you want to delete this person detained record?")
    )
      return;
    try {
      const token = getToken();
      const response = await fetch(`/api/prisoners/${prisonerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success("Person detained deleted successfully");
        fetchPrisoners();
      } else {
        toast.error("Failed to delete person detained");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete person detained");
    }
  };

  // ── Reset form ──

  const resetForm = () => {
    setFormData(defaultForm());
    setSelectedPrisoner(null);
  };

  // ── Open edit modal ──

  const openEditModal = (prisoner: Prisoner) => {
    setSelectedPrisoner(prisoner);

    // Determine the arrestingOfficer value for the Select
    let officerSelectValue = "";
    if (
      prisoner.arrestDetails?.arrestingOfficer &&
      typeof prisoner.arrestDetails.arrestingOfficer === "object"
    ) {
      officerSelectValue = prisoner.arrestDetails.arrestingOfficer._id;
    } else if (typeof prisoner.arrestDetails?.arrestingOfficer === "string") {
      officerSelectValue = prisoner.arrestDetails.arrestingOfficer;
    } else if (prisoner.arrestDetails?.otherArrestingOfficer) {
      officerSelectValue = "others";
    }

    // Determine the caseId value for the Select
    let caseSelectValue = "";
    if (typeof prisoner.caseId === "object" && prisoner.caseId?._id) {
      caseSelectValue = prisoner.caseId._id;
    } else if (prisoner.otherCase) {
      caseSelectValue = "others";
    }

    setFormData({
      firstName: prisoner.firstName,
      lastName: prisoner.lastName,
      middleName: prisoner.middleName || "",
      dateOfBirth: prisoner.dateOfBirth
        ? prisoner.dateOfBirth.split("T")[0]
        : "",
      gender: prisoner.gender,
      nationality: prisoner.nationality || "Ghanaian",
      address: prisoner.address || { street: "", city: "", region: "" },
      phoneNumber: prisoner.phoneNumber || "",
      emergencyContact: prisoner.emergencyContact || {
        name: "",
        relationship: "",
        phone: "",
      },
      arrestDetails: {
        arrestDate: prisoner.arrestDetails?.arrestDate
          ? prisoner.arrestDetails.arrestDate.split("T")[0]
          : "",
        arrestLocation: prisoner.arrestDetails?.arrestLocation || "",
        arrestingOfficer: officerSelectValue,
        otherArrestingOfficer:
          prisoner.arrestDetails?.otherArrestingOfficer || "",
        charges: prisoner.arrestDetails?.charges || [],
      },
      caseId: caseSelectValue,
      otherCase: prisoner.otherCase || "",
      cellNumber: prisoner.cellNumber || "Male",
      status: prisoner.status || "Jailed",
      briefNote: prisoner.briefNote || "",
      medicalInfo: prisoner.medicalInfo || {
        allergies: [],
        medications: [],
        medicalConditions: [],
      },
      personalEffects: prisoner.personalEffects || [],
      mugshot: prisoner.mugshot || null,
    });
    setIsEditModalOpen(true);
  };

  // ── Filter helpers ──

  const clearAllFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const clearSearch = () => setSearchInput("");

  const showEmptyState = useMemo(() => {
    if (loading) return false;
    if (prisoners.length === 0) {
      if (searchInput.trim() || (statusFilter && statusFilter !== "all"))
        return "no-results";
      return "no-data";
    }
    return false;
  }, [loading, prisoners.length, searchInput, statusFilter]);

  const hasActiveFilters = useMemo(
    () => searchInput.trim() !== "" || (statusFilter && statusFilter !== "all"),
    [searchInput, statusFilter],
  );

  // ── Helper: display officer name in table ──

  const getOfficerDisplay = (prisoner: Prisoner): string => {
    const ad = prisoner.arrestDetails;
    if (!ad) return "—";
    if (ad.arrestingOfficer && typeof ad.arrestingOfficer === "object") {
      return ad.arrestingOfficer.fullName;
    }
    if (ad.otherArrestingOfficer) return ad.otherArrestingOfficer;
    return "—";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-12">
      {/* ── Header ── */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          Person Detained or Inmate Management
        </h1>

        {/* Create Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Person Detained
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Person Detained</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <PrisonerFormFields
                formData={formData}
                setFormData={setFormData}
                users={users}
                cases={cases}
                uploadingImage={uploadingImage}
                handleImageUpload={handleImageUpload}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Person Detained Record</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="flex-1 min-w-75">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, prisoner number, or cell..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={searching}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={searching}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {searching && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Status filter */}
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) =>
                  setStatusFilter(value as Prisoner["status"] | "all")
                }
              >
                <SelectTrigger className="w-45">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {totalResults} result{totalResults !== 1 ? "s" : ""} found
                    {searchInput.trim() && ` for "${searchInput.trim()}"`}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Table or Empty State ── */}
      {showEmptyState ? (
        showEmptyState === "no-results" ? (
          <EmptyState
            type="no-results"
            title="No persons detained found"
            description="No persons detained match your current search criteria. Try adjusting your filters or search terms."
            searchTerm={searchInput}
            actionLabel="Clear filters"
            onAction={clearAllFilters}
          />
        ) : (
          <EmptyState
            type="no-data"
            title="No persons detained yet"
            description="Get started by adding your first person detained record."
            actionLabel="Add first record"
            onAction={() => setIsCreateModalOpen(true)}
          />
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Persons Detained ({totalResults})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Photo</th>
                    <th className="text-left p-2">Record ID</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Cell Type</th>
                    <th className="text-left p-2">Arrest Date</th>
                    <th className="text-left p-2">Arresting Officer</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Related Case</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prisoners.map((prisoner) => (
                    <tr
                      key={prisoner._id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-2">
                        {prisoner.mugshot ? (
                          <img
                            src={prisoner.mugshot}
                            alt={`${prisoner.firstName} ${prisoner.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="p-2 font-mono text-sm">
                        {prisoner.prisonerNumber}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>
                            {prisoner.firstName} {prisoner.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{prisoner.cellNumber}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {new Date(
                              prisoner.arrestDetails?.arrestDate,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      {/* ── Officer column shows free-text when "Others" was used ── */}
                      <td className="p-2 text-sm">
                        {getOfficerDisplay(prisoner)}
                      </td>
                      <td className="p-2">
                        <Badge className={getStatusColor(prisoner.status)}>
                          {prisoner.status}
                        </Badge>
                      </td>
                      {/* ── Case column shows free-text when "Others" was used ── */}
                      <td className="p-2">
                        {prisoner.caseId &&
                        typeof prisoner.caseId === "object" ? (
                          <span className="text-sm font-mono">
                            {prisoner.caseId.caseNumber}
                          </span>
                        ) : prisoner.otherCase ? (
                          <span className="text-sm italic text-gray-600">
                            {prisoner.otherCase}
                          </span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(prisoner)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(prisoner._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages} ({totalResults} total
                  results)
                </div>
                <div className="flex space-x-2">
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
      )}

      {/* ── Edit Modal ── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Person Detained Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PrisonerFormFields
              formData={formData}
              setFormData={setFormData}
              users={users}
              cases={cases}
              uploadingImage={uploadingImage}
              handleImageUpload={handleImageUpload}
              isEdit
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Person Detained Record</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== Page Export ====================

const PrisonersPage = () => (
  <Suspense
    fallback={
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }
  >
    <PrisonersContent />
  </Suspense>
);

export default PrisonersPage;
