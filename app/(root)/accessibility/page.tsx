"use client";
import { motion } from "framer-motion";
import { brandInfo } from "@/constants";

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section */}
      <section className="bg-linear-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Accessibility
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-200 max-w-3xl mx-auto">
              Ensuring equal access to police services for all community members
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
            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Our Commitment
                </h2>
                <p className="text-gray-600 mb-4">
                  The Asankrangwa Police District is committed to ensuring that
                  our services are accessible to all members of our community,
                  including persons with disabilities. We strive to provide
                  equal access to information and functionality.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Website Accessibility Features
                </h2>
                <p className="text-gray-600 mb-4">
                  Our website includes the following accessibility features:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Keyboard navigation support</li>
                  <li>Screen reader compatibility</li>
                  <li>High contrast color schemes</li>
                  <li>Scalable text and images</li>
                  <li>Alternative text for images</li>
                  <li>Clear and consistent navigation</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Physical Accessibility
                </h2>
                <p className="text-gray-600 mb-4">
                  Our police station facilities feature:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Wheelchair accessible entrances and facilities</li>
                  <li>Accessible parking spaces</li>
                  <li>Clear signage and wayfinding</li>
                  <li>Accessible restrooms</li>
                  <li>Hearing loop systems where available</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Communication Assistance
                </h2>
                <p className="text-gray-600 mb-4">
                  We provide various communication assistance options:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Sign language interpreters (upon request)</li>
                  <li>Written communication options</li>
                  <li>Large print materials</li>
                  <li>Audio assistance devices</li>
                  <li>Multilingual support</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Emergency Services
                </h2>
                <p className="text-gray-600 mb-4">
                  Emergency services are available through multiple channels:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Voice calls to 191</li>
                  <li>Text messaging for hearing impaired (where available)</li>
                  <li>In-person reporting at the station</li>
                  <li>Online reporting for non-emergency situations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Feedback and Assistance
                </h2>
                <p className="text-gray-600 mb-4">
                  If you encounter any accessibility barriers or need assistance
                  accessing our services, please contact us:
                </p>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Accessibility Coordinator:</strong>{" "}
                    {brandInfo.email}
                  </p>
                  <p className="text-gray-700">
                    <strong>Phone:</strong> {brandInfo.phone}
                  </p>
                  <p className="text-gray-700">
                    <strong>Address:</strong> {brandInfo.address}
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Continuous Improvement
                </h2>
                <p className="text-gray-600 mb-4">
                  We are continuously working to improve the accessibility of
                  our services. We welcome feedback and suggestions on how we
                  can better serve all members of our community.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Standards Compliance
                </h2>
                <p className="text-gray-600 mb-4">
                  We strive to meet or exceed accessibility standards including:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Web Content Accessibility Guidelines (WCAG) 2.1</li>
                  <li>Ghana Disability Act compliance</li>
                  <li>International accessibility best practices</li>
                </ul>
              </section>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
