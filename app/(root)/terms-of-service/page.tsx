"use client";
import { motion } from "framer-motion";
import { brandInfo } from "@/constants";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Terms of Service
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-200 max-w-3xl mx-auto">
              Guidelines for using our services and systems
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
            className="prose prose-lg max-w-none"
          >
            <div className="mb-8">
              <p className="text-gray-600 text-sm">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-600 mb-4">
                  By accessing and using the Asankrangwa Police District
                  services and website, you agree to be bound by these Terms of
                  Service and all applicable laws and regulations.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  2. Use of Services
                </h2>
                <p className="text-gray-600 mb-4">
                  Our services are provided for:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Reporting crimes and incidents</li>
                  <li>Accessing public safety information</li>
                  <li>Communicating with law enforcement</li>
                  <li>Obtaining police services</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  3. Prohibited Uses
                </h2>
                <p className="text-gray-600 mb-4">
                  You may not use our services to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Provide false or misleading information</li>
                  <li>Interfere with law enforcement operations</li>
                  <li>Violate any applicable laws or regulations</li>
                  <li>Harass or threaten others</li>
                  <li>Attempt unauthorized access to our systems</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  4. Emergency Services
                </h2>
                <p className="text-gray-600 mb-4">
                  For life-threatening emergencies, always call 191 immediately.
                  Our website and digital services are not intended for
                  emergency reporting.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  5. Information Accuracy
                </h2>
                <p className="text-gray-600 mb-4">
                  You are responsible for providing accurate and truthful
                  information. False reporting is a criminal offense and will be
                  prosecuted to the full extent of the law.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  6. Limitation of Liability
                </h2>
                <p className="text-gray-600 mb-4">
                  The Asankrangwa Police District provides services to the best
                  of our ability but cannot guarantee specific outcomes or
                  response times except in emergency situations.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  7. Changes to Terms
                </h2>
                <p className="text-gray-600 mb-4">
                  We reserve the right to modify these terms at any time.
                  Changes will be posted on this page with an updated revision
                  date.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  8. Contact Information
                </h2>
                <p className="text-gray-600 mb-4">
                  For questions about these terms, please contact us:
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Email:</strong> {brandInfo.email}
                  </p>
                  <p className="text-gray-700">
                    <strong>Phone:</strong> {brandInfo.phone}
                  </p>
                  <p className="text-gray-700">
                    <strong>Address:</strong> {brandInfo.address}
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
