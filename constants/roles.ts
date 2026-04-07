export type UserRole = "admin" | "nco" | "cid" | "so" | "dc";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  nco: "NCO / Station Orderly",
  cid: "Investigator (CID)",
  so: "Station Officer",
  dc: "District Commander",
};

export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  admin: "/admin-dashboard",
  nco: "/nco-dashboard",
  cid: "/cid-dashboard",
  so: "/so-dashboard",
  dc: "/dc-dashboard",
};

// Roles that can access a dashboard at all
export const DASHBOARD_ROLES: UserRole[] = ["admin", "nco", "cid", "so", "dc"];
