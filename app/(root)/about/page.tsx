"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { brandInfo } from "@/constants";

export default function AboutPage() {
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
            <div className="text-8xl mb-6">{brandInfo.logo}</div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">About Us</h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-200 max-w-3xl mx-auto">
              Dedicated to serving and protecting the Western North Region with
              integrity, professionalism, and modern technology
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Our Story
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                The Asankrangwa Police District has been serving the Western
                North Region of Ghana for decades, evolving from traditional
                policing methods to embracing cutting-edge technology and modern
                management systems.
              </p>
              <p className="text-gray-600 mb-6">
                Our commitment to excellence drives us to continuously improve
                our services, enhance community relationships, and maintain the
                highest standards of law enforcement. We believe in
                transparency, accountability, and the power of technology to
                make our communities safer.
              </p>
              <p className="text-gray-600">
                Today, we stand as a model police district, leading the way in
                digital transformation and community policing initiatives across
                Ghana.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
              className="bg-blue-50 rounded-lg p-8"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Quick Facts
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Established</span>
                  <span className="font-semibold">1960</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Officers & Staff</span>
                  <span className="font-semibold">100+</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Service Area</span>
                  <span className="font-semibold">Western North Region</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Population Served</span>
                  <span className="font-semibold">50,000+</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Response Time</span>
                  <span className="font-semibold">&lt; 15 minutes</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Mission & Vision */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
              className="bg-blue-900 rounded-lg p-8 text-white"
            >
              <h3 className="text-2xl font-bold mb-6">Our Mission</h3>
              <p className="text-blue-100">
                To protect and serve our community with integrity,
                professionalism, and dedication while maintaining the highest
                standards of law enforcement through modern technology and
                community engagement.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
              className="bg-gray-100 rounded-lg p-8"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Our Vision
              </h3>
              <p className="text-gray-600">
                To be a model police district that sets the standard for
                excellence in law enforcement, community safety, and digital
                innovation across Ghana.
              </p>
            </motion.div>
          </div>

          {/* Values */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Our Core Values
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              These values guide everything we do and shape our commitment to
              the community we serve
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {[
              {
                icon: "🛡️",
                title: "Integrity",
                description:
                  "We uphold the highest ethical standards in all our actions and decisions.",
              },
              {
                icon: "🤝",
                title: "Community",
                description:
                  "We build strong partnerships with the communities we serve.",
              },
              {
                icon: "⚖️",
                title: "Justice",
                description:
                  "We ensure fair and impartial treatment for all citizens.",
              },
              {
                icon: "💡",
                title: "Innovation",
                description:
                  "We embrace technology and modern methods to improve our services.",
              },
            ].map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="text-4xl mb-4">{value.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {value.title}
                </h3>
                <p className="text-gray-600 text-sm">{value.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Join Our Mission
            </h2>
            <p className="text-xl mb-8 text-gray-600">
              Together, we can build safer, stronger communities for everyone
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                Get in Touch
              </Link>
              <Link
                href="/services"
                className="border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 hover:text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
              >
                Our Services
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
