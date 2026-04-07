"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Eye,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface User {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  stationId?: string;
  profilePhoto?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  role: string;
  stationId: string;
  isActive: boolean;
}

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    fullName: "",
    email: "",
    password: "",
    role: "nco",
    stationId: "",
    isActive: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [searchTerm, roleFilter, activeFilter, currentPage]);

  const getToken = () => localStorage.getItem("token");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = getToken();

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      if (searchTerm) params.append("search", searchTerm);
      if (roleFilter) params.append("role", roleFilter);
      if (activeFilter) params.append("isActive", activeFilter);

      const response = await fetch(`/api/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setTotalPages(data.pagination.totalPages);
        setTotalUsers(data.pagination.total);
      } else {
        toast.error("Failed to fetch users");
      }
    } catch (error) {
      toast.error("Error fetching users");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("");
    setActiveFilter("");
    setCurrentPage(1);
  };

  const handleAddUser = async () => {
    if (!formData.fullName || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setFormLoading(true);
      const token = getToken();

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("User created successfully");
        setIsAddDialogOpen(false);
        resetForm();
        clearFilters(); // Clear filters before fetching
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to create user");
      }
    } catch (error) {
      toast.error("Error creating user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      setFormLoading(true);
      const token = getToken();

      const updateData: any = {
        fullName: formData.fullName,
        email: formData.email,
        role: formData.role,
        stationId: formData.stationId,
        isActive: formData.isActive,
      };

      // Only include password if it's been changed
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        toast.success("User updated successfully");
        setIsEditDialogOpen(false);
        resetForm();
        clearFilters(); // Clear filters before fetching
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update user");
      }
    } catch (error) {
      toast.error("Error updating user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setFormLoading(true);
      const token = getToken();

      const response = await fetch(`/api/users/${selectedUser._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("User deleted successfully");
        setIsDeleteDialogOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete user");
      }
    } catch (error) {
      toast.error("Error deleting user");
    } finally {
      setFormLoading(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      stationId: user.stationId || "",
      isActive: user.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (user: User) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      password: "",
      role: "nco",
      stationId: "",
      isActive: true,
    });
    setSelectedUser(null);
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-purple-100 text-purple-800",
      nco: "bg-blue-100 text-blue-800",
      cid: "bg-green-100 text-green-800",
      so: "bg-yellow-100 text-yellow-800",
      dc: "bg-orange-100 text-orange-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6 pt-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">
            Manage system users and their permissions
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or station..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <Label>Role</Label>
              <Select
                value={roleFilter === "" ? "all" : roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value === "all" ? "" : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="nco">NCO</SelectItem>
                  <SelectItem value="cid">CID</SelectItem>
                  <SelectItem value="so">SO</SelectItem>
                  <SelectItem value="dc">DC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Label>Status</Label>
              <Select
                value={activeFilter === "" ? "all" : activeFilter}
                onValueChange={(value) => {
                  setActiveFilter(value === "all" ? "" : value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Users ({totalUsers})</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No users found
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Station ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">
                          {user.fullName}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            className={getRoleBadgeColor(user.role)}
                            variant="secondary"
                          >
                            {user.role.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.stationId || (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.isActive ? "default" : "secondary"}
                            className={
                              user.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openViewDialog(user)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDeleteDialog(user)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with specific role and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder="John Doe"
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
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Minimum 6 characters"
              />
            </div>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="nco">NCO</SelectItem>
                  <SelectItem value="cid">CID</SelectItem>
                  <SelectItem value="so">SO</SelectItem>
                  <SelectItem value="dc">DC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="stationId">Station ID</Label>
              <Input
                id="stationId"
                value={formData.stationId}
                onChange={(e) =>
                  setFormData({ ...formData, stationId: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                Active Account
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-fullName">Full Name *</Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-password">New Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Leave blank to keep current"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="nco">NCO</SelectItem>
                  <SelectItem value="cid">CID</SelectItem>
                  <SelectItem value="so">SO</SelectItem>
                  <SelectItem value="dc">DC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-stationId">Station ID</Label>
              <Input
                id="edit-stationId"
                value={formData.stationId}
                onChange={(e) =>
                  setFormData({ ...formData, stationId: e.target.value })
                }
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4"
              />
              <Label htmlFor="edit-isActive" className="cursor-pointer">
                Active Account
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-600">Full Name</Label>
                <p className="font-medium">{selectedUser.fullName}</p>
              </div>
              <div>
                <Label className="text-gray-600">Email</Label>
                <p className="font-medium">{selectedUser.email}</p>
              </div>
              <div>
                <Label className="text-gray-600">Role</Label>
                <div className="mt-1">
                  <Badge
                    className={getRoleBadgeColor(selectedUser.role)}
                    variant="secondary"
                  >
                    {selectedUser.role.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Station ID</Label>
                <p className="font-medium">
                  {selectedUser.stationId || "Not assigned"}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Status</Label>
                <div className="mt-1">
                  <Badge
                    variant={selectedUser.isActive ? "default" : "secondary"}
                    className={
                      selectedUser.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {selectedUser.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-gray-600">Created At</Label>
                <p className="font-medium">
                  {new Date(selectedUser.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <Label className="text-gray-600">Updated At</Label>
                <p className="font-medium">
                  {new Date(selectedUser.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user{" "}
              <strong>{selectedUser?.fullName}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={formLoading}
            >
              {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage;
