"use client";
import { motion } from "framer-motion";
import { brandInfo } from "@/constants";

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-200 max-w-3xl mx-auto">
              Your privacy and data protection are our top priorities
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
                  1. Information We Collect
                </h2>
                <p className="text-gray-600 mb-4">
                  The Asankrangwa Police District collects information necessary
                  for law enforcement purposes and public safety. This includes:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>
                    Personal identification information when filing reports
                  </li>
                  <li>Contact information for communication purposes</li>
                  <li>Case-related information and evidence</li>
                  <li>Website usage data for system improvement</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  2. How We Use Your Information
                </h2>
                <p className="text-gray-600 mb-4">
                  We use collected information for:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Processing and investigating reported cases</li>
                  <li>Maintaining public safety and security</li>
                  <li>Communicating with citizens and stakeholders</li>
                  <li>Improving our services and systems</li>
                  <li>Complying with legal obligations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  3. Information Sharing
                </h2>
                <p className="text-gray-600 mb-4">
                  We may share information with other law enforcement agencies,
                  government bodies, and authorized personnel as required by law
                  or necessary for public safety.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  4. Data Security
                </h2>
                <p className="text-gray-600 mb-4">
                  We implement appropriate security measures to protect your
                  information against unauthorized access, alteration,
                  disclosure, or destruction.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  5. Your Rights
                </h2>
                <p className="text-gray-600 mb-4">You have the right to:</p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Request access to your personal information</li>
                  <li>Request correction of inaccurate information</li>
                  <li>File complaints about data handling</li>
                  <li>Understand how your information is being used</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  6. Contact Us
                </h2>
                <p className="text-gray-600 mb-4">
                  If you have questions about this privacy policy, please
                  contact us:
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
