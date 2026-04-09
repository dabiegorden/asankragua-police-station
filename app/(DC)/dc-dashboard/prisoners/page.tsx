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
      };
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

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string; // Add this
  email: string;
  role: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
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
    arrestingOfficer: string;
    charges: Charge[];
  };
  caseId: string;
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
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ==================== Main Component ====================

const PrisonersContent = () => {
  const searchParams = useSearchParams();

  // State
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Search and filter state
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

  // Form state
  const [formData, setFormData] = useState<PrisonerFormData>({
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
      charges: [],
    },
    caseId: "",
    cellNumber: "Male",
    status: "Jailed",
    briefNote: "",
    medicalInfo: { allergies: [], medications: [], medicalConditions: [] },
    personalEffects: [],
    mugshot: null,
  });

  // Debounce search input
  const debouncedSearchTerm = useDebounce(searchInput, 500);

  // Fetch prisoners with proper dependency management
  const fetchPrisoners = useCallback(async () => {
    try {
      setSearching(true);
      const token = getToken();

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      // Only add search param if there's a search term
      if (debouncedSearchTerm.trim()) {
        params.append("search", debouncedSearchTerm.trim());
      }

      // Only add status filter if it's not "all"
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }

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

  // Fetch users (officers)
  const fetchUsers = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/users/arresting-officers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched arresting officers:", data.users);
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch arresting officers:", error);
    }
  }, []);

  // Fetch cases
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

  // Initial load - fetch users and cases only once
  useEffect(() => {
    fetchUsers();
    fetchCases();
  }, [fetchUsers, fetchCases]);

  // Fetch prisoners when dependencies change
  useEffect(() => {
    fetchPrisoners();
  }, [fetchPrisoners]);

  // Reset to page 1 when search term or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  // Image upload handler
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
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataToSend,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({
          ...prev,
          mugshot: data.url,
        }));
        toast.success("Image uploaded successfully");
        e.target.value = "";
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to upload image");
        e.target.value = "";
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
      e.target.value = "";
    } finally {
      setUploadingImage(false);
    }
  };

  // Submit handler for create/update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          arrestingOfficer: formData.arrestDetails.arrestingOfficer,
          charges: formData.arrestDetails.charges,
        },
        caseId:
          formData.caseId === "none" || !formData.caseId
            ? null
            : formData.caseId,
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
        const error = await response.json();
        toast.error(error.error || "Operation failed");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Operation failed");
    }
  };

  // Delete handler
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

  // Reset form
  const resetForm = () => {
    setFormData({
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
        charges: [],
      },
      caseId: "",
      cellNumber: "Male",
      status: "Jailed",
      briefNote: "",
      medicalInfo: { allergies: [], medications: [], medicalConditions: [] },
      personalEffects: [],
      mugshot: null,
    });
    setSelectedPrisoner(null);
  };

  // Open edit modal
  const openEditModal = (prisoner: Prisoner) => {
    setSelectedPrisoner(prisoner);
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
        arrestingOfficer:
          typeof prisoner.arrestDetails?.arrestingOfficer === "string"
            ? prisoner.arrestDetails.arrestingOfficer
            : prisoner.arrestDetails?.arrestingOfficer?._id || "",
        charges: prisoner.arrestDetails?.charges || [],
      },
      caseId:
        typeof prisoner.caseId === "object" && prisoner.caseId?._id
          ? prisoner.caseId._id
          : "",
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

  // Clear all filters
  const clearAllFilters = () => {
    setSearchInput("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  // Clear search input
  const clearSearch = () => {
    setSearchInput("");
  };

  // Determine empty state type
  const showEmptyState = useMemo(() => {
    if (loading) return false;
    if (prisoners.length === 0) {
      if (searchInput.trim() || (statusFilter && statusFilter !== "all")) {
        return "no-results";
      }
      return "no-data";
    }
    return false;
  }, [loading, prisoners.length, searchInput, statusFilter]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return (
      searchInput.trim() !== "" || (statusFilter && statusFilter !== "all")
    );
  }, [searchInput, statusFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          Person Detained or Inmate Management
        </h1>
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
              {/* Image Upload */}
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
                        onClick={() =>
                          setFormData({ ...formData, mugshot: null })
                        }
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
                    {uploadingImage && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName}
                    onChange={(e) =>
                      setFormData({ ...formData, middleName: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Personal Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOfBirth: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value: "male" | "female" | "other") =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDERS.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, phoneNumber: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cellNumber">Cell Type *</Label>
                  <Select
                    value={formData.cellNumber}
                    onValueChange={(value: "Male" | "Female") =>
                      setFormData({ ...formData, cellNumber: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CELL_NUMBERS.map((cell) => (
                        <SelectItem key={cell} value={cell}>
                          {cell}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Address */}
              <div>
                <Label>Address</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <Input
                    placeholder="Street"
                    value={formData.address.street}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: {
                          ...formData.address,
                          street: e.target.value,
                        },
                      })
                    }
                  />
                  <Input
                    placeholder="City"
                    value={formData.address.city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: { ...formData.address, city: e.target.value },
                      })
                    }
                  />
                  <Input
                    placeholder="Region"
                    value={formData.address.region}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: {
                          ...formData.address,
                          region: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              {/* Arrest Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="arrestDate">Arrest Date *</Label>
                  <Input
                    id="arrestDate"
                    type="date"
                    value={formData.arrestDetails.arrestDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        arrestDetails: {
                          ...formData.arrestDetails,
                          arrestDate: e.target.value,
                        },
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="arrestLocation">Arrest Location *</Label>
                  <Input
                    id="arrestLocation"
                    value={formData.arrestDetails.arrestLocation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        arrestDetails: {
                          ...formData.arrestDetails,
                          arrestLocation: e.target.value,
                        },
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="arrestingOfficer">Arresting Officer *</Label>
                  <Select
                    value={formData.arrestDetails.arrestingOfficer}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        arrestDetails: {
                          ...formData.arrestDetails,
                          arrestingOfficer: value,
                        },
                      })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select arresting officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.fullName} ({user.role.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="relatedCase">Related Case</Label>
                  <Select
                    value={formData.caseId || "none"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, caseId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select case" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {cases.map((caseItem) => (
                        <SelectItem key={caseItem._id} value={caseItem._id}>
                          {caseItem.caseNumber} - {caseItem.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Prisoner["status"]) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Brief Note */}
              <div>
                <Label htmlFor="briefNote">Brief Note (Optional)</Label>
                <textarea
                  id="briefNote"
                  className="w-full p-2 border rounded-md"
                  rows={3}
                  placeholder="Add any additional notes about the inmate..."
                  value={formData.briefNote}
                  onChange={(e) =>
                    setFormData({ ...formData, briefNote: e.target.value })
                  }
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <Label>Emergency Contact</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <Input
                    placeholder="Name"
                    value={formData.emergencyContact.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: {
                          ...formData.emergencyContact,
                          name: e.target.value,
                        },
                      })
                    }
                  />
                  <Input
                    placeholder="Relationship"
                    value={formData.emergencyContact.relationship}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: {
                          ...formData.emergencyContact,
                          relationship: e.target.value,
                        },
                      })
                    }
                  />
                  <Input
                    placeholder="Phone"
                    value={formData.emergencyContact.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: {
                          ...formData.emergencyContact,
                          phone: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>

              {/* Medical Information */}
              <div>
                <Label>Medical Information</Label>
                <div className="grid grid-cols-1 gap-4 mt-2">
                  <Input
                    placeholder="Allergies (comma-separated)"
                    value={formData.medicalInfo.allergies.join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        medicalInfo: {
                          ...formData.medicalInfo,
                          allergies: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                  <Input
                    placeholder="Medications (comma-separated)"
                    value={formData.medicalInfo.medications.join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        medicalInfo: {
                          ...formData.medicalInfo,
                          medications: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                  <Input
                    placeholder="Medical Conditions (comma-separated)"
                    value={formData.medicalInfo.medicalConditions.join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        medicalInfo: {
                          ...formData.medicalInfo,
                          medicalConditions: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                  />
                </div>
              </div>

              {/* Form Actions */}
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {/* Search Input */}
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

              {/* Status Filter */}
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
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filters indicator */}
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

      {/* Table or Empty State */}
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
            description="Get started by adding your first person detained record. Record management helps you track inmates and their information."
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
                      <td className="p-2">
                        <Badge className={getStatusColor(prisoner.status)}>
                          {prisoner.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        {prisoner.caseId &&
                        typeof prisoner.caseId === "object" ? (
                          <span className="text-sm font-mono">
                            {prisoner.caseId.caseNumber}
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
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Person Detained Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image Upload */}
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
                      onClick={() =>
                        setFormData({ ...formData, mugshot: null })
                      }
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
                  {uploadingImage && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-cellNumber">Cell Type *</Label>
                <Select
                  value={formData.cellNumber}
                  onValueChange={(value: "Male" | "Female") =>
                    setFormData({ ...formData, cellNumber: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CELL_NUMBERS.map((cell) => (
                      <SelectItem key={cell} value={cell}>
                        {cell}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Prisoner["status"]) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-briefNote">Brief Note (Optional)</Label>
              <textarea
                id="edit-briefNote"
                className="w-full p-2 border rounded-md"
                rows={3}
                placeholder="Add any additional notes about the inmate..."
                value={formData.briefNote}
                onChange={(e) =>
                  setFormData({ ...formData, briefNote: e.target.value })
                }
              />
            </div>

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

const PrisonersPage = () => {
  return (
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
};

export default PrisonersPage;
