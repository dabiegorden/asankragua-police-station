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
  Calendar,
  Clock,
  MapPin,
  Loader2,
} from "lucide-react";

const Schedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "",
    startDate: "",
    endDate: "",
    assignedPersonnel: [],
    location: "",
    priority: "medium",
    relatedCase: "none",
    vehicleAssigned: "none",
    recurrence: {
      type: "none",
      interval: 1,
      endDate: "",
    },
  });

  const scheduleTypes = [
    "shift",
    "patrol",
    "training",
    "meeting",
    "court",
    "investigation",
    "other",
  ];

  const priorities = ["low", "medium", "high", "urgent"];
  const statuses = ["scheduled", "in-progress", "completed", "cancelled"];
  const recurrenceTypes = ["none", "daily", "weekly", "monthly"];

  useEffect(() => {
    fetchSchedules();
    fetchUsers();
    fetchCases();
    fetchVehicles();
  }, [currentPage, searchTerm, typeFilter, statusFilter]);

  const getToken = () => localStorage.getItem("token");

  const fetchSchedules = async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });

      const response = await fetch(`/api/schedule?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      toast.error("Failed to fetch schedules");
    } finally {
      setLoading(false);
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

  const fetchVehicles = async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/vehicles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles);
      }
    } catch (error) {
      console.error("Failed to fetch vehicles");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      const url = selectedSchedule
        ? `/api/schedule/${selectedSchedule._id}`
        : "/api/schedule";
      const method = selectedSchedule ? "PUT" : "POST";

      // Prepare form data, converting "none" values back to empty strings for API
      const submitData = {
        ...formData,
        relatedCase:
          formData.relatedCase === "none" ? "" : formData.relatedCase,
        vehicleAssigned:
          formData.vehicleAssigned === "none" ? "" : formData.vehicleAssigned,
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
          `Schedule ${selectedSchedule ? "updated" : "created"} successfully`
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchSchedules();
      } else {
        const error = await response.json();
        toast.error(error.error || "Operation failed");
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (scheduleId) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/schedule/${scheduleId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Schedule deleted successfully");
        fetchSchedules();
      } else {
        toast.error("Failed to delete schedule");
      }
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      type: "",
      startDate: "",
      endDate: "",
      assignedPersonnel: [],
      location: "",
      priority: "medium",
      relatedCase: "none",
      vehicleAssigned: "none",
      recurrence: {
        type: "none",
        interval: 1,
        endDate: "",
      },
    });
    setSelectedSchedule(null);
  };

  const openEditModal = (schedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      title: schedule.title,
      description: schedule.description || "",
      type: schedule.type,
      startDate: schedule.startDate
        ? new Date(schedule.startDate).toISOString().slice(0, 16)
        : "",
      endDate: schedule.endDate
        ? new Date(schedule.endDate).toISOString().slice(0, 16)
        : "",
      assignedPersonnel: schedule.assignedPersonnel?.map((p) => p._id) || [],
      location: schedule.location,
      priority: schedule.priority,
      relatedCase: schedule.relatedCase?._id || "none",
      vehicleAssigned: schedule.vehicleAssigned?._id || "none",
      recurrence: schedule.recurrence || {
        type: "none",
        interval: 1,
        endDate: "",
      },
    });
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      scheduled: "bg-blue-100 text-blue-800",
      "in-progress": "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
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
        <h1 className="text-3xl font-bold">Schedule Management</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Schedule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
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
                      {scheduleTypes.map((type) => (
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date & Time</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date & Time</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
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
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData({ ...formData, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="relatedCase">Related Case (Optional)</Label>
                  <Select
                    value={formData.relatedCase}
                    onValueChange={(value) =>
                      setFormData({ ...formData, relatedCase: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select case" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No case</SelectItem>
                      {cases.map((caseItem) => (
                        <SelectItem key={caseItem._id} value={caseItem._id}>
                          {caseItem.caseNumber} - {caseItem.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vehicleAssigned">
                    Assigned Vehicle (Optional)
                  </Label>
                  <Select
                    value={formData.vehicleAssigned}
                    onValueChange={(value) =>
                      setFormData({ ...formData, vehicleAssigned: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No vehicle</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle._id} value={vehicle._id}>
                          {vehicle.licensePlate} - {vehicle.make}{" "}
                          {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button type="submit">Create Schedule</Button>
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
                  placeholder="Search schedules..."
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
                {scheduleTypes.map((type) => (
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

      {/* Schedules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Schedules ({schedules.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Start Date</th>
                  <th className="text-left p-2">End Date</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule._id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{schedule.title}</td>
                    <td className="p-2">
                      <Badge variant="outline">{schedule.type}</Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(schedule.startDate).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(schedule.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{schedule.location}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={getPriorityColor(schedule.priority)}>
                        {schedule.priority}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={getStatusColor(schedule.status)}>
                        {schedule.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditModal(schedule)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(schedule._id)}
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
            <DialogTitle>Edit Schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-startDate">Start Date & Time</Label>
                <Input
                  id="edit-startDate"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-endDate">End Date & Time</Label>
                <Input
                  id="edit-endDate"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  required
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
              <Button type="submit">Update Schedule</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;
