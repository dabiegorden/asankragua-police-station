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
  Car,
  Fuel,
  User,
  Loader2,
} from "lucide-react";

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [formData, setFormData] = useState({
    licensePlate: "",
    make: "",
    model: "",
    year: "",
    color: "",
    type: "",
    mileage: 0,
    fuelLevel: 100,
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
  });

  const vehicleTypes = [
    "patrol-car",
    "motorcycle",
    "van",
    "truck",
    "suv",
    "other",
  ];
  const statuses = ["available", "in-use", "maintenance", "out-of-service"];

  useEffect(() => {
    fetchVehicles();
    fetchUsers();
  }, [currentPage, searchTerm, statusFilter, typeFilter]);

  const getToken = () => localStorage.getItem("token");

  const fetchVehicles = async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter }),
      });

      const response = await fetch(`/api/vehicles?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setVehicles(data.vehicles);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      toast.error("Failed to fetch vehicles");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/users", {
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
      const url = selectedVehicle
        ? `/api/vehicles/${selectedVehicle._id}`
        : "/api/vehicles";
      const method = selectedVehicle ? "PUT" : "POST";

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
          `Vehicle ${selectedVehicle ? "updated" : "created"} successfully`,
        );
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
        fetchVehicles();
      } else {
        const error = await response.json();
        toast.error(error.error || "Operation failed");
      }
    } catch (error) {
      toast.error("Operation failed");
    }
  };

  const handleDelete = async (vehicleId) => {
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
        toast.error("Failed to delete vehicle");
      }
    } catch (error) {
      toast.error("Failed to delete vehicle");
    }
  };

  const handleAssignDriver = async (vehicleId, driverId) => {
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
        toast.error("Failed to assign driver");
      }
    } catch (error) {
      toast.error("Failed to assign driver");
    }
  };

  const resetForm = () => {
    setFormData({
      licensePlate: "",
      make: "",
      model: "",
      year: "",
      color: "",
      type: "",
      mileage: 0,
      fuelLevel: 100,
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
    });
    setSelectedVehicle(null);
  };

  const openEditModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      licensePlate: vehicle.licensePlate,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year.toString(),
      color: vehicle.color,
      type: vehicle.type,
      mileage: vehicle.mileage,
      fuelLevel: vehicle.fuelLevel,
      insuranceDetails: vehicle.insuranceDetails || {
        provider: "",
        policyNumber: "",
        expiryDate: "",
        coverage: "",
      },
      registrationDetails: vehicle.registrationDetails || {
        registrationNumber: "",
        expiryDate: "",
        registeredTo: "",
      },
      equipment: vehicle.equipment || [],
      notes: vehicle.notes || "",
    });
    setIsEditModalOpen(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      available: "bg-green-100 text-green-800",
      "in-use": "bg-blue-100 text-blue-800",
      maintenance: "bg-yellow-100 text-yellow-800",
      "out-of-service": "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getFuelLevelColor = (level) => {
    if (level > 50) return "text-green-600";
    if (level > 25) return "text-yellow-600";
    return "text-red-600";
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="licensePlate">License Plate</Label>
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
                  <Label htmlFor="type">Vehicle Type</Label>
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
                      {vehicleTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) =>
                      setFormData({ ...formData, make: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData({ ...formData, year: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input
                    id="mileage"
                    type="number"
                    value={formData.mileage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mileage: Number.parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="fuelLevel">Fuel Level (Mileage)</Label>
                  <Input
                    id="fuelLevel"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.fuelLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fuelLevel: Number.parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Insurance Details</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
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
                  <Input
                    type="date"
                    placeholder="Expiry Date"
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
                <Button type="submit">Create Vehicle</Button>
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
                  placeholder="Search vehicles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {vehicleTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Vehicles ({vehicles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Vehicle Number</th>
                  <th className="text-left p-2">License Plate</th>
                  <th className="text-left p-2">Make/Model</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Current Driver</th>
                  <th className="text-left p-2">Fuel Level</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle._id} className="border-b hover:bg-gray-50">
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
                      <Badge variant="outline">{vehicle.type}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={getStatusColor(vehicle.status)}>
                        {vehicle.status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {vehicle.currentDriver ? (
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {vehicle.currentDriver.firstName}{" "}
                            {vehicle.currentDriver.lastName}
                          </span>
                        </div>
                      ) : (
                        <Select
                          onValueChange={(value) =>
                            handleAssignDriver(vehicle._id, value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user._id} value={user._id}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
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
            <DialogTitle>Edit Vehicle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-licensePlate">License Plate</Label>
                <Input
                  id="edit-licensePlate"
                  value={formData.licensePlate}
                  onChange={(e) =>
                    setFormData({ ...formData, licensePlate: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Vehicle Type</Label>
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
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-mileage">Mileage</Label>
                <Input
                  id="edit-mileage"
                  type="number"
                  value={formData.mileage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mileage: Number.parseInt(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-fuelLevel">Fuel Level (%)</Label>
                <Input
                  id="edit-fuelLevel"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.fuelLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fuelLevel: Number.parseInt(e.target.value),
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
              <Button type="submit">Update Vehicle</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vehicles;
