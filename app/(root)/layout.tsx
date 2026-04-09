import { Footer, Navbar } from "@/constants";
import React from "react";

const RouteLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <Navbar />
      {children}
      <Footer />
    </div>
  );
};

export default RouteLayout;
