"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, HomeIcon, Users } from "lucide-react";

interface toggleSidebar {
  toggleSidebar?: () => void;
}

const SoSidebar = ({ toggleSidebar }: toggleSidebar) => {
  const pathname = usePathname();

  // Links defined directly in the component
  const StationOfficerLinks = [
    { id: 1, url: "/so-dashboard", title: "Dashboard", icon: Home },
    { id: 2, url: "/so-dashboard/cases", title: "Cases", icon: FileText },
    { id: 3, url: "/so-dashboard/profile", title: "Profile", icon: Users },
    { id: 4, url: "/", title: "Home", icon: HomeIcon },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white shadow-xl">
      {/* Sidebar Content */}
      <div className="flex-1 py-6 h-full overflow-y-auto">
        <nav className="px-3 space-y-2">
          {StationOfficerLinks.map((item) => {
            const isActive =
              pathname === item.url ||
              (pathname && pathname.startsWith(`${item.url}/`));
            const Icon = item.icon;

            return (
              <Link
                key={item.id}
                href={item.url}
                onClick={() => {
                  if (toggleSidebar && window.innerWidth < 768) {
                    toggleSidebar();
                  }
                }}
                className={`
                  group flex items-center px-4 py-3 text-sm font-medium rounded-lg
                  ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-indigo-100 hover:bg-indigo-700 hover:text-white"
                  }
                  transition-all duration-200 transform hover:translate-x-1
                `}
              >
                <Icon
                  className={`
                    mr-3 shrink-0 h-5 w-5 
                    ${
                      isActive
                        ? "text-indigo-200"
                        : "text-indigo-300 group-hover:text-white"
                    }
                  `}
                />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default SoSidebar;
