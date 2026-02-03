import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedLayout } from './components/ProtectedLayout';
import { Login, Signup } from './pages/auth';
import { Dashboard } from './pages/dashboard/Dashboard';
import { Upload } from './pages/upload/Upload';
import { Documents } from './pages/documents/Documents';
import { DocumentDetail } from './pages/documents/DocumentDetail';
import { Prepare } from './pages/documents/Prepare';
import { Templates, AddRecipients } from './pages/templates';
import { NewSigningRequest } from './pages/signing-requests';
import { SignerPage } from './pages/signing';

/**
 * Main App Component
 * 
 * Handles routing for the entire application with authentication.
 */
function App() {
  return (
    <Router>
      <AuthProvider>
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
      </AuthProvider>
    </Router>
  );
}

export default App;

