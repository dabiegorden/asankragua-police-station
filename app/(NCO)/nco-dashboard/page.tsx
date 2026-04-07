"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  Car,
  Shield,
  AlertTriangle,
  Clock,
  TrendingUp,
  MessageSquare,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";

const NcoDashboard = () => {
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    closedCases: 0,
    totalPersonnel: 0,
    totalPrisoners: 0,
    totalEvidence: 0,
    totalVehicles: 0,
    totalRifleBookings: 0,
    activeRifleBookings: 0,
    overdueRifleBookings: 0,
    pendingTasks: 0,
  });
  const [recentCases, setRecentCases] = useState([]);
  const [recentContacts, setRecentContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getToken = () => localStorage.getItem("token");

  const fetchDashboardData = async () => {
    try {
      const token = getToken();

      // Fetch dashboard statistics
      const statsResponse = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      // Fetch recent cases
      const casesResponse = await fetch("/api/cases?limit=5", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (casesResponse.ok) {
        const casesData = await casesResponse.json();
        setRecentCases(casesData.cases);
      }

      // Fetch recent contacts
      const contactsResponse = await fetch("/api/contact?limit=5");

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        setRecentContacts(contactsData.contacts);
      }
    } catch (error) {
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: "bg-green-100 text-green-800",
      investigating: "bg-yellow-100 text-yellow-800",
      closed: "bg-gray-100 text-gray-800",
      suspended: "bg-red-100 text-red-800",
      new: "bg-blue-100 text-blue-800",
      "in-progress": "bg-yellow-100 text-yellow-800",
      resolved: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
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
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <Button onClick={fetchDashboardData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cases</p>
                <p className="text-2xl font-bold">{stats.totalCases}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.activeCases} active, {stats.closedCases} closed
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Personnel</p>
                <p className="text-2xl font-bold">{stats.totalPersonnel}</p>
                <p className="text-xs text-gray-500 mt-1">Active officers</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Prisoners</p>
                <p className="text-2xl font-bold">{stats.totalPrisoners}</p>
                <p className="text-xs text-gray-500 mt-1">Currently detained</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vehicles</p>
                <p className="text-2xl font-bold">{stats.totalVehicles}</p>
                <p className="text-xs text-gray-500 mt-1">Fleet vehicles</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Car className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Evidence Items
                </p>
                <p className="text-2xl font-bold">{stats.totalEvidence}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Rifle Bookings
                </p>
                <p className="text-2xl font-bold">{stats.totalRifleBookings}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.activeRifleBookings} active,{" "}
                  {stats.overdueRifleBookings} overdue
                </p>
              </div>
              <Package className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Cases
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.activeCases}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Tasks
                </p>
                <p className="text-2xl font-bold">{stats.pendingTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Recent Cases</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCases.length > 0 ? (
                recentCases.map((caseItem) => (
                  <div
                    key={caseItem._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{caseItem.title}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        {caseItem.caseNumber}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge
                          className={getStatusColor(caseItem.status)}
                          variant="secondary"
                        >
                          {caseItem.status}
                        </Badge>
                        <Badge variant="outline">{caseItem.category}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(caseItem.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No recent cases
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Recent Contact Messages</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentContacts.length > 0 ? (
                recentContacts.map((contact) => (
                  <div
                    key={contact._id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{contact.name}</p>
                      <p className="text-xs text-gray-600 truncate max-w-xs">
                        {contact.subject}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge
                          className={getStatusColor(contact.status)}
                          variant="secondary"
                        >
                          {contact.status}
                        </Badge>
                        <Badge
                          className={getPriorityColor(contact.priority)}
                          variant="outline"
                        >
                          {contact.priority}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No recent contacts
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
            >
              <FileText className="h-6 w-6" />
              <span className="text-sm">New Case</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
            >
              <Users className="h-6 w-6" />
              <span className="text-sm">Add Personnel</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
            >
              <Car className="h-6 w-6" />
              <span className="text-sm">Add Vehicle</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
            >
              <Package className="h-6 w-6" />
              <span className="text-sm">Rifle Booking</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NcoDashboard;
