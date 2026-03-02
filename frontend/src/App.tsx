import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedLayout } from './components/ProtectedLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load components for better code splitting and performance
const Login = lazy(() => import('./pages/auth').then(m => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/auth').then(m => ({ default: m.Signup })));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const Upload = lazy(() => import('./pages/upload/Upload').then(m => ({ default: m.Upload })));
const Documents = lazy(() => import('./pages/documents/Documents').then(m => ({ default: m.Documents })));
const DocumentDetail = lazy(() => import('./pages/documents/DocumentDetail').then(m => ({ default: m.DocumentDetail })));
const Prepare = lazy(() => import('./pages/documents/Prepare').then(m => ({ default: m.Prepare })));
const Templates = lazy(() => import('./pages/templates').then(m => ({ default: m.Templates })));
const AddRecipients = lazy(() => import('./pages/templates').then(m => ({ default: m.AddRecipients })));
const NewSigningRequest = lazy(() => import('./pages/signing-requests').then(m => ({ default: m.NewSigningRequest })));
const SignerPage = lazy(() => import('./pages/signing').then(m => ({ default: m.SignerPage })));

// Loading component for Suspense fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
);

/**
 * Main App Component
 * 
 * Handles routing for the entire application with authentication.
 * Uses lazy loading for better performance and code splitting.
 */
function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Auth Routes (Public) */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              
              {/* Public Signing Route (No Auth Required) */}
              <Route path="/sign/:token" element={<SignerPage />} />

              {/* Protected Routes with AppShell Layout */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <Dashboard />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <Upload />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <Documents />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/:id"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <DocumentDetail />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/documents/:file_id/prepare"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <Prepare />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <Templates />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates/:file_id/recipients"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <AddRecipients />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/templates/:file_id/prepare"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <Prepare />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/signing-requests/new/:template_id"
                element={
                  <ProtectedRoute>
                    <ProtectedLayout>
                      <NewSigningRequest />
                    </ProtectedLayout>
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* 404 Not Found */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  );
}

export default App;
