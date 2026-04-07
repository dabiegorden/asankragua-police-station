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
  Eye,
  Trash2,
  MessageSquare,
  User,
  Mail,
  Calendar,
  Loader2,
} from "lucide-react";

const Contact = () => {
  const [contacts, setContacts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedContact, setSelectedContact] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [responseText, setResponseText] = useState("");

  const statuses = ["new", "in-progress", "resolved", "closed"];
  const priorities = ["low", "normal", "high", "urgent"];

  useEffect(() => {
    fetchContacts();
    fetchUsers();
  }, [currentPage, searchTerm, statusFilter, priorityFilter]);

  const getToken = () => localStorage.getItem("token");

  const fetchContacts = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(priorityFilter !== "all" && { priority: priorityFilter }),
      });

      const response = await fetch(`/api/contact?${params}`);

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      toast.error("Failed to fetch contacts");
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

  const handleStatusUpdate = async (contactId, newStatus) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/contact/${contactId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success("Status updated successfully");
        fetchContacts();
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleAssignTo = async (contactId, userId) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/contact/${contactId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assignedTo: userId }),
      });

      if (response.ok) {
        toast.success("Contact assigned successfully");
        fetchContacts();
      } else {
        toast.error("Failed to assign contact");
      }
    } catch (error) {
      toast.error("Failed to assign contact");
    }
  };

  const handleResponse = async (contactId) => {
    if (!responseText.trim()) {
      toast.error("Please enter a response");
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`/api/contact/${contactId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ response: responseText }),
      });

      if (response.ok) {
        toast.success("Response sent successfully");
        setResponseText("");
        fetchContacts();
        if (selectedContact) {
          // Refresh the selected contact details
          const updatedResponse = await fetch(`/api/contact/${contactId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (updatedResponse.ok) {
            const updatedData = await updatedResponse.json();
            setSelectedContact(updatedData.contact);
          }
        }
      } else {
        toast.error("Failed to send response");
      }
    } catch (error) {
      toast.error("Failed to send response");
    }
  };

  const handleDelete = async (contactId) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/contact/${contactId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Contact deleted successfully");
        fetchContacts();
        setIsViewModalOpen(false);
      } else {
        toast.error("Failed to delete contact");
      }
    } catch (error) {
      toast.error("Failed to delete contact");
    }
  };

  const openViewModal = async (contact) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/contact/${contact._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedContact(data.contact);
        setIsViewModalOpen(true);
      }
    } catch (error) {
      toast.error("Failed to fetch contact details");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      new: "bg-blue-100 text-blue-800",
      "in-progress": "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      normal: "bg-blue-100 text-blue-800",
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
        <h1 className="text-3xl font-bold">Contact Messages</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts..."
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
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {priorities.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Messages ({contacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Subject</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact._id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{contact.name}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{contact.email}</span>
                      </div>
                    </td>
                    <td className="p-2 max-w-xs truncate">{contact.subject}</td>
                    <td className="p-2">
                      <Badge variant="outline">{contact.type}</Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={getPriorityColor(contact.priority)}>
                        {contact.priority}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Select
                        value={contact.status}
                        onValueChange={(value) =>
                          handleStatusUpdate(contact._id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>
                            <Badge className={getStatusColor(contact.status)}>
                              {contact.status}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(contact.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewModal(contact)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(contact._id)}
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

      {/* View Contact Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="text-sm font-medium">{selectedContact.name}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{selectedContact.email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-sm">
                    {selectedContact.phone || "Not provided"}
                  </p>
                </div>
                <div>
                  <Label>Date Submitted</Label>
                  <p className="text-sm">
                    {new Date(selectedContact.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Status</Label>
                  <Badge className={getStatusColor(selectedContact.status)}>
                    {selectedContact.status}
                  </Badge>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Badge className={getPriorityColor(selectedContact.priority)}>
                    {selectedContact.priority}
                  </Badge>
                </div>
                <div>
                  <Label>Type</Label>
                  <Badge variant="outline">{selectedContact.type}</Badge>
                </div>
              </div>

              {/* Subject and Message */}
              <div>
                <Label>Subject</Label>
                <p className="text-sm font-medium mt-1">
                  {selectedContact.subject}
                </p>
              </div>

              <div>
                <Label>Message</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedContact.message}
                  </p>
                </div>
              </div>

              {/* Assignment */}
              <div>
                <Label>Assign To</Label>
                <Select
                  value={selectedContact.assignedTo?._id || "unassigned"}
                  onValueChange={(value) =>
                    handleAssignTo(selectedContact._id, value)
                  }
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select user to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Previous Responses */}
              {selectedContact.responses &&
                selectedContact.responses.length > 0 && (
                  <div>
                    <Label>Previous Responses</Label>
                    <div className="mt-2 space-y-3">
                      {selectedContact.responses.map((response, index) => (
                        <div key={index} className="p-3 bg-blue-50 rounded-md">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">
                              {response.respondedBy.firstName}{" "}
                              {response.respondedBy.lastName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(response.respondedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{response.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Response Form */}
              <div>
                <Label>Send Response</Label>
                <Textarea
                  placeholder="Type your response here..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="mt-1"
                  rows={4}
                />
                <Button
                  onClick={() => handleResponse(selectedContact._id)}
                  className="mt-2"
                  disabled={!responseText.trim()}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Response
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contact;
