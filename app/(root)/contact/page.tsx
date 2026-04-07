"use client";
import { motion } from "framer-motion";
import { brandInfo } from "@/constants";
import { MapPin, Phone, Mail, Clock, AlertTriangle } from "lucide-react";
import ContactForm from "@/components/ContactForm";

export default function ContactPage() {
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
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Contact Us</h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-200 max-w-3xl mx-auto">
              We're here to serve and protect. Reach out to us for any
              assistance, inquiries, or emergency situations.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Emergency Alert */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-red-600 py-4"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-2 sm:mb-0">
              <AlertTriangle className="h-6 w-6 text-white" />
              <div className="text-white">
                <h4 className="font-bold">Emergency? Call Immediately</h4>
                <p className="text-sm text-red-100">
                  For life-threatening situations, don't use this form
                </p>
              </div>
            </div>
            <div className="flex space-x-4">
              <a
                href="tel:191"
                className="bg-white text-red-600 px-6 py-2 rounded-md font-semibold hover:bg-red-50 transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                Call 191
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                Get in Touch
              </h2>

              <div className="space-y-6">
                <div className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
                  <MapPin className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Address</h3>
                    <p className="text-gray-600">{brandInfo.address}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Open 24/7 for emergencies
                    </p>
                  </div>
                </div>

                <a
                  href={`tel:${brandInfo.phone}`}
                  className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:text-blue-600 group"
                >
                  <Phone className="h-6 w-6 text-blue-600 mt-1 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                      Station Phone
                    </h3>
                    <p className="text-gray-600">{brandInfo.phone}</p>
                    <p className="text-sm text-gray-500 mt-1">Available 24/7</p>
                  </div>
                </a>

                <a
                  href={`mailto:${brandInfo.email}`}
                  className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:text-blue-600 group"
                >
                  <Mail className="h-6 w-6 text-blue-600 mt-1 group-hover:scale-110 transition-transform" />
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
                      Email
                    </h3>
                    <p className="text-gray-600">{brandInfo.email}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Response within 24 hours
                    </p>
                  </div>
                </a>

                <div className="flex items-start space-x-4 p-4 bg-white rounded-lg shadow-md">
                  <Clock className="h-6 w-6 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Office Hours
                    </h3>
                    <p className="text-gray-600">
                      Monday - Friday: 8:00 AM - 6:00 PM
                    </p>
                    <p className="text-gray-600">Saturday: 9:00 AM - 4:00 PM</p>
                    <p className="text-gray-600">Sunday: Emergency only</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Emergency services available 24/7
                    </p>
                  </div>
                </div>
              </div>

              {/* Emergency Numbers */}
              <div className="mt-8 p-6 bg-red-50 rounded-lg border border-red-200">
                <h3 className="text-xl font-bold text-red-800 mb-4">
                  Emergency Numbers
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-red-700">Police Emergency</span>
                    <a
                      href="tel:191"
                      className="font-bold text-red-800 hover:underline"
                    >
                      191
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-red-700">Fire Service</span>
                    <a
                      href="tel:192"
                      className="font-bold text-red-800 hover:underline"
                    >
                      192
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-red-700">Ambulance</span>
                    <a
                      href="tel:193"
                      className="font-bold text-red-800 hover:underline"
                    >
                      193
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
              className="bg-white rounded-lg shadow-lg p-8"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                Send us a Message
              </h2>
              <ContactForm source="contact-page" className="shadow-lg p-8" />
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
