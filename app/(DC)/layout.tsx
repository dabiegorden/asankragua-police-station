"use client";

import React, { useState } from "react";
import DcNavbar from "@/components/DcNavbar";
import DcSidebar from "@/components/DcSidebar";
import { StationProvider } from "@/context/StationContext";
import { StationSelector } from "@/components/StationSelector";

const DcLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <StationProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
        {/* Mobile Navbar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30">
          <div className="flex justify-between items-center bg-white h-16 px-4 shadow gap-2">
            <button
              onClick={toggleSidebar}
              className="text-gray-600 focus:outline-none shrink-0"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <DcNavbar />
            </div>
          </div>
          {/* Station selector strip on mobile */}
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center">
            <StationSelector />
          </div>
        </div>

        <div className="flex flex-1 md:pt-0 pt-24">
          {/* Sidebar */}
          <aside
            className={`
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
              md:translate-x-0
              transition-transform duration-300 ease-in-out
              fixed md:relative top-0 md:top-0 left-0 z-40 md:z-0
              w-64 h-screen md:h-screen
              bg-white shadow-lg md:shadow
              flex flex-col
            `}
          >
            <DcSidebar toggleSidebar={toggleSidebar} />
          </aside>

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
              onClick={toggleSidebar}
            />
          )}

          {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="hidden md:block sticky top-0 z-20 bg-white shadow-sm">
              <div className="h-16">
                <DcNavbar />
              </div>
              {/* Station selector bar — desktop */}
              <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-center gap-3">
                <StationSelector />
                <span className="text-xs text-amber-600 italic hidden md:block">
                  All data below is scoped to the selected station.
                </span>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4">
              <div className="container mx-auto">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </StationProvider>
  );
};

export default DcLayout;
