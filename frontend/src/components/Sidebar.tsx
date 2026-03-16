/**
 * Sidebar Component
 *
 * Zoho-style left sidebar: logo, nav links, user block at bottom.
 * Fixed width, collapsible on mobile.
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const sidebarItems: SidebarItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Documents',
    path: '/documents',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Templates',
    path: '/templates',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Close profile dropdown when navigating
  React.useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/documents') {
      return location.pathname.startsWith('/documents');
    }
    if (path === '/templates') {
      return location.pathname.startsWith('/templates');
    }
    return location.pathname === path;
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - fixed on desktop, drawer on mobile */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          w-64 h-screen bg-white border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-gray-100">
          <Link 
            to="/dashboard" 
            className="flex items-center gap-3"
            onClick={() => {
              setMobileOpen(false);
              setProfileOpen(false);
            }}
          >
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-lg font-semibold text-gray-900 tracking-tight">SignFlo</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {sidebarItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => {
                  setMobileOpen(false);
                  setProfileOpen(false);
                }}
                className={`
                  flex items-center gap-3 py-2.5 rounded-lg transition-smooth
                  ${active
                    ? 'bg-indigo-50 text-indigo-700 font-medium border-l-2 border-indigo-600 pl-[10px] pr-3'
                    : 'px-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                `}
              >
                <span className={`shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User block at bottom */}
        {user && (
          <div className="border-t border-gray-100 p-3 mt-auto shrink-0 relative bg-gray-50/50">
            <button
              type="button"
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 transition-smooth text-left"
            >
              <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold text-sm shrink-0">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name || 'User'}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {profileOpen && (
              <div className="absolute left-3 right-3 bottom-full mb-2 bg-white rounded-xl dropdown-shadow border border-gray-200 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user.name || 'User'}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-smooth rounded-none"
                  >
                    Sign out
                  </button>
                </div>
            )}
          </div>
        )}
      </aside>

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-white rounded-lg card-shadow border border-gray-200 hover:bg-gray-50 transition-smooth"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Open menu"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </>
  );
};
