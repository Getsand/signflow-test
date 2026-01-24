/**
 * ProtectedLayout Component
 * 
 * Wraps protected routes with AppShell layout.
 * This ensures all authenticated pages have the sidebar.
 */

import React from 'react';
import { AppShell } from '../layouts/AppShell';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ children }) => {
  return <AppShell>{children}</AppShell>;
};
