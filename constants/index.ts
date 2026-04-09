import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import AdminNavbar from "@/components/shared/AdminNavbar";
import AdminSidebar from "@/components/shared/AdminSidebar";

import {
  BarChart3,
  Calendar,
  Car,
  Contact2Icon,
  FileText,
  Home,
  HomeIcon,
  MessageSquare,
  Package,
  UserCheck,
  Users,
} from "lucide-react";

export { Navbar, Hero, Footer, AdminNavbar, AdminSidebar };

export const AdminSidebarLinks = [
  { id: 1, url: "/admin-dashboard", title: "Dashboard", icon: Home },
  { id: 2, url: "/admin-dashboard/users", title: "Users", icon: Users },
  { id: 12, url: "/", title: "Home", icon: HomeIcon },
];

export const CidLinks = [
  { id: 1, url: "/cid-dashboard", title: "Dashboard", icon: Home },
  { id: 2, url: "/cid-dashboard/cases", title: "Cases", icon: FileText },
  { id: 3, url: "/cid-dashboard/profile", title: "Profile", icon: Users },
  { id: 4, url: "/", title: "Home", icon: HomeIcon },
];

export const SoLinks = [
  { id: 1, url: "/so-dashboard", title: "Dashboard", icon: Home },
  { id: 2, url: "/so-dashboard/cases", title: "Cases", icon: FileText },
  { id: 3, url: "/so-dashboard/profile", title: "Profile", icon: Users },
  { id: 4, url: "/", title: "Home", icon: HomeIcon },
];

export const NcoLinks = [
  { id: 1, url: "/nco-dashboard", title: "Dashboard", icon: Home },
  { id: 2, url: "/nco-dashboard/cases", title: "Cases", icon: FileText },
  { id: 3, url: "/nco-dashboard/personnel", title: "Personnel", icon: Users },
  {
    id: 4,
    url: "/nco-dashboard/prisoners",
    title: "Prisoners",
    icon: UserCheck,
  },
  // { id: 5, url: "/nco-dashboard/evidence", title: "Evidence", icon: Package },
  { id: 6, url: "/nco-dashboard/vehicles", title: "Vehicles", icon: Car },
  {
    id: 7,
    url: "/nco-dashboard/schedule",
    title: "Schedule",
    icon: Calendar,
  },
  {
    id: 8,
    url: "/nco-dashboard/rifle",
    title: "Rifle Booking",
    icon: Calendar,
  },
  {
    id: 10,
    url: "/nco-dashboard/messages",
    title: "Messages",
    icon: MessageSquare,
  },
  {
    id: 11,
    url: "/nco-dashboard/contact",
    title: "Contacts",
    icon: Contact2Icon,
  },
  { id: 9, url: "/nco-dashboard/reports", title: "Reports", icon: BarChart3 },
  { id: 12, url: "/", title: "Home", icon: HomeIcon },
];

// Navigation Links
export const navLinks = [
  {
    id: "home",
    title: "Home",
    href: "/",
  },
  {
    id: "services",
    title: "Services",
    href: "/services",
  },
  {
    id: "about",
    title: "About",
    href: "/about",
  },
  {
    id: "contact",
    title: "Contact",
    href: "/contact",
  },
];

// Services/Features Links
export const servicesLinks = [
  {
    id: "case-management",
    title: "Case Management",
    description: "Register and track cases reported to the police station",
    icon: "📋",
  },
  {
    id: "personnel-management",
    title: "Personnel Management",
    description:
      "Maintain records of police personnel, schedules, and assignments",
    icon: "👮‍♂️",
  },
  {
    id: "prisoner-management",
    title: "Prisoner Management",
    description:
      "Track prisoner information including intake, release, and location",
    icon: "🔒",
  },
  {
    id: "evidence-management",
    title: "Evidence Management",
    description: "Track and manage chain of custody for collected evidence",
    icon: "🔍",
  },
  {
    id: "scheduling",
    title: "Scheduling & Agenda",
    description: "Organize tasks, meetings, and patrols for police staff",
    icon: "📅",
  },
  {
    id: "reporting",
    title: "Reporting & Statistics",
    description: "Generate performance reports and crime statistics",
    icon: "📊",
  },
  {
    id: "vehicle-management",
    title: "Vehicle Management",
    description:
      "Maintain records of police vehicles and maintenance schedules",
    icon: "🚔",
  },
  {
    id: "communication",
    title: "Internal Communication",
    description:
      "Facilitate communication through internal messaging and alerts",
    icon: "💬",
  },
];

// Footer Links
export const footerLinks = [
  {
    title: "Quick Links",
    links: [
      { name: "Home", href: "/" },
      { name: "Services", href: "/services" },
      { name: "About", href: "/about" },
      { name: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { name: "Case Management", href: "/case-management" },
      { name: "Personnel Management", href: "/personnel-management" },
      { name: "Evidence Management", href: "/evidence-management" },
      { name: "Reporting", href: "/reporting" },
    ],
  },
  {
    title: "Contact Info",
    links: [
      { name: "Emergency: 191", href: "tel:191" },
      { name: "Station: +233-XXX-XXXX", href: "tel:+233" },
      {
        name: "Email: info@asankrangwa.police.gov.gh",
        href: "mailto:info@asankrangwa.police.gov.gh",
      },
      { name: "Asankrangwa, Western North Region", href: "#" },
    ],
  },
];

// Logo and Brand Info
export const brandInfo = {
  name: "Asankrangwa Police District",
  shortName: "/assets/officer.jpg",
  tagline: "Protecting and Serving Our Community",
  logo: "🛡️",
  address: "Asankrangwa, Western North Region, Ghana",
  phone: "+233-XXX-XXXX",
  email: "info@asankrangwa.police.gov.gh",
};
