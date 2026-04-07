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

const Evidence = () => {
  const [evidence, setEvidence] = useState([]);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [formData, setFormData] = useState({
    caseId: "",
    type: "",
    description: "",
    location: "",
    collectionLocation: "",
    storageLocation: "",
    status: "",
    files: [],
    tags: [],
    notes: "",
  });

  const evidenceTypes = [
    "physical",
    "digital",
    "document",
    "photograph",
    "video",
    "audio",
  ];

  const statuses = [
    "collected",
    "in-analysis",
    "analyzed",
    "court-ready",
    "returned",
    "disposed",
  ];

  const searchParams = useSearchParams();

  useEffect(() => {
    fetchEvidence();
    fetchCases();
    fetchUsers();
  }, [currentPage, searchTerm, typeFilter, statusFilter]);

  const getToken = () => localStorage.getItem("token");

  const fetchEvidence = async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && { type: typeFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/evidence?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setEvidence(data.evidence);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      toast.error("Failed to fetch evidence");
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/cases", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setCases(data.cases);
      }
    } catch (error) {
      console.error("Failed to fetch cases");
    }
  };

  const fetchUsers = async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/auth/users", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      const url = selectedEvidence
        ? `/api/evidence/${selectedEvidence._id}`
        : "/api/evidence";
      const method = selectedEvidence ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
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

  const handleDelete = async (evidenceId) => {
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
      } else {
        toast.error("Failed to delete evidence");
      }
    } catch (error) {
      toast.error("Failed to delete evidence");
    }
  };

  const resetForm = () => {
    setFormData({
      caseId: "",
      type: "",
      description: "",
      location: "",
      collectionLocation: "",
      storageLocation: "",
      status: "",
      files: [],
      tags: [],
      notes: "",
    });
    setSelectedEvidence(null);
  };

  const openEditModal = (evidenceItem) => {
    setSelectedEvidence(evidenceItem);
    setFormData({
      caseId: evidenceItem.caseId?._id || "",
      type: evidenceItem.type,
      description: evidenceItem.description,
      location: evidenceItem.location,
      collectionLocation: evidenceItem.collectionLocation,
      storageLocation: evidenceItem.storageLocation,
      status: evidenceItem.status || "",
      files: evidenceItem.files || [],
      tags: evidenceItem.tags || [],
      notes: evidenceItem.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      collected: "bg-blue-100 text-blue-800",
      "in-analysis": "bg-yellow-100 text-yellow-800",
      analyzed: "bg-green-100 text-green-800",
      "court-ready": "bg-purple-100 text-purple-800",
      returned: "bg-gray-100 text-gray-800",
      disposed: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getConditionColor = (condition) => {
    const colors = {
      excellent: "bg-green-100 text-green-800",
      good: "bg-yellow-100 text-yellow-800",
      fair: "bg-orange-100 text-orange-800",
      poor: "bg-red-100 text-red-800",
      damaged: "bg-gray-100 text-gray-800",
    };
    return colors[condition] || "bg-gray-100 text-gray-800";
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
                  <Label htmlFor="caseId">Related Case</Label>
                  <Select
                    value={formData.caseId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, caseId: value })
                    }
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
                  <Label htmlFor="type">Evidence Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {evidenceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location Found</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="collectionLocation">
                    Collection Location
                  </Label>
                  <Input
                    id="collectionLocation"
                    value={formData.collectionLocation}
                    onChange={(e) =>
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
                  <Label htmlFor="storageLocation">Storage Location</Label>
                  <Input
                    id="storageLocation"
                    value={formData.storageLocation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        storageLocation: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status (Investigation)</Label>
                  <Input
                    id="status"
                    placeholder="e.g., collected, in-analysis"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
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
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search evidence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {evidenceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                          {item.caseId.caseNumber}
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
                        {item.status}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(item._id)}
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
            <DialogTitle>Edit Evidence</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-storageLocation">Storage Location</Label>
                <Input
                  id="edit-storageLocation"
                  value={formData.storageLocation}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storageLocation: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status (Investigation)</Label>
                <Input
                  id="edit-status"
                  placeholder="e.g., collected, in-analysis"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value,
                    })
                  }
                />
              </div>
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
