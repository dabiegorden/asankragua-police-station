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
  CheckCircle2,
  Circle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContactType =
  | "general"
  | "complaint"
  | "suggestion"
  | "emergency"
  | "other";
type ContactPriority = "low" | "normal" | "high" | "urgent";
type ContactStatus = "new" | "in-progress" | "resolved" | "closed";
type ContactSource =
  | "contact-page"
  | "phone"
  | "email"
  | "walk-in"
  | "homepage";

interface PersonnelRef {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ContactResponse {
  _id?: string;
  message: string;
  respondedBy: PersonnelRef;
  respondedAt: string;
}

interface Contact {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  type: ContactType;
  priority: ContactPriority;
  status: ContactStatus;
  source: ContactSource;
  assignedTo?: PersonnelRef | null;
  isRead: boolean;
  readBy?: PersonnelRef | null;
  readAt?: string;
  responses: ContactResponse[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES: ContactStatus[] = ["new", "in-progress", "resolved", "closed"];
const PRIORITIES: ContactPriority[] = ["low", "normal", "high", "urgent"];

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

function fullName(p?: PersonnelRef | null): string {
  if (!p) return "—";
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getStatusClass(s: ContactStatus): string {
  const map: Record<ContactStatus, string> = {
    new: "bg-blue-100 text-blue-800",
    "in-progress": "bg-yellow-100 text-yellow-800",
    resolved: "bg-green-100 text-green-800",
    closed: "bg-gray-100 text-gray-800",
  };
  return map[s] ?? "bg-gray-100 text-gray-800";
}

function getPriorityClass(p: ContactPriority): string {
  const map: Record<ContactPriority, string> = {
    low: "bg-green-100 text-green-800",
    normal: "bg-blue-100 text-blue-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };
  return map[p] ?? "bg-gray-100 text-gray-800";
}

// ─── Component ────────────────────────────────────────────────────────────────

const ContactManagement = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRef[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isViewOpen, setIsViewOpen] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== "all" && { status: statusFilter }),
        ...(priorityFilter &&
          priorityFilter !== "all" && { priority: priorityFilter }),
      });

      const res = await fetch(`/api/contact?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (res.ok) {
        const data = (await res.json()) as {
          contacts: Contact[];
          pagination: Pagination;
        };
        setContacts(data.contacts);
        setPagination(data.pagination);
      } else {
        toast.error("Failed to fetch contacts");
      }
    } catch {
      toast.error("Failed to fetch contacts");
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter, priorityFilter]);

  const fetchPersonnel = useCallback(async () => {
    try {
      const res = await fetch("/api/personnel", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { personnel: PersonnelRef[] };
        setPersonnel(data.personnel);
      }
    } catch {
      console.error("Failed to fetch personnel");
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);
  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, priorityFilter]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const patchContact = async (
    contactId: string,
    payload: Record<string, unknown>,
    successMsg: string,
  ) => {
    const res = await fetch(`/api/contact/${contactId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(successMsg);
      await fetchContacts();
      // Refresh the modal if it's open for this contact
      if (selectedContact?._id === contactId) {
        const detail = (await res.json()) as { contact: Contact };
        setSelectedContact(detail.contact);
      }
      return true;
    }

    const err = (await res.json()) as { error?: string };
    toast.error(err.error ?? "Update failed");
    return false;
  };

  const handleStatusUpdate = async (
    contactId: string,
    status: ContactStatus,
  ) => {
    await patchContact(contactId, { status }, "Status updated");
  };

  const handleAssignTo = async (contactId: string, userId: string) => {
    await patchContact(
      contactId,
      { assignedTo: userId === "unassigned" ? null : userId },
      "Contact assigned",
    );
    // Update modal state immediately if open
    if (selectedContact?._id === contactId) {
      const matched = personnel.find((p) => p._id === userId) ?? null;
      setSelectedContact((prev) =>
        prev ? { ...prev, assignedTo: matched } : prev,
      );
    }
  };

  const handleResponse = async (contactId: string) => {
    if (!responseText.trim()) {
      toast.error("Please enter a response");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contact/${contactId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ response: responseText }),
      });

      if (res.ok) {
        toast.success("Response sent");
        setResponseText("");
        await fetchContacts();
        // Refresh selected contact so new response appears immediately
        const data = (await res.json()) as { contact: Contact };
        setSelectedContact(data.contact);
      } else {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to send response");
      }
    } catch {
      toast.error("Failed to send response");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      const res = await fetch(`/api/contact/${contactId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        toast.success("Contact deleted");
        await fetchContacts();
        setIsViewOpen(false);
        setSelectedContact(null);
      } else {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to delete contact");
      }
    } catch {
      toast.error("Failed to delete contact");
    }
  };

  const openViewModal = async (contact: Contact) => {
    try {
      const res = await fetch(`/api/contact/${contact._id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { contact: Contact };
        setSelectedContact(data.contact);
        setResponseText("");
        setIsViewOpen(true);
        // Update read status in the list without a full refetch
        setContacts((prev) =>
          prev.map((c) => (c._id === contact._id ? { ...c, isRead: true } : c)),
        );
      } else {
        toast.error("Failed to load contact");
      }
    } catch {
      toast.error("Failed to load contact");
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pt-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Contact Messages</h1>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-50 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search contacts…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {capitalize(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {capitalize(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Contacts table ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Messages ({pagination.total})</CardTitle>
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
                    <th className="text-left p-2">Read</th>
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
                  {contacts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500">
                        No contacts found
                      </td>
                    </tr>
                  ) : (
                    contacts.map((contact) => (
                      <tr
                        key={contact._id}
                        className={`border-b hover:bg-gray-50 ${
                          !contact.isRead ? "font-semibold bg-blue-50/40" : ""
                        }`}
                      >
                        {/* Read indicator */}
                        <td className="p-2">
                          {contact.isRead ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Circle className="w-4 h-4 text-blue-500" />
                          )}
                        </td>

                        {/* Name */}
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <User className="w-4 h-4 text-gray-400 shrink-0" />
                            <span
                              className="truncate max-w-30"
                              title={contact.name}
                            >
                              {contact.name}
                            </span>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                            <span
                              className="text-sm truncate max-w-37.5"
                              title={contact.email}
                            >
                              {contact.email}
                            </span>
                          </div>
                        </td>

                        {/* Subject */}
                        <td
                          className="p-2 max-w-40 truncate"
                          title={contact.subject}
                        >
                          {contact.subject}
                        </td>

                        {/* Type */}
                        <td className="p-2">
                          <Badge variant="outline">
                            {capitalize(contact.type)}
                          </Badge>
                        </td>

                        {/* Priority */}
                        <td className="p-2">
                          <Badge className={getPriorityClass(contact.priority)}>
                            {capitalize(contact.priority)}
                          </Badge>
                        </td>

                        {/* Status — inline quick-change */}
                        <td className="p-2">
                          <Select
                            value={contact.status}
                            onValueChange={(v) =>
                              handleStatusUpdate(
                                contact._id,
                                v as ContactStatus,
                              )
                            }
                          >
                            <SelectTrigger className="w-36 h-8 text-xs">
                              <SelectValue>
                                <Badge
                                  className={getStatusClass(contact.status)}
                                >
                                  {capitalize(contact.status)}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  <Badge className={getStatusClass(s)}>
                                    {capitalize(s)}
                                  </Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Date */}
                        <td className="p-2">
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-sm">
                              {new Date(contact.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-2">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openViewModal(contact)}
                              aria-label="View contact"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(contact._id)}
                              aria-label="Delete contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <span className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.pages} — {pagination.total}{" "}
              contact
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

      {/* ── View / Manage Contact Modal ──────────────────────────────────────── */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-6">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="text-sm font-medium mt-1">
                    {selectedContact.name}
                  </p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm mt-1">{selectedContact.email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-sm mt-1">
                    {selectedContact.phone || "Not provided"}
                  </p>
                </div>
                <div>
                  <Label>Date Submitted</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedContact.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label>Source</Label>
                  <Badge variant="outline" className="mt-1">
                    {capitalize(selectedContact.source)}
                  </Badge>
                </div>
                <div>
                  <Label>Read By</Label>
                  <p className="text-sm mt-1">
                    {selectedContact.isRead
                      ? fullName(selectedContact.readBy)
                      : "Unread"}
                  </p>
                </div>
              </div>

              {/* Status, Priority, Type */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={selectedContact.status}
                    onValueChange={(v) =>
                      handleStatusUpdate(
                        selectedContact._id,
                        v as ContactStatus,
                      )
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue>
                        <Badge
                          className={getStatusClass(selectedContact.status)}
                        >
                          {capitalize(selectedContact.status)}
                        </Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          <Badge className={getStatusClass(s)}>
                            {capitalize(s)}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="mt-1">
                    <Badge
                      className={getPriorityClass(selectedContact.priority)}
                    >
                      {capitalize(selectedContact.priority)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Type</Label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {capitalize(selectedContact.type)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Subject + Message */}
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

              {/* Notes */}
              <div>
                <Label>Internal Notes</Label>
                <p className="text-sm mt-1 text-gray-600 italic">
                  {selectedContact.notes || "No notes yet"}
                </p>
              </div>

              {/* Assign to */}
              <div>
                <Label>Assigned To</Label>
                <Select
                  value={selectedContact.assignedTo?._id ?? "unassigned"}
                  onValueChange={(v) => handleAssignTo(selectedContact._id, v)}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select personnel to assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {personnel.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {fullName(p)} — {p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Previous responses */}
              {selectedContact.responses.length > 0 && (
                <div>
                  <Label>
                    Previous Responses ({selectedContact.responses.length})
                  </Label>
                  <div className="mt-2 space-y-3">
                    {selectedContact.responses.map((r, idx) => (
                      <div
                        key={r._id ?? idx}
                        className="p-3 bg-blue-50 rounded-md"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium">
                            {fullName(r.respondedBy)}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(r.respondedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{r.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Send response */}
              <div>
                <Label>Send Response</Label>
                <Textarea
                  placeholder="Type your response here…"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="mt-1"
                  rows={4}
                />
                <div className="flex justify-between mt-2">
                  <Button
                    onClick={() => handleResponse(selectedContact._id)}
                    disabled={!responseText.trim() || submitting}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4 mr-2" />
                    )}
                    Send Response
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selectedContact._id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Contact
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactManagement;
