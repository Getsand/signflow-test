import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Footer Component
 * 
 * Application footer with links and copyright information.
 * Designed to be minimal and consistent with the brand.
 */
export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-neutral-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-neutral-900">SignFlo</span>
            </div>
            <p className="text-sm text-neutral-600 max-w-md">
              Secure, fast, and reliable document signing platform.
              Sign documents from anywhere, at any time.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-semibold text-neutral-900 mb-3">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/dashboard"
                  className="text-sm text-neutral-600 hover:text-primary-600 transition-smooth"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  to="/upload"
                  className="text-sm text-neutral-600 hover:text-primary-600 transition-smooth"
                >
                  Upload Document
                </Link>
              </li>
              <li>
                <Link
                  to="/documents"
                  className="text-sm text-neutral-600 hover:text-primary-600 transition-smooth"
                >
                  My Documents
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-semibold text-neutral-900 mb-3">Support</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm text-neutral-600 hover:text-primary-600 transition-smooth"
                >
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-neutral-600 hover:text-primary-600 transition-smooth"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-neutral-600 hover:text-primary-600 transition-smooth"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-neutral-200 mt-8 pt-6">
          <p className="text-sm text-neutral-600 text-center">
            © {currentYear} SignFlo. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};


