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
import { Plus, Edit, Trash2, Loader2, Upload } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { useSearchParams } from "next/navigation";

// ==================== Type Definitions ====================

type PersonnelRole =
  | "District Commander"
  | "Station Officer"
  | "Counter NCO"
  | "Counter SO";
type PersonnelRank =
  | "Constable"
  | "Lance Corporal"
  | "Sergeant"
  | "Inspector"
  | "Chief Inspector"
  | "Aspol"
  | "Desupol"
  | "Supol"
  | "Chief Supol"
  | "Acpol"
  | "Dipol"
  | "Cop"
  | "Superintendent";
type PersonnelSpecialization =
  | "General"
  | "Traffic"
  | "Criminal Investigation"
  | "Cybercrime"
  | "Narcotics"
  | "K9 Unit"
  | "Others";
type PersonnelStatus = "active" | "on-leave" | "suspended" | "retired" | "Sick";

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

interface Certification {
  name: string;
  issuedBy: string;
  dateIssued: Date;
  expiryDate: Date;
}

interface Assignment {
  caseId: {
    _id: string;
    caseNumber: string;
    title: string;
    status: string;
  };
  assignedDate: Date;
  status: "active" | "completed";
}

interface Personnel {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: PersonnelRole;
  serviceNumber: string | null;
  rank: PersonnelRank;
  specialization: PersonnelSpecialization;
  phoneNumber: string;
  emergencyContact: EmergencyContact;
  address: Address;
  dateOfBirth: Date;
  dateJoined: Date;
  profileImage: string | null;
  status: PersonnelStatus;
  certifications: Certification[];
  assignments: Assignment[];
  createdAt: Date;
  updatedAt: Date;
}

interface PersonnelListResponse {
  personnel: Personnel[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface UploadResponse {
  url?: string;
  public_id?: string;
  error?: string;
}

interface PersonnelFormData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: PersonnelRole | "";
  serviceNumber: string;
  rank: PersonnelRank | "";
  specialization: PersonnelSpecialization;
  phoneNumber: string;
  emergencyContact: EmergencyContact;
  address: Address;
  dateOfBirth: string;
  dateJoined: string;
  profileImage: string;
  status: PersonnelStatus;
  certifications: Certification[];
}

// ==================== Constants ====================

const RANKS: PersonnelRank[] = [
  "Constable",
  "Lance Corporal",
  "Sergeant",
  "Inspector",
  "Chief Inspector",
  "Aspol",
  "Desupol",
  "Supol",
  "Chief Supol",
  "Acpol",
  "Dipol",
  "Cop",
  "Superintendent",
];

const SPECIALIZATIONS: PersonnelSpecialization[] = [
  "General",
  "Traffic",
  "Criminal Investigation",
  "Cybercrime",
  "Narcotics",
  "K9 Unit",
  "Others",
];

const STATUSES: PersonnelStatus[] = [
  "active",
  "on-leave",
  "suspended",
  "retired",
  "Sick",
];

const ROLES: PersonnelRole[] = [
  "District Commander",
  "Station Officer",
  "Counter NCO",
  "Counter SO",
];

// ==================== Helper Functions ====================

const getToken = (): string | null => localStorage.getItem("token");

const getStatusColor = (status: PersonnelStatus): string => {
  const colors: Record<PersonnelStatus, string> = {
    active: "bg-green-100 text-green-800",
    "on-leave": "bg-yellow-100 text-yellow-800",
    suspended: "bg-red-100 text-red-800",
    retired: "bg-gray-100 text-gray-800",
    Sick: "bg-orange-100 text-orange-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

const getRoleColor = (role: PersonnelRole): string => {
  const colors: Record<PersonnelRole, string> = {
    "District Commander": "bg-purple-100 text-purple-800",
    "Station Officer": "bg-blue-100 text-blue-800",
    "Counter NCO": "bg-orange-100 text-orange-800",
    "Counter SO": "bg-indigo-100 text-indigo-800",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
};

// ==================== Initial Form Data ====================

const INITIAL_FORM_DATA: PersonnelFormData = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  role: "",
  serviceNumber: "",
  rank: "",
  specialization: "General",
  phoneNumber: "",
  emergencyContact: { name: "", relationship: "", phone: "" },
  address: { street: "", city: "", state: "", zipCode: "" },
  dateOfBirth: "",
  dateJoined: "",
  profileImage: "",
  status: "active",
  certifications: [],
};

// ==================== Main Component ====================

const PersonnelContent = () => {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(
    null,
  );
  const [lastSearchTerm, setLastSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] =
    useState<PersonnelFormData>(INITIAL_FORM_DATA);

  const searchParams = useSearchParams();
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Fetch personnel with filters
  const fetchPersonnel = useCallback(
    async (searchValue: string = "", isManualSearch: boolean = false) => {
      try {
        if (isManualSearch || searchValue !== lastSearchTerm) {
          setSearching(true);
        }

        const token = getToken();
        if (!token) {
          toast.error("Authentication required");
          return;
        }

        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "10",
          ...(searchValue && { search: searchValue }),
          ...(statusFilter &&
            statusFilter !== "all" && { status: statusFilter }),
          ...(rankFilter && rankFilter !== "all" && { rank: rankFilter }),
          ...(roleFilter && roleFilter !== "all" && { role: roleFilter }),
        });

        const response = await fetch(`/api/personnel?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch personnel");
        }

        const data: PersonnelListResponse = await response.json();
        setPersonnel(data.personnel);
        setTotalPages(data.pagination.pages);
        setTotalResults(data.pagination.total);
        setLastSearchTerm(searchValue);
      } catch (error) {
        console.error("Fetch personnel error:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to fetch personnel",
        );
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    [currentPage, statusFilter, rankFilter, roleFilter, lastSearchTerm],
  );

  const handleManualSearch = useCallback(
    (searchValue: string) => {
      setCurrentPage(1);
      fetchPersonnel(searchValue, true);
    },
    [fetchPersonnel],
  );

  useEffect(() => {
    if (debouncedSearchTerm !== lastSearchTerm) {
      setCurrentPage(1);
      fetchPersonnel(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, fetchPersonnel, lastSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
    fetchPersonnel(searchTerm);
  }, [statusFilter, rankFilter, roleFilter]);

  useEffect(() => {
    fetchPersonnel(searchTerm);
  }, [currentPage]);

  useEffect(() => {
    fetchPersonnel("");
  }, []);

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      setUploading(true);
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data: UploadResponse = await response.json();
      setFormData((prev) => ({
        ...prev,
        profileImage: data.url || data.public_id || "",
      }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  // Create or update personnel
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.username ||
      !formData.role ||
      !formData.rank ||
      !formData.phoneNumber ||
      !formData.dateOfBirth
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const token = getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const url = selectedPersonnel
        ? `/api/personnel/${selectedPersonnel._id}`
        : "/api/personnel";
      const method = selectedPersonnel ? "PUT" : "POST";

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        username: formData.username,
        role: formData.role,
        rank: formData.rank,
        specialization: formData.specialization,
        phoneNumber: formData.phoneNumber,
        serviceNumber: formData.serviceNumber || null,
        dateOfBirth: new Date(formData.dateOfBirth).toISOString(),
        dateJoined: formData.dateJoined
          ? new Date(formData.dateJoined).toISOString()
          : undefined,
        status: formData.status,
        profileImage: formData.profileImage || null,
        emergencyContact: formData.emergencyContact,
        address: formData.address,
        certifications: formData.certifications,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        toast.success(
          `Personnel ${selectedPersonnel ? "updated" : "created"} successfully`,
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchPersonnel(searchTerm);
      } else {
        toast.error(responseData.error || "Operation failed");
      }
    } catch (error) {
      console.error("Personnel operation error:", error);
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (personnelId: string) => {
    if (!confirm("Are you sure you want to delete this personnel record?"))
      return;

    try {
      const token = getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const response = await fetch(`/api/personnel/${personnelId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Personnel record deleted successfully");
        fetchPersonnel(searchTerm);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete personnel record");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete personnel record");
    }
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setSelectedPersonnel(null);
  };

  const openEditModal = (personnelItem: Personnel) => {
    setSelectedPersonnel(personnelItem);
    setFormData({
      firstName: personnelItem.firstName,
      lastName: personnelItem.lastName,
      email: personnelItem.email,
      username: personnelItem.username,
      role: personnelItem.role,
      serviceNumber: personnelItem.serviceNumber || "",
      rank: personnelItem.rank,
      specialization: personnelItem.specialization,
      phoneNumber: personnelItem.phoneNumber,
      emergencyContact: personnelItem.emergencyContact || {
        name: "",
        relationship: "",
        phone: "",
      },
      address: personnelItem.address || {
        street: "",
        city: "",
        state: "",
        zipCode: "",
      },
      dateOfBirth: personnelItem.dateOfBirth
        ? new Date(personnelItem.dateOfBirth).toISOString().split("T")[0]
        : "",
      dateJoined: personnelItem.dateJoined
        ? new Date(personnelItem.dateJoined).toISOString().split("T")[0]
        : "",
      profileImage: personnelItem.profileImage || "",
      status: personnelItem.status,
      certifications: personnelItem.certifications || [],
    });
    setIsEditModalOpen(true);
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setRankFilter("");
    setRoleFilter("");
    setCurrentPage(1);
    fetchPersonnel("");
  };

  const showEmptyState = useMemo(() => {
    if (loading) return false;
    if (personnel.length === 0) {
      if (searchTerm || statusFilter || rankFilter || roleFilter)
        return "no-results";
      return "no-data";
    }
    return false;
  }, [
    loading,
    personnel.length,
    searchTerm,
    statusFilter,
    rankFilter,
    roleFilter,
  ]);

  // ─── Shared form fields ────────────────────────────────────────────────────
  const renderFormFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        {/* Basic Info */}
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
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
          />
        </div>
        <div>
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
          />
        </div>

        {/* Role & Rank */}
        <div>
          <Label htmlFor="role">Role *</Label>
          <Select
            value={formData.role}
            onValueChange={(value: PersonnelRole) =>
              setFormData({ ...formData, role: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="rank">Rank *</Label>
          <Select
            value={formData.rank}
            onValueChange={(value: PersonnelRank) =>
              setFormData({ ...formData, rank: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rank" />
            </SelectTrigger>
            <SelectContent>
              {RANKS.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Service Number (formerly Badge Number) */}
        <div>
          <Label htmlFor="serviceNumber">Service / Pin Number</Label>
          <Input
            id="serviceNumber"
            value={formData.serviceNumber}
            onChange={(e) =>
              setFormData({ ...formData, serviceNumber: e.target.value })
            }
            placeholder="e.g. SN-00123"
          />
        </div>

        {/* Specialization */}
        <div>
          <Label htmlFor="specialization">Specialization</Label>
          <Select
            value={formData.specialization}
            onValueChange={(value: PersonnelSpecialization) =>
              setFormData({ ...formData, specialization: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select specialization" />
            </SelectTrigger>
            <SelectContent>
              {SPECIALIZATIONS.map((spec) => (
                <SelectItem key={spec} value={spec}>
                  {spec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Contact */}
        <div>
          <Label htmlFor="phoneNumber">Phone Number *</Label>
          <Input
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={(e) =>
              setFormData({ ...formData, phoneNumber: e.target.value })
            }
            required
          />
        </div>

        {/* Dates */}
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
          <Label htmlFor="dateJoined">Date Joined</Label>
          <Input
            id="dateJoined"
            type="date"
            value={formData.dateJoined}
            onChange={(e) =>
              setFormData({ ...formData, dateJoined: e.target.value })
            }
          />
        </div>

        {/* Status */}
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value: PersonnelStatus) =>
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

      {/* Profile Image Upload */}
      <div>
        <Label>Profile Picture (Optional)</Label>
        <div className="space-y-2 mt-2">
          {formData.profileImage && (
            <div className="relative w-32 h-32 border border-gray-300 rounded-lg overflow-hidden">
              <img
                src={formData.profileImage}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="hidden"
              id="profile-upload"
            />
            <label htmlFor="profile-upload">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 cursor-pointer"
                disabled={uploading}
                asChild
              >
                <span>
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Photo
                    </>
                  )}
                </span>
              </Button>
            </label>
          </div>
          {formData.profileImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => setFormData({ ...formData, profileImage: "" })}
            >
              Remove Photo
            </Button>
          )}
        </div>
      </div>

      {/* Emergency Contact */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Emergency Contact</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="emergencyContactName">Name</Label>
            <Input
              id="emergencyContactName"
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
          </div>
          <div>
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
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
          </div>
          <div>
            <Label htmlFor="emergencyContactPhone">Phone</Label>
            <Input
              id="emergencyContactPhone"
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
      </div>

      {/* Address */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="street">Street</Label>
            <Input
              id="street"
              value={formData.address.street}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, street: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={formData.address.city}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={formData.address.state}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, state: e.target.value },
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              value={formData.address.zipCode}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  address: { ...formData.address, zipCode: e.target.value },
                })
              }
            />
          </div>
        </div>
      </div>
    </>
  );

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
        <h1 className="text-3xl font-bold">Personnel Management</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Personnel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Personnel</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {renderFormFields()}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Personnel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <SearchInput
              placeholder="Search by name, email, service number..."
              value={searchTerm}
              onChange={setSearchTerm}
              onSearch={handleManualSearch}
              isSearching={searching}
            />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
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
              <Select value={rankFilter} onValueChange={setRankFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by rank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ranks</SelectItem>
                  {RANKS.map((rank) => (
                    <SelectItem key={rank} value={rank}>
                      {rank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchTerm || statusFilter || rankFilter || roleFilter) && (
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {totalResults > 0 && (
        <div className="text-sm text-gray-600">
          Showing {personnel.length} of {totalResults} personnel
        </div>
      )}

      {/* Empty States */}
      {showEmptyState === "no-data" && (
        <EmptyState
          type="no-data"
          title="No personnel records"
          description="Get started by adding your first personnel record."
          actionLabel="Add Personnel"
          onAction={() => setIsCreateModalOpen(true)}
          searchTerm=""
        />
      )}

      {showEmptyState === "no-results" && (
        <EmptyState
          type="no-results"
          title="No results found"
          description="Try adjusting your search or filters."
          actionLabel="Clear Filters"
          onAction={clearAllFilters}
          searchTerm={searchTerm}
        />
      )}

      {/* Personnel Cards */}
      {!showEmptyState && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personnel.map((person) => (
            <Card key={person._id}>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200 shrink-0">
                  {person.profileImage ? (
                    <img
                      src={person.profileImage}
                      alt={`${person.firstName} ${person.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-2xl font-bold">
                      {person.firstName?.[0]}
                      {person.lastName?.[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">
                    {person.firstName} {person.lastName}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{person.rank}</p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Role:</span>
                    <Badge className={getRoleColor(person.role)}>
                      {person.role}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status:</span>
                    <Badge className={getStatusColor(person.status)}>
                      {person.status}
                    </Badge>
                  </div>
                  {person.serviceNumber && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Service No.:
                      </span>
                      <span className="text-sm font-mono">
                        {person.serviceNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm truncate max-w-40">
                      {person.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Phone:</span>
                    <span className="text-sm">{person.phoneNumber}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(person)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(person._id)}
                      className="flex-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages, prev + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Personnel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {renderFormFields()}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Update Personnel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main Page Component with Suspense
const PersonnelPage = () => {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <PersonnelContent />
    </Suspense>
  );
};

export default PersonnelPage;
