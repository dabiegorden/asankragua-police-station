import { Footer, Navbar } from "@/constants";
import React from "react";

const RouteLayout = ({ children }) => {
  return (
    <div>
      <Navbar />
      {children}
      <Footer />
    </div>
  );
};

export default RouteLayout;
