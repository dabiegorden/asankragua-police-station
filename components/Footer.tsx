"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { footerLinks, brandInfo } from "@/constants";
import Image from "next/image";

const Footer = () => {
  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut" },
  };

  return (
    <footer className="bg-gray-900 text-white">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {/* Brand Section */}
          <motion.div variants={cardVariants} className="lg:col-span-1">
            <Link
              href="/"
              className="flex items-center flex-col space-y-3 space-x-3 mb-4 hover:opacity-90 transition-opacity duration-200"
            >
              {/* <div className="text-3xl">{brandInfo.logo}</div> */}
              <Image
                src={brandInfo.shortName}
                width={80}
                height={80}
                alt="logo"
                className="rounded-md"
              />
              <div>
                <h3 className="text-xl font-bold">{brandInfo.name}</h3>
                <p className="text-sm text-gray-400">{brandInfo.tagline}</p>
              </div>
            </Link>
            <p className="text-gray-400 text-sm mb-6">
              Serving the Western North Region with dedication, integrity, and
              modern technology. Your safety is our priority.
            </p>
          </motion.div>

          {/* Footer Links */}
          {footerLinks.map((column, columnIndex) => (
            <motion.div
              key={column.title}
              variants={cardVariants}
              transition={{ delay: (columnIndex + 1) * 0.1 }}
            >
              <h4 className="text-lg font-semibold mb-4">{column.title}</h4>
              <ul className="space-y-2">
                {column.links.map((link, linkIndex) => (
                  <motion.li
                    key={link.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: columnIndex * 0.1 + linkIndex * 0.05,
                    }}
                    viewport={{ once: true }}
                  >
                    {link.href.startsWith("tel:") ||
                    link.href.startsWith("mailto:") ? (
                      <a
                        href={link.href}
                        className="text-gray-400 hover:text-white text-sm transition-all duration-200 hover:translate-x-1 block"
                      >
                        {link.name}
                      </a>
                    ) : link.href === "#" ? (
                      <span className="text-gray-400 text-sm block">
                        {link.name}
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-gray-400 hover:text-white text-sm transition-all duration-200 hover:translate-x-1 block"
                      >
                        {link.name}
                      </Link>
                    )}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Emergency Banner */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true, margin: "-50px" }}
        className="bg-red-600 py-4"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex items-center space-x-3 mb-2 sm:mb-0"
            >
              <span className="text-2xl">🚨</span>
              <div>
                <h4 className="font-bold">Emergency Services</h4>
                <p className="text-sm text-red-100">
                  Available 24/7 for all emergencies
                </p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              className="flex space-x-4"
            >
              <a
                href="tel:191"
                className="bg-white text-red-600 px-4 py-2 rounded-md font-semibold hover:bg-red-50 transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                Call 191
              </a>
              <a
                href={`tel:${brandInfo.phone}`}
                className="border border-white text-white px-4 py-2 rounded-md font-semibold hover:bg-white hover:text-red-600 transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                Station Line
              </a>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Bottom Footer */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true, margin: "-50px" }}
        className="bg-gray-800 py-6"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-sm text-gray-400 mb-4 md:mb-0"
            >
              © {new Date().getFullYear()} {brandInfo.name}. All rights
              reserved.
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex space-x-6 text-sm text-gray-400"
            >
              <Link
                href="/privacy-policy"
                className="hover:text-white transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms-of-service"
                className="hover:text-white transition-colors duration-200"
              >
                Terms of Service
              </Link>
              <Link
                href="/accessibility"
                className="hover:text-white transition-colors duration-200"
              >
                Accessibility
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Scroll to Top Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 z-40"
        title="Scroll to top"
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
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </motion.button>
    </footer>
  );
};

export default Footer;
