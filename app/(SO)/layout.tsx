"use client";

import React, { useState } from "react";
import CidSidebar from "@/components/CidSidebar";
import SoNavbar from "@/components/SoNavbar";
import SoSidebar from "@/components/SoSidebar";

const SoLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      {/* Mobile Navbar with hamburger menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30">
        <div className="flex justify-between items-center bg-white h-16 px-4 shadow">
          <button
            onClick={toggleSidebar}
            className="text-gray-600 focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <div className="flex-1 px-4">
            <SoSidebar toggleSidebar={toggleSidebar} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 md:pt-0 pt-16">
        {/* Sidebar - permanent on desktop, overlay on mobile */}
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
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              <CidSidebar toggleSidebar={toggleSidebar} />
            </div>
          </div>
        </aside>

        {/* Mobile overlay when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop navbar - full width */}
          <header className="hidden md:block sticky top-0 z-20 h-16">
            <SoNavbar />
          </header>

          {/* Page content - this is the only part that should scroll */}
          <main className="flex-1 overflow-y-auto p-4 h-[calc(100vh-4rem)]">
            <div className="container mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SoLayout;
