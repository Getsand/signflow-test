/**
 * AppShell Layout
 *
 * Zoho-style application shell with:
 * - Left sidebar (fixed width, user at bottom)
 * - Main content area (no top bar; content starts at top)
 *
 * Only shown for authenticated users.
 */

import React from 'react';
import { Sidebar } from '../components/Sidebar';

export interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell - Main layout for authenticated pages
 */
export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50/80">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
