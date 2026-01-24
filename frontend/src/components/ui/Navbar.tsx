import React from 'react';
import { Link } from 'react-router-dom';

export interface NavbarProps {
  user?: {
    name: string;
    email: string;
  } | null;
  onLogout?: () => void;
}

/**
 * Navbar Component
 * 
 * Main navigation bar for the authenticated application.
 * Shows logo, navigation links, and user profile dropdown.
 */
export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);

  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center group-hover:scale-105 transition-smooth">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-neutral-900">SignFlo</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center gap-6">
              <Link
                to="/dashboard"
                className="text-neutral-700 hover:text-primary-600 font-medium transition-smooth"
              >
                Dashboard
              </Link>
              <Link
                to="/upload"
                className="text-neutral-700 hover:text-primary-600 font-medium transition-smooth"
              >
                Upload
              </Link>
              <Link
                to="/documents"
                className="text-neutral-700 hover:text-primary-600 font-medium transition-smooth"
              >
                Documents
              </Link>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-100 transition-smooth"
                >
                  <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <svg
                    className="w-4 h-4 text-neutral-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-neutral-200 py-2 animate-slide-down">
                    <div className="px-4 py-3 border-b border-neutral-200">
                      <p className="text-sm font-semibold text-neutral-900">{user.name}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{user.email}</p>
                    </div>
                    <button
                      onClick={onLogout}
                      className="w-full text-left px-4 py-2 text-sm text-error-600 hover:bg-error-50 transition-smooth"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile menu button */}
          {user && (
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-smooth"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && user && (
          <div className="md:hidden py-4 border-t border-neutral-200 animate-slide-down">
            <div className="flex flex-col gap-2">
              <Link
                to="/dashboard"
                className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-smooth"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/upload"
                className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-smooth"
                onClick={() => setMobileMenuOpen(false)}
              >
                Upload
              </Link>
              <Link
                to="/documents"
                className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-smooth"
                onClick={() => setMobileMenuOpen(false)}
              >
                Documents
              </Link>
              <div className="border-t border-neutral-200 my-2"></div>
              <div className="px-4 py-2">
                <p className="text-sm font-semibold text-neutral-900">{user.name}</p>
                <p className="text-xs text-neutral-600 mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={onLogout}
                className="mx-2 px-4 py-2 text-error-600 hover:bg-error-50 rounded-lg transition-smooth text-left"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};


