"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Plus, Edit, Trash2, Loader2, Shield } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { useSearchParams } from "next/navigation";

const RifleBookingContent = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // Updated default value
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const searchParams = useSearchParams(); // Use useSearchParams

  const [formData, setFormData] = useState({
    typeOfRifle: "",
    rifleNumber: "",
    ammunitionType: "",
    numberOfAmmunition: 0,
    dateOfBooking: new Date().toISOString().split("T")[0],
    typeOfDuty: "",
    returnDate: "",
    serialNumber: "",
    nameOfPersonnel: "",
    receivedBy: "",
    issuedBy: "",
    sdNumber: "",
  });

  useEffect(() => {
    fetchBookings();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      if (searchTerm) params.append("search", searchTerm);
      if (statusFilter !== "all") params.append("status", statusFilter); // Updated condition

      const response = await fetch(`/api/rifle-bookings?${params}`);
      const data = await response.json();

      if (response.ok) {
        setBookings(data.bookings);
        setTotalPages(data.pagination.pages);
      } else {
        toast.error(data.error || "Failed to fetch rifle bookings");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to fetch rifle bookings");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      typeOfRifle: "",
      rifleNumber: "",
      ammunitionType: "",
      numberOfAmmunition: 0,
      dateOfBooking: new Date().toISOString().split("T")[0],
      typeOfDuty: "",
      returnDate: "",
      serialNumber: "",
      nameOfPersonnel: "",
      receivedBy: "",
      issuedBy: "",
      sdNumber: "",
    });
    setSelectedBooking(null);
  };

  const openEditModal = (booking) => {
    setSelectedBooking(booking);
    setFormData({
      typeOfRifle: booking.typeOfRifle,
      rifleNumber: booking.rifleNumber,
      ammunitionType: booking.ammunitionType,
      numberOfAmmunition: booking.numberOfAmmunition,
      dateOfBooking: booking.dateOfBooking
        ? booking.dateOfBooking.split("T")[0]
        : "",
      typeOfDuty: booking.typeOfDuty,
      returnDate: booking.returnDate ? booking.returnDate.split("T")[0] : "",
      serialNumber: booking.serialNumber,
      nameOfPersonnel: booking.nameOfPersonnel,
      receivedBy: booking.receivedBy,
      issuedBy: booking.issuedBy,
      sdNumber: booking.sdNumber,
    });
    setIsEditModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = selectedBooking
        ? `/api/rifle-bookings/${selectedBooking._id}`
        : "/api/rifle-bookings";
      const method = selectedBooking ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          data.message ||
            `Rifle booking ${selectedBooking ? "updated" : "created"} successfully`,
        );
        fetchBookings();
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
        resetForm();
      } else {
        toast.error(data.error || "Failed to save rifle booking");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to save rifle booking");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this rifle booking?")) {
      return;
    }

    try {
      const response = await fetch(`/api/rifle-bookings/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Rifle booking deleted successfully");
        fetchBookings();
      } else {
        toast.error(data.error || "Failed to delete rifle booking");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete rifle booking");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: "bg-blue-100 text-blue-800",
      returned: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <>
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Rifle Bookings</h1>
              <p className="text-muted-foreground">
                Manage rifle bookings and assignments
              </p>
            </div>
            <Dialog
              open={isCreateModalOpen}
              onOpenChange={setIsCreateModalOpen}
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
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="typeOfRifle">Type of Rifle</Label>
                      <Input
                        id="typeOfRifle"
                        placeholder="e.g., AK-47, M16"
                        value={formData.typeOfRifle}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            typeOfRifle: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="rifleNumber">Rifle Number</Label>
                      <Input
                        id="rifleNumber"
                        placeholder="e.g., RFL-001"
                        value={formData.rifleNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            rifleNumber: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ammunitionType">Ammunition Type</Label>
                      <Input
                        id="ammunitionType"
                        placeholder="e.g., 7.62mm"
                        value={formData.ammunitionType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ammunitionType: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="numberOfAmmunition">
                        Number of Ammunition
                      </Label>
                      <Input
                        id="numberOfAmmunition"
                        type="number"
                        min="0"
                        value={formData.numberOfAmmunition}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            numberOfAmmunition: Number.parseInt(e.target.value),
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="serialNumber">Serial Number</Label>
                      <Input
                        id="serialNumber"
                        placeholder="Unique serial number"
                        value={formData.serialNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            serialNumber: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="sdNumber">SD Number</Label>
                      <Input
                        id="sdNumber"
                        placeholder="SD Number"
                        value={formData.sdNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, sdNumber: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dateOfBooking">Date of Booking</Label>
                      <Input
                        id="dateOfBooking"
                        type="date"
                        value={formData.dateOfBooking}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dateOfBooking: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="returnDate">Return Date</Label>
                      <Input
                        id="returnDate"
                        type="date"
                        placeholder="Record when returned"
                        value={formData.returnDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            returnDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="typeOfDuty">Type of Duty</Label>
                    <Input
                      id="typeOfDuty"
                      placeholder="e.g., Patrol, Guard Duty"
                      value={formData.typeOfDuty}
                      onChange={(e) =>
                        setFormData({ ...formData, typeOfDuty: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="nameOfPersonnel">Name of Personnel</Label>
                    <Input
                      id="nameOfPersonnel"
                      placeholder="Full name"
                      value={formData.nameOfPersonnel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nameOfPersonnel: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="receivedBy">Received By</Label>
                      <Input
                        id="receivedBy"
                        placeholder="Name of receiver"
                        value={formData.receivedBy}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            receivedBy: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="issuedBy">Issued By</Label>
                      <Input
                        id="issuedBy"
                        placeholder="Name of issuer"
                        value={formData.issuedBy}
                        onChange={(e) =>
                          setFormData({ ...formData, issuedBy: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateModalOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Booking</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <div className="flex-1">
                  <SearchInput
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by booking number, serial, personnel..."
                  />
                </div>
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
            </CardContent>
          </Card>

          {bookings.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No rifle bookings found"
              description="Create your first rifle booking to get started"
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Booking Number</th>
                        <th className="text-left p-2">Personnel</th>
                        <th className="text-left p-2">Rifle Info</th>
                        <th className="text-left p-2">Serial Number</th>
                        <th className="text-left p-2">Duty</th>
                        <th className="text-left p-2">Booking Date</th>
                        <th className="text-left p-2">Return Date</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr
                          key={booking._id}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="p-2 font-mono text-sm">
                            {booking.bookingNumber}
                          </td>
                          <td className="p-2">
                            <div>
                              <div className="font-medium">
                                {booking.nameOfPersonnel}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                SD: {booking.sdNumber}
                              </div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div>
                              <div className="font-medium">
                                {booking.typeOfRifle}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                #{booking.rifleNumber}
                              </div>
                            </div>
                          </td>
                          <td className="p-2 font-mono text-sm">
                            {booking.serialNumber}
                          </td>
                          <td className="p-2">{booking.typeOfDuty}</td>
                          <td className="p-2">
                            {new Date(
                              booking.dateOfBooking,
                            ).toLocaleDateString()}
                          </td>
                          <td className="p-2">
                            {booking.returnDate
                              ? new Date(
                                  booking.returnDate,
                                ).toLocaleDateString()
                              : "Not returned yet"}
                          </td>
                          <td className="p-2">
                            <Badge className={getStatusColor(booking.status)}>
                              {booking.status}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(booking)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(booking._id)}
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

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="py-2 px-4">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
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
                <DialogTitle>Edit Rifle Booking</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-typeOfRifle">Type of Rifle</Label>
                    <Input
                      id="edit-typeOfRifle"
                      value={formData.typeOfRifle}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          typeOfRifle: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-rifleNumber">Rifle Number</Label>
                    <Input
                      id="edit-rifleNumber"
                      value={formData.rifleNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rifleNumber: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-ammunitionType">Ammunition Type</Label>
                    <Input
                      id="edit-ammunitionType"
                      value={formData.ammunitionType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ammunitionType: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-numberOfAmmunition">
                      Number of Ammunition
                    </Label>
                    <Input
                      id="edit-numberOfAmmunition"
                      type="number"
                      min="0"
                      value={formData.numberOfAmmunition}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numberOfAmmunition: Number.parseInt(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-serialNumber">Serial Number</Label>
                    <Input
                      id="edit-serialNumber"
                      value={formData.serialNumber}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          serialNumber: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-sdNumber">SD Number</Label>
                    <Input
                      id="edit-sdNumber"
                      value={formData.sdNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, sdNumber: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-dateOfBooking">Date of Booking</Label>
                    <Input
                      id="edit-dateOfBooking"
                      type="date"
                      value={formData.dateOfBooking}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dateOfBooking: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-returnDate">Return Date</Label>
                    <Input
                      id="edit-returnDate"
                      type="date"
                      placeholder="Record when returned"
                      value={formData.returnDate}
                      onChange={(e) =>
                        setFormData({ ...formData, returnDate: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-typeOfDuty">Type of Duty</Label>
                  <Input
                    id="edit-typeOfDuty"
                    value={formData.typeOfDuty}
                    onChange={(e) =>
                      setFormData({ ...formData, typeOfDuty: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="edit-nameOfPersonnel">
                    Name of Personnel
                  </Label>
                  <Input
                    id="edit-nameOfPersonnel"
                    value={formData.nameOfPersonnel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nameOfPersonnel: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-receivedBy">Received By</Label>
                    <Input
                      id="edit-receivedBy"
                      value={formData.receivedBy}
                      onChange={(e) =>
                        setFormData({ ...formData, receivedBy: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-issuedBy">Issued By</Label>
                    <Input
                      id="edit-issuedBy"
                      value={formData.issuedBy}
                      onChange={(e) =>
                        setFormData({ ...formData, issuedBy: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Update Booking</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
};

const RifleBookingPage = () => {
  return (
    <Suspense>
      <RifleBookingContent />
    </Suspense>
  );
};

export default RifleBookingPage;
