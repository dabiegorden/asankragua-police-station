"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { navLinks, brandInfo } from "@/constants";
import {
  ChevronDown,
  User,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import Image from "next/image";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const mobileMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Handle clicking outside mobile menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle clicking outside user menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    closeUserMenu();
    router.push("/login");
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ""}${
      lastName?.charAt(0) || ""
    }`.toUpperCase();
  };

  const canAccessDashboard = user && user.role === "admin"; //Later will add officer role to it  || user.role === "officer"

  return (
    <nav
      className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-blue-900/95 backdrop-blur-md shadow-lg" : "bg-blue-900"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <Link
            href="/"
            className="flex gap-2 items-center hover:opacity-90 transition-opacity duration-200"
          >
            {/* <div className="text-3xl">{brandInfo.logo}</div> */}
            <Image
              src={brandInfo.shortName}
              width={60}
              height={70}
              alt="logo"
              className="rounded-full ring-2 ring-red-500 shadow-2xl"
            />
            <div className="text-white">
              <h1 className="text-lg font-bold">{brandInfo.name}</h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className="text-blue-100 hover:text-white hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  {link.title}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop User Menu and Emergency Button */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="tel:191"
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-2 hover:scale-105 hover:shadow-lg"
            >
              <span>🚨</span>
              <span>Emergency 191</span>
            </a>

            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={toggleUserMenu}
                  className="flex items-center space-x-2 text-white hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200"
                >
                  <div className="w-8 h-8 bg-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {getInitials(user.firstName, user.lastName)}
                  </div>
                  <span className="hidden lg:block">{user.firstName}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                      <p className="text-xs text-blue-600 font-medium capitalize">
                        {user.role}
                      </p>
                    </div>

                    {canAccessDashboard && (
                      <Link
                        href="/dashboard"
                        onClick={closeUserMenu}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                      >
                        <LayoutDashboard className="mr-3 h-4 w-4" />
                        Dashboard
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors duration-200"
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-red-600 hover:bg-red-700 hover:scale-105 hover:shadow-lg text-white px-3 py-2 rounded-md text-sm font-medium transition-all duration-300"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="text-blue-100 hover:text-white focus:outline-none focus:text-white transition-colors duration-200"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden" ref={mobileMenuRef}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-blue-900 border-t border-blue-800">
            {navLinks.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                onClick={closeMobileMenu}
                className="text-blue-100 hover:text-white hover:bg-blue-800 block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-all duration-200 hover:translate-x-1"
              >
                {link.title}
              </Link>
            ))}

            {user ? (
              <div className="border-t border-blue-800 pt-4 mt-4">
                <div className="px-3 py-2 text-blue-100">
                  <p className="font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-blue-300">{user.email}</p>
                  <p className="text-xs text-blue-200 capitalize">
                    {user.role}
                  </p>
                </div>

                {canAccessDashboard && (
                  <Link
                    href="/dashboard"
                    onClick={closeMobileMenu}
                    className="text-blue-100 hover:text-white hover:bg-blue-800 block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-all duration-200 hover:translate-x-1"
                  >
                    Dashboard
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="text-red-300 hover:text-white hover:bg-red-700 block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-all duration-200 hover:translate-x-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={closeMobileMenu}
                className="bg-red-600 hover:bg-red-700 text-white block px-3 py-2 rounded-md text-base font-medium mt-4 transition-all duration-200 hover:translate-x-1"
              >
                Login
              </Link>
            )}

            <div className="border-t border-blue-800 pt-4 mt-4">
              <a
                href="tel:191"
                onClick={closeMobileMenu}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-base font-medium flex items-center space-x-2 transition-all duration-200 hover:translate-x-1"
              >
                <span>🚨</span>
                <span>Emergency 191</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
