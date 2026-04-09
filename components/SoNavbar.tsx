"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_DASHBOARDS, UserRole } from "@/constants/roles";

interface StoredUser {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  profilePhoto?: string;
  stationId?: string;
}

export default function SoNavbar() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  // Re-fetch fresh user data from the API on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          // Keep localStorage in sync
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      })
      .catch(() => {
        // Silently fail — cached localStorage data is fine as fallback
      });
  }, []);

  const firstName = user?.fullName?.split(" ")[0] ?? "User";

  return (
    <header className="bg-white border-b w-full border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Greeting */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Welcome back, {firstName}!
          </h2>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {user && (
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex capitalize"
            >
              {ROLE_LABELS[user.role]}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={user?.profilePhoto ?? ""}
                    alt={user?.fullName ?? "User"}
                  />
                  <AvatarFallback className="bg-blue-600 text-white text-sm font-bold">
                    {user ? getInitials(user.fullName) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-60" align="end" forceMount>
              <DropdownMenuLabel>
                <div className="flex items-center gap-3 py-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user?.profilePhoto ?? ""} />
                    <AvatarFallback className="bg-blue-600 text-white text-sm font-bold">
                      {user ? getInitials(user.fullName) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                    {user && (
                      <span className="text-xs text-blue-600 font-medium">
                        {ROLE_LABELS[user.role]}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {/* Switch Dashboard — useful if a user navigates away */}
              {/* {user && (
                <DropdownMenuItem
                  onClick={() => router.push(ROLE_DASHBOARDS[user.role])}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  My Dashboard
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator /> */}

              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
