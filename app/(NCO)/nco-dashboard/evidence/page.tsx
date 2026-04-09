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
  Package,
  User,
  Loader2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ==================== TypeScript Interfaces ====================

// Evidence Types
type EvidenceType =
  | "physical"
  | "digital"
  | "document"
  | "photograph"
  | "video"
  | "audio";
type EvidenceStatus =
  | "collected"
  | "in-analysis"
  | "analyzed"
  | "court-ready"
  | "returned"
  | "disposed";
type UserRole = "admin" | "nco" | "so" | "dc" | "officer" | "user";

// User interface
interface User {
  _id: string;
  firstName: string;
  lastName: string;
  badgeNumber: string;
  email: string;
  role: UserRole;
}

// Case interface
interface Case {
  _id: string;
  caseNumber: string;
  title: string;
  status: string;
}

// Chain of Custody Entry
interface ChainOfCustodyEntry {
  handledBy: User | string;
  action: string;
  date: Date;
  location: string;
  notes?: string;
  signature?: string;
}

// Evidence interface matching API response
interface Evidence {
  _id: string;
  evidenceNumber: string;
  caseId: Case | string;
  type: EvidenceType;
  description: string;
  location: string;
  collectedBy: User;
  collectionDate: Date;
  collectionLocation: string;
  storageLocation: string;
  files: any[];
  chainOfCustody: ChainOfCustodyEntry[];
  analysisResults: any[];
  status: EvidenceStatus;
  tags: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response interfaces
interface EvidenceListResponse {
  evidence: Evidence[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface CasesListResponse {
  cases: Case[];
}

// Create/Update Evidence Request
interface CreateEvidenceRequest {
  caseId: string;
  type: EvidenceType;
  description: string;
  location: string;
  collectionLocation: string;
  storageLocation: string;
  status?: EvidenceStatus;
  tags?: string[];
  notes?: string;
}

interface UpdateEvidenceRequest {
  description?: string;
  location?: string;
  storageLocation?: string;
  status?: EvidenceStatus;
  tags?: string[];
  notes?: string;
}

// Form Data interface
interface EvidenceFormData {
  caseId: string;
  type: EvidenceType | "";
  description: string;
  location: string;
  collectionLocation: string;
  storageLocation: string;
  status: EvidenceStatus | "";
  tags: string;
  notes: string;
}

// ==================== Component ====================

const Evidence = () => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(
    null,
  );
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState<EvidenceFormData>({
    caseId: "",
    type: "",
    description: "",
    location: "",
    collectionLocation: "",
    storageLocation: "",
    status: "",
    tags: "",
    notes: "",
  });

  const evidenceTypes: EvidenceType[] = [
    "physical",
    "digital",
    "document",
    "photograph",
    "video",
    "audio",
  ];

  const statuses: EvidenceStatus[] = [
    "collected",
    "in-analysis",
    "analyzed",
    "court-ready",
    "returned",
    "disposed",
  ];

  const searchParams = useSearchParams();

  useEffect(() => {
    // Get user role from localStorage or context
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(user.role);
    fetchEvidence();
    fetchCases();
  }, [currentPage, searchTerm, typeFilter, statusFilter]);

  const getToken = (): string | null => localStorage.getItem("token");

  const fetchEvidence = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && typeFilter !== "all" && { type: typeFilter }),
        ...(statusFilter && statusFilter !== "all" && { status: statusFilter }),
      });

      const response = await fetch(`/api/evidence?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: EvidenceListResponse = await response.json();
        setEvidence(data.evidence);
        setTotalPages(data.pagination.pages);
      } else if (response.status === 403) {
        toast.error("You don't have permission to view evidence");
      }
    } catch (error) {
      toast.error("Failed to fetch evidence");
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async (): Promise<void> => {
    try {
      const token = getToken();
      const response = await fetch("/api/cases?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data: CasesListResponse = await response.json();
        setCases(data.cases || []);
      }
    } catch (error) {
      console.error("Failed to fetch cases");
    }
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();
    try {
      const token = getToken();
      const url = selectedEvidence
        ? `/api/evidence/${selectedEvidence._id}`
        : "/api/evidence";
      const method = selectedEvidence ? "PUT" : "POST";

      // Prepare data matching API expectations
      const submitData: CreateEvidenceRequest | UpdateEvidenceRequest = {
        caseId: formData.caseId,
        type: formData.type as EvidenceType,
        description: formData.description,
        location: formData.location,
        collectionLocation: formData.collectionLocation,
        storageLocation: formData.storageLocation,
        status: formData.status || undefined,
        tags: formData.tags
          ? formData.tags.split(",").map((t) => t.trim())
          : [],
        notes: formData.notes || undefined,
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        toast.success(
          `Evidence ${selectedEvidence ? "updated" : "created"} successfully`,
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchEvidence();
      } else {
        const error = await response.json();
        toast.error(error.error || "Operation failed");
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (evidenceId: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this evidence?")) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/evidence/${evidenceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Evidence deleted successfully");
        fetchEvidence();
      } else if (response.status === 403) {
        toast.error("Only admins can delete evidence");
      } else {
        toast.error("Failed to delete evidence");
      }
    } catch (error) {
      toast.error("Failed to delete evidence");
    }
  };

  const resetForm = (): void => {
    setFormData({
      caseId: "",
      type: "",
      description: "",
      location: "",
      collectionLocation: "",
      storageLocation: "",
      status: "",
      tags: "",
      notes: "",
    });
    setSelectedEvidence(null);
  };

  const openEditModal = (evidenceItem: Evidence): void => {
    setSelectedEvidence(evidenceItem);
    setFormData({
      caseId:
        typeof evidenceItem.caseId === "object"
          ? evidenceItem.caseId._id
          : evidenceItem.caseId,
      type: evidenceItem.type,
      description: evidenceItem.description,
      location: evidenceItem.location,
      collectionLocation: evidenceItem.collectionLocation,
      storageLocation: evidenceItem.storageLocation,
      status: evidenceItem.status || "",
      tags: evidenceItem.tags?.join(", ") || "",
      notes: evidenceItem.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status: EvidenceStatus): string => {
    const colors: Record<EvidenceStatus, string> = {
      collected: "bg-blue-100 text-blue-800",
      "in-analysis": "bg-yellow-100 text-yellow-800",
      analyzed: "bg-green-100 text-green-800",
      "court-ready": "bg-purple-100 text-purple-800",
      returned: "bg-gray-100 text-gray-800",
      disposed: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const canEdit = (): boolean => {
    return ["admin", "nco", "so", "dc"].includes(userRole || "");
  };

  const canDelete = (): boolean => {
    return userRole === "admin";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Evidence Management</h1>
        {canEdit() && (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Evidence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Evidence</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="caseId">Related Case *</Label>
                    <Select
                      value={formData.caseId}
                      onValueChange={(value: string) =>
                        setFormData({ ...formData, caseId: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select case" />
                      </SelectTrigger>
                      <SelectContent>
                        {cases.map((caseItem) => (
                          <SelectItem key={caseItem._id} value={caseItem._id}>
                            {caseItem.caseNumber} - {caseItem.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="type">Evidence Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: EvidenceType) =>
                        setFormData({ ...formData, type: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {evidenceTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location Found *</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="collectionLocation">
                      Collection Location *
                    </Label>
                    <Input
                      id="collectionLocation"
                      value={formData.collectionLocation}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({
                          ...formData,
                          collectionLocation: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="storageLocation">Storage Location *</Label>
                    <Input
                      id="storageLocation"
                      value={formData.storageLocation}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({
                          ...formData,
                          storageLocation: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: EvidenceStatus) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("-", " ").charAt(0).toUpperCase() +
                              status.replace("-", " ").slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., weapon, dna, fingerprint"
                    value={formData.tags}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Evidence</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-50">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search evidence..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchTerm(e.target.value)
                  }
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-37.5">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {evidenceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-37.5">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace("-", " ").charAt(0).toUpperCase() +
                      status.replace("-", " ").slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Table */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence ({evidence.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Evidence Number</th>
                  <th className="text-left p-2">Case</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Description</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Collected By</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((item) => (
                  <tr key={item._id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-sm">
                      {item.evidenceNumber}
                    </td>
                    <td className="p-2">
                      {item.caseId ? (
                        <span className="text-sm font-mono">
                          {typeof item.caseId === "object"
                            ? item.caseId.caseNumber
                            : item.caseId}
                        </span>
                      ) : (
                        "No case"
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <Badge variant="outline">{item.type}</Badge>
                      </div>
                    </td>
                    <td className="p-2 max-w-xs truncate">
                      {item.description}
                    </td>
                    <td className="p-2">
                      <Badge className={getStatusColor(item.status)}>
                        {item.status?.replace("-", " ")}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {item.collectedBy
                            ? `${item.collectedBy.firstName} ${item.collectedBy.lastName}`
                            : "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        {canEdit() && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete() && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item._id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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
                Page {currentPage} of {totalPages}
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

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Evidence</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-location">Location Found</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-storageLocation">Storage Location</Label>
                <Input
                  id="edit-storageLocation"
                  value={formData.storageLocation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({
                      ...formData,
                      storageLocation: e.target.value,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: EvidenceStatus) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("-", " ").charAt(0).toUpperCase() +
                          status.replace("-", " ").slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  value={formData.tags}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, tags: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, notes: e.target.value })
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
              <Button type="submit">Update Evidence</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function EvidencePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <Evidence />
    </Suspense>
  );
}
