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
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { useSearchParams } from "next/navigation";

const PrisonersContent = () => {
  const searchParams = useSearchParams();
  const [prisoners, setPrisoners] = useState([]);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPrisoner, setSelectedPrisoner] = useState(null);
  const [lastSearchTerm, setLastSearchTerm] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
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

  // Debounce search term with 500ms delay
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const genders = ["male", "female", "other"];
  const statuses = ["Jailed", "Bailed", "Remanded", "Transferred"];
  const cellNumbers = ["Male", "Female"];

  const getToken = () => localStorage.getItem("token");

  const fetchPrisoners = useCallback(
    async (searchValue = "", isManualSearch = false) => {
      try {
        if (isManualSearch || searchValue !== lastSearchTerm) {
          setSearching(true);
        }

        const token = getToken();
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: "10",
          ...(searchValue && { search: searchValue }),
          ...(statusFilter &&
            statusFilter !== "all" && { status: statusFilter }),
        });

        const response = await fetch(`/api/prisoners?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setPrisoners(data.prisoners || []);
          setTotalPages(data.pagination?.pages || 1);
          setTotalResults(data.pagination?.total || 0);
          setLastSearchTerm(searchValue);
        } else {
          throw new Error("Failed to fetch persons detained");
        }
      } catch (error) {
        console.error("Fetch prisoners error:", error);
        toast.error("Failed to fetch persons detained");
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    [currentPage, statusFilter, lastSearchTerm],
  );

  const fetchUsers = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/users?role=officer", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch users");
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
      console.error("Failed to fetch cases");
    }
  }, []);

  // Handle manual search (Enter key or search button)
  const handleManualSearch = useCallback(
    (searchValue) => {
      setCurrentPage(1);
      fetchPrisoners(searchValue, true);
    },
    [fetchPrisoners],
  );

  // Handle debounced search
  useEffect(() => {
    if (debouncedSearchTerm !== lastSearchTerm) {
      setCurrentPage(1);
      fetchPrisoners(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, fetchPrisoners, lastSearchTerm]);

  // Handle filter changes
  useEffect(() => {
    setCurrentPage(1);
    fetchPrisoners(searchTerm);
  }, [statusFilter]);

  // Handle page changes
  useEffect(() => {
    fetchPrisoners(searchTerm);
  }, [currentPage]);

  // Initial load
  useEffect(() => {
    fetchUsers();
    fetchCases();
    fetchPrisoners("");
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      e.target.value = "";
      return;
    }

    // Validate file size (max 5MB)
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
        console.log("[v0] Image upload successful:", data);
        setFormData((prev) => ({
          ...prev,
          mugshot: data.url,
        }));
        toast.success("Image uploaded successfully");
        // Clear the file input
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      const url = selectedPrisoner
        ? `/api/prisoners/${selectedPrisoner._id}`
        : "/api/prisoners";
      const method = selectedPrisoner ? "PUT" : "POST";

      // Prepare data to match schema structure
      const dataToSend = {
        ...formData,
        address: formData.address || { street: "", city: "", region: "" },
        emergencyContact: formData.emergencyContact || {
          name: "",
          relationship: "",
          phone: "",
        },
        medicalInfo: formData.medicalInfo || {
          allergies: [],
          medications: [],
          medicalConditions: [],
        },
        dateOfBirth: formData.dateOfBirth
          ? new Date(formData.dateOfBirth)
          : undefined,
        arrestDetails: {
          ...formData.arrestDetails,
          arrestDate: formData.arrestDetails.arrestDate
            ? new Date(formData.arrestDetails.arrestDate)
            : undefined,
          arrestingOfficer: formData.arrestDetails.arrestingOfficer,
        },
        caseId: formData.caseId === "none" ? null : formData.caseId,
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
        fetchPrisoners(searchTerm);
      } else {
        const error = await response.json();
        toast.error(error.error || "Operation failed");
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (prisonerId) => {
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
        fetchPrisoners(searchTerm);
      } else {
        toast.error("Failed to delete person detained");
      }
    } catch (error) {
      toast.error("Failed to delete person detained");
    }
  };

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

  const openEditModal = (prisoner) => {
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
            : prisoner.arrestDetails?.arrestingOfficer?.firstName &&
                prisoner.arrestDetails?.arrestingOfficer?.lastName
              ? `${prisoner.arrestDetails.arrestingOfficer.firstName} ${prisoner.arrestDetails.arrestingOfficer.lastName}`
              : "",
        charges: prisoner.arrestDetails?.charges || [],
      },
      caseId: prisoner.caseId?._id || "",
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

  const getStatusColor = (status) => {
    const colors = {
      Jailed: "bg-red-100 text-red-800",
      Bailed: "bg-green-100 text-green-800",
      Remanded: "bg-blue-100 text-blue-800",
      Transferred: "bg-purple-100 text-purple-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setCurrentPage(1);
    fetchPrisoners("");
  };

  // Determine what to show
  const showEmptyState = useMemo(() => {
    if (loading) return false;
    if (prisoners.length === 0) {
      if (searchTerm || statusFilter) {
        return "no-results";
      }
      return "no-data";
    }
    return false;
  }, [loading, prisoners.length, searchTerm, statusFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-12">
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
                        src={formData.mugshot || "/placeholder.svg"}
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
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        firstName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
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
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dateOfBirth: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {genders.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {gender}
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
                      setFormData({
                        ...formData,
                        phoneNumber: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="cellNumber">Cell Type</Label>
                  <Select
                    value={formData.cellNumber}
                    onValueChange={(value) =>
                      setFormData({ ...formData, cellNumber: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cellNumbers.map((cell) => (
                        <SelectItem key={cell} value={cell}>
                          {cell}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                        address: {
                          ...formData.address,
                          city: e.target.value,
                        },
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="arrestDate">Arrest Date</Label>
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
                  <Label htmlFor="arrestLocation">Arrest Location</Label>
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
                  <Label htmlFor="arrestingOfficer">Arresting Officer</Label>
                  <Input
                    id="arrestingOfficer"
                    placeholder="Enter officer name"
                    value={formData.arrestDetails.arrestingOfficer}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        arrestDetails: {
                          ...formData.arrestDetails,
                          arrestingOfficer: e.target.value,
                        },
                      })
                    }
                    required
                  />
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
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="briefNote">Brief Note (Optional)</Label>
                <textarea
                  id="briefNote"
                  className="w-full p-2 border rounded-md"
                  rows="3"
                  placeholder="Add any additional notes about the inmate..."
                  value={formData.briefNote}
                  onChange={(e) =>
                    setFormData({ ...formData, briefNote: e.target.value })
                  }
                />
              </div>

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

      {/* Enhanced Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[300px]">
                <SearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  onSearch={handleManualSearch}
                  placeholder="Search persons detained by number, name, or cell..."
                  isSearching={searching}
                />
              </div>
              <Select
                value={statusFilter || "all"}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filters and clear button */}
            {(searchTerm || statusFilter) && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {totalResults} result{totalResults !== 1 ? "s" : ""} found
                    {searchTerm && ` for "${searchTerm}"`}
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

      {/* Persons Detained Table or Empty State */}
      {showEmptyState ? (
        showEmptyState === "no-results" ? (
          <EmptyState
            type="no-results"
            title="No persons detained found"
            description="No persons detained match your current search criteria. Try adjusting your filters or search terms."
            searchTerm={searchTerm}
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
            <CardTitle>
              Persons Detained ({totalResults})
              {searching && (
                <Loader2 className="inline h-4 w-4 ml-2 animate-spin" />
              )}
            </CardTitle>
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
                            src={prisoner.mugshot || "/placeholder.svg"}
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
                          <span>{prisoner.cellNumber || "N/A"}</span>
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
                        {prisoner.caseId ? (
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
                      src={formData.mugshot || "/placeholder.svg"}
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
                <Label htmlFor="edit-firstName">First Name</Label>
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
                <Label htmlFor="edit-lastName">Last Name</Label>
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
                <Label htmlFor="edit-cellNumber">Cell Type</Label>
                <Select
                  value={formData.cellNumber}
                  onValueChange={(value) =>
                    setFormData({ ...formData, cellNumber: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cellNumbers.map((cell) => (
                      <SelectItem key={cell} value={cell}>
                        {cell}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
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
                rows="3"
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
