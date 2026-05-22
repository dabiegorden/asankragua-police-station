"use client";

import { useState, useEffect, useCallback } from "react";
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
  Inbox,
  SendHorizontal,
  ArchiveX,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType =
  | "general"
  | "urgent"
  | "announcement"
  | "case-related"
  | "administrative";

type MessagePriority = "low" | "medium" | "high" | "urgent";
type Folder = "inbox" | "sent" | "deleted";

// The shape returned by the API after .populate()
interface PersonnelRef {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  badgeNumber?: string;
}

interface Recipient {
  user: PersonnelRef; // always populated — never a bare ObjectId string
  readStatus: boolean;
  readAt?: string;
}

interface Attachment {
  filename: string;
  url: string;
  fileType: string;
  size: number;
}

interface RelatedCase {
  _id: string;
  caseNumber: string;
  title: string;
  status?: string;
}

interface Message {
  _id: string;
  sender: PersonnelRef; // always populated
  recipients: Recipient[];
  subject: string;
  content: string;
  type: MessageType;
  priority: MessagePriority;
  attachments: Attachment[];
  relatedCase?: RelatedCase | null;
  isDeleted: boolean;
  deletedBy: string[];
  createdAt: string;
  updatedAt: string;
}

interface CaseOption {
  _id: string;
  caseNumber: string;
  title: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface FormData {
  recipients: string[];
  subject: string;
  content: string;
  type: MessageType;
  priority: MessagePriority;
  relatedCase: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MESSAGE_TYPES: MessageType[] = [
  "general",
  "urgent",
  "announcement",
  "case-related",
  "administrative",
];

const PRIORITIES: MessagePriority[] = ["low", "medium", "high", "urgent"];

const FOLDERS: { value: Folder; label: string; icon: React.ReactNode }[] = [
  { value: "inbox", label: "Inbox", icon: <Inbox className="w-4 h-4" /> },
  {
    value: "sent",
    label: "Sent",
    icon: <SendHorizontal className="w-4 h-4" />,
  },
  {
    value: "deleted",
    label: "Deleted",
    icon: <ArchiveX className="w-4 h-4" />,
  },
];

const EMPTY_FORM: FormData = {
  recipients: [],
  subject: "",
  content: "",
  type: "general",
  priority: "medium",
  relatedCase: "",
};

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  limit: 10,
  total: 0,
  pages: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("token");
}

/** "john doe" → "John Doe" */
function fullName(p?: PersonnelRef | null): string {
  if (!p) return "—";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getPriorityClass(p: MessagePriority): string {
  const map: Record<MessagePriority, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };
  return map[p] ?? "bg-gray-100 text-gray-800";
}

function getTypeClass(t: MessageType): string {
  const map: Record<MessageType, string> = {
    general: "bg-blue-100 text-blue-800",
    urgent: "bg-red-100 text-red-800",
    announcement: "bg-purple-100 text-purple-800",
    "case-related": "bg-green-100 text-green-800",
    administrative: "bg-gray-100 text-gray-800",
  };
  return map[t] ?? "bg-gray-100 text-gray-800";
}

// ─── Component ────────────────────────────────────────────────────────────────

const Messages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<PersonnelRef[]>([]);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<Folder>("inbox");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        folder: folderFilter,
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter && typeFilter !== "all" && { type: typeFilter }),
      });

      const res = await fetch(`/api/messages?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.ok) {
        const data = (await res.json()) as {
          messages: Message[];
          pagination: Pagination;
        };
        setMessages(data.messages);
        setPagination(data.pagination);
      } else {
        toast.error("Failed to fetch messages");
      }
    } catch {
      toast.error("Failed to fetch messages");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, typeFilter, folderFilter]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/personnel", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { personnel: PersonnelRef[] };
        setUsers(data.personnel);
      }
    } catch {
      console.error("Failed to fetch personnel");
    }
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      const res = await fetch("/api/cases", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { cases: CaseOption[] };
        setCases(data.cases);
      }
    } catch {
      console.error("Failed to fetch cases");
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);
  useEffect(() => {
    fetchUsers();
    fetchCases();
  }, [fetchUsers, fetchCases]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, folderFilter]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (formData.recipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        relatedCase:
          formData.relatedCase === "none" || !formData.relatedCase
            ? null
            : formData.relatedCase,
      };

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Message sent successfully");
        setIsCreateOpen(false);
        setFormData(EMPTY_FORM);
        await fetchMessages();
      } else {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        toast.success("Message deleted");
        await fetchMessages();
      } else {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to delete message");
      }
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const openViewModal = async (msg: Message) => {
    try {
      const res = await fetch(`/api/messages/${msg._id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { message: Message };
        setSelectedMessage(data.message);
        setIsViewOpen(true);
        // Refresh list so Unread → Read badge updates instantly
        fetchMessages();
      } else {
        toast.error("Failed to load message");
      }
    } catch {
      toast.error("Failed to load message");
    }
  };

  const toggleRecipient = (uid: string) => {
    setFormData((prev) => ({
      ...prev,
      recipients: prev.recipients.includes(uid)
        ? prev.recipients.filter((id) => id !== uid)
        : [...prev.recipients, uid],
    }));
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pt-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Messages</h1>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(EMPTY_FORM)}>
              <Plus className="w-4 h-4 mr-2" />
              Compose Message
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compose New Message</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Recipients */}
              <div>
                <Label>Recipients</Label>
                <Select value="" onValueChange={toggleRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add recipient…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {fullName(u)} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Selected recipient chips */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {formData.recipients.map((uid) => {
                    const u = users.find((x) => x._id === uid);
                    return u ? (
                      <Badge
                        key={uid}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {fullName(u)}
                        <button
                          type="button"
                          onClick={() => toggleRecipient(uid)}
                          className="ml-1 text-xs hover:text-red-600"
                          aria-label={`Remove ${u.firstName}`}
                        >
                          ×
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, subject: e.target.value }))
                  }
                  required
                />
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, type: v as MessageType }))
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESSAGE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {capitalize(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) =>
                      setFormData((p) => ({
                        ...p,
                        priority: v as MessagePriority,
                      }))
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((pr) => (
                        <SelectItem key={pr} value={pr}>
                          {capitalize(pr)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Related case */}
              <div>
                <Label htmlFor="relatedCase">Related Case (Optional)</Label>
                <Select
                  value={formData.relatedCase || "none"}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, relatedCase: v }))
                  }
                >
                  <SelectTrigger id="relatedCase">
                    <SelectValue placeholder="Select a case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No case</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.caseNumber} – {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content */}
              <div>
                <Label htmlFor="content">Message</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, content: e.target.value }))
                  }
                  rows={6}
                  required
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Message
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Folder tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {FOLDERS.map((f) => (
          <Button
            key={f.value}
            variant={folderFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFolderFilter(f.value)}
            className="flex items-center gap-2"
          >
            {f.icon}
            {f.label}
          </Button>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-50 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search messages…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-45">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {MESSAGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {capitalize(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Messages table ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Messages ({pagination.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    {/* <th className="text-left p-2">From</th>
                    <th className="text-left p-2">To</th> */}
                    <th className="text-left p-2">Subject</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Priority</th>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        No messages found
                      </td>
                    </tr>
                  ) : (
                    messages.map((msg) => {
                      // ── Compute From / To strings ──────────────────────────
                      const fromName = fullName(msg.sender);

                      const toNames =
                        msg.recipients
                          .map((r) => fullName(r.user))
                          .filter((n) => n !== "—")
                          .join(", ") || "—";

                      const isRead = msg.recipients.some((r) => r.readStatus);

                      return (
                        <tr key={msg._id} className="border-b hover:bg-gray-50">
                          {/* From */}
                          {/* <td className="p-2">
                            <div className="flex items-center space-x-1">
                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                              <span
                                className="text-sm truncate max-w-30"
                                title={fromName}
                              >
                                {fromName}
                              </span>
                            </div>
                          </td> */}

                          {/* To */}
                          {/* <td className="p-2">
                            <div className="flex items-center space-x-1">
                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                              <span
                                className="text-sm truncate max-w-30"
                                title={toNames}
                              >
                                {toNames}
                              </span>
                            </div>
                          </td> */}

                          {/* Subject */}
                          <td
                            className="p-2 max-w-45 truncate font-medium"
                            title={msg.subject}
                          >
                            {msg.subject}
                          </td>

                          {/* Type */}
                          <td className="p-2">
                            <Badge className={getTypeClass(msg.type)}>
                              {capitalize(msg.type)}
                            </Badge>
                          </td>

                          {/* Priority */}
                          <td className="p-2">
                            <Badge className={getPriorityClass(msg.priority)}>
                              {capitalize(msg.priority)}
                            </Badge>
                          </td>

                          {/* Date */}
                          <td className="p-2">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-sm">
                                {new Date(msg.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </td>

                          {/* Read status — inbox only */}
                          <td className="p-2">
                            {folderFilter === "inbox" && (
                              <Badge variant={isRead ? "secondary" : "default"}>
                                {isRead ? "Read" : "Unread"}
                              </Badge>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-2">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openViewModal(msg)}
                                aria-label="View"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(msg._id)}
                                aria-label="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages} — {pagination.total}{" "}
              message
              {pagination.total !== 1 ? "s" : ""}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, pagination.pages))
                }
                disabled={currentPage === pagination.pages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── View Message Modal ───────────────────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              {/* From + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-medium">
                      {fullName(selectedMessage.sender)}
                    </p>
                  </div>
                  {selectedMessage.sender?.email && (
                    <p className="text-xs text-gray-500 mt-0.5 ml-6">
                      {selectedMessage.sender.email}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Date</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedMessage.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* To */}
              <div>
                <Label>To</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedMessage.recipients.map((r, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      {fullName(r.user)}
                      {r.readStatus && (
                        <span className="ml-1 text-[10px] text-green-600">
                          ✓ read
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label>Subject</Label>
                <p className="text-sm font-medium mt-1">
                  {selectedMessage.subject}
                </p>
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <div className="mt-1">
                    <Badge className={getTypeClass(selectedMessage.type)}>
                      {capitalize(selectedMessage.type)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="mt-1">
                    <Badge
                      className={getPriorityClass(selectedMessage.priority)}
                    >
                      {capitalize(selectedMessage.priority)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Related case */}
              {selectedMessage.relatedCase && (
                <div>
                  <Label>Related Case</Label>
                  <p className="text-sm font-mono mt-1">
                    {selectedMessage.relatedCase.caseNumber} –{" "}
                    {selectedMessage.relatedCase.title}
                  </p>
                </div>
              )}

              {/* Body */}
              <div>
                <Label>Message</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedMessage.content}
                  </p>
                </div>
              </div>

              {/* Attachments */}
              {selectedMessage.attachments.length > 0 && (
                <div>
                  <Label>Attachments</Label>
                  <ul className="mt-1 space-y-1">
                    {selectedMessage.attachments.map((a, idx) => (
                      <li key={idx}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {a.filename}
                        </a>
                        <span className="ml-2 text-xs text-gray-500">
                          ({(a.size / 1024).toFixed(1)} KB)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsViewOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
