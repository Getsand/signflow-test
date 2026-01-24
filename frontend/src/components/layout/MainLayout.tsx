import React from 'react';
import { Navbar, Footer } from '../ui';

export interface MainLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    email: string;
  } | null;
  onLogout?: () => void;
}

/**
 * MainLayout Component
 * 
 * Main layout for authenticated pages.
 * Includes navbar, content area, and footer.
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  user,
  onLogout,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      {/* Navbar */}
      <Navbar user={user} onLogout={onLogout} />

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};


