"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  TrendingUp,
  Loader2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const AdminDashboard = () => {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    usersByRole: {
      admin: 0,
      nco: 0,
      cid: 0,
      so: 0,
      dc: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getToken = () => localStorage.getItem("token");

  const fetchDashboardData = async () => {
    try {
      const token = getToken();

      const statsResponse = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      } else {
        toast.error("Failed to fetch dashboard statistics");
      }
    } catch (error) {
      toast.error("Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button onClick={fetchDashboardData} variant="outline">
          Refresh Data
        </Button>
      </div>

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500 mt-1">
                  All registered users
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Users
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.activeUsers}
                </p>
                <p className="text-xs text-gray-500 mt-1">Currently active</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Inactive Users
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.inactiveUsers}
                </p>
                <p className="text-xs text-gray-500 mt-1">Deactivated</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Admin Users</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.usersByRole.admin}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Administrator accounts
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users by Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Users by Role</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-purple-600">
                {stats.usersByRole.admin}
              </p>
              <p className="text-sm text-gray-600 mt-1">Admin</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-blue-600">
                {stats.usersByRole.nco}
              </p>
              <p className="text-sm text-gray-600 mt-1">NCO</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.usersByRole.cid}
              </p>
              <p className="text-sm text-gray-600 mt-1">CID</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {stats.usersByRole.so}
              </p>
              <p className="text-sm text-gray-600 mt-1">SO</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-orange-600">
                {stats.usersByRole.dc}
              </p>
              <p className="text-sm text-gray-600 mt-1">DC</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
              onClick={() => router.push("/admin-dashboard/users")}
            >
              <Users className="h-6 w-6" />
              <span className="text-sm">Manage Users</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
              onClick={() => router.push("/admin-dashboard/users?action=add")}
            >
              <UserPlus className="h-6 w-6" />
              <span className="text-sm">Add New User</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
              onClick={() => router.push("/admin-dashboard/profile")}
            >
              <Shield className="h-6 w-6" />
              <span className="text-sm">My Profile</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col space-y-2 bg-transparent"
              onClick={() =>
                router.push("/admin-dashboard/users?filter=inactive")
              }
            >
              <UserX className="h-6 w-6" />
              <span className="text-sm">Inactive Users</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
