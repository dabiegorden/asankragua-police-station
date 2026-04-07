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
  Trash2,
  MessageSquare,
  Send,
  User,
  Calendar,
  Loader2,
} from "lucide-react";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("inbox");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [formData, setFormData] = useState({
    recipients: [],
    subject: "",
    content: "",
    type: "general",
    priority: "medium",
    relatedCase: "",
  });

  const messageTypes = [
    "general",
    "urgent",
    "announcement",
    "case-related",
    "administrative",
  ];
  const priorities = ["low", "medium", "high", "urgent"];
  const folders = ["inbox", "sent", "deleted"];

  useEffect(() => {
    fetchMessages();
    fetchUsers();
    fetchCases();
  }, [currentPage, searchTerm, typeFilter, folderFilter]);

  const getToken = () => localStorage.getItem("token");

  const fetchMessages = async () => {
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        folder: folderFilter,
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && { type: typeFilter }),
      });

      const response = await fetch(`/api/messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      toast.error("Failed to fetch messages");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = getToken();
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Message sent successfully");
        setIsCreateModalOpen(false);
        resetForm();
        fetchMessages();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
    }
  };

  const handleDelete = async (messageId) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      const token = getToken();
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        toast.success("Message deleted successfully");
        fetchMessages();
      } else {
        toast.error("Failed to delete message");
      }
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const resetForm = () => {
    setFormData({
      recipients: [],
      subject: "",
      content: "",
      type: "general",
      priority: "medium",
      relatedCase: "",
    });
  };

  const openViewModal = async (message) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/messages/${message._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedMessage(data.message);
        setIsViewModalOpen(true);
      }
    } catch (error) {
      toast.error("Failed to fetch message details");
    }
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

  const getTypeColor = (type) => {
    const colors = {
      general: "bg-blue-100 text-blue-800",
      urgent: "bg-red-100 text-red-800",
      announcement: "bg-purple-100 text-purple-800",
      "case-related": "bg-green-100 text-green-800",
      administrative: "bg-gray-100 text-gray-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
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
        <h1 className="text-3xl font-bold">Messages</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Compose Message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compose New Message</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="recipients">Recipients</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (!formData.recipients.includes(value)) {
                      setFormData({
                        ...formData,
                        recipients: [...formData.recipients, value],
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipients" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.recipients.map((recipientId) => {
                    const user = users.find((u) => u._id === recipientId);
                    return user ? (
                      <Badge
                        key={recipientId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {user.firstName} {user.lastName}
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              recipients: formData.recipients.filter(
                                (id) => id !== recipientId
                              ),
                            })
                          }
                          className="ml-1 text-xs"
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {messageTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Label htmlFor="content">Message</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={6}
                  required
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
                <Button type="submit">
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
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
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    {folder}
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
                {messageTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Messages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Messages ({messages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">From/To</th>
                  <th className="text-left p-2">Subject</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Priority</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message._id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {folderFilter === "sent"
                            ? `To: ${message.recipients
                                ?.map((r) => r.user?.firstName)
                                .join(", ")}`
                            : `From: ${message.sender?.firstName} ${message.sender?.lastName}`}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 max-w-xs truncate font-medium">
                      {message.subject}
                    </td>
                    <td className="p-2">
                      <Badge className={getTypeColor(message.type)}>
                        {message.type}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={getPriorityColor(message.priority)}>
                        {message.priority}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      {folderFilter === "inbox" && (
                        <Badge
                          variant={
                            message.recipients?.some((r) => r.readStatus)
                              ? "secondary"
                              : "default"
                          }
                        >
                          {message.recipients?.some((r) => r.readStatus)
                            ? "Read"
                            : "Unread"}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openViewModal(message)}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(message._id)}
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

      {/* View Message Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From</Label>
                  <p className="text-sm font-medium">
                    {selectedMessage.sender?.firstName}{" "}
                    {selectedMessage.sender?.lastName}
                  </p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-sm">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <Label>To</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedMessage.recipients?.map((recipient, index) => (
                    <Badge key={index} variant="secondary">
                      {recipient.user?.firstName} {recipient.user?.lastName}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Subject</Label>
                <p className="text-sm font-medium mt-1">
                  {selectedMessage.subject}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Badge className={getTypeColor(selectedMessage.type)}>
                    {selectedMessage.type}
                  </Badge>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Badge className={getPriorityColor(selectedMessage.priority)}>
                    {selectedMessage.priority}
                  </Badge>
                </div>
              </div>

              {selectedMessage.relatedCase && (
                <div>
                  <Label>Related Case</Label>
                  <p className="text-sm font-mono">
                    {selectedMessage.relatedCase.caseNumber} -{" "}
                    {selectedMessage.relatedCase.title}
                  </p>
                </div>
              )}

              <div>
                <Label>Message</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedMessage.content}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
