
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { APP_CONFIG } from './core/config';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGuard, RoleGuard } from './auth/AuthGuard';
import RoleRouter from './auth/RoleRouter';
import { useNavigate } from 'react-router-dom';

// Views
import LandingPage from './views/LandingPage';
import VerifyEmail from './views/VerifyEmail';
import AdminDashboard from './admin/Dashboard';
import QuizManagement from './admin/QuizManagement';
import QuestionBuilder from './admin/QuestionBuilder';
import FileExplorer from './admin/FileExplorer';
import Users from './admin/Users';
import Reports from './admin/Reports';
import LiveMonitor from './admin/LiveMonitor';
import Security from './admin/Security';
import Settings from './admin/Settings';
import AdminRoles from './admin/AdminRoles';
import MembershipPricing from './admin/MembershipPricing';
import LevelManagement from './admin/LevelManagement';
import StudentDirectory from './admin/StudentDirectory';
import StudentEnrollment from './admin/StudentEnrollment';
import AdminLogs from './admin/AdminLogs';
import SupportCenter from './admin/SupportCenter';
import LibraryManagement from './admin/LibraryManagement';
import PaymentRegistry from './admin/PaymentRegistry';
import StudentDashboard from './student/Dashboard';
import QuizRoom from './student/QuizRoom';
import Results from './student/Results';
import Profile from './student/Profile';
import Library from './student/Library';
import AnswerReview from './student/AnswerReview';
import PaymentRequiredView from './student/PaymentRequiredView';
import MembershipGuard from './components/MembershipGuard';
import ScrollToTop from './components/ScrollToTop';

const App: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    // Slido Green Theme for Smart Prep
    root.style.setProperty('--color-primary-50', '#ecfdf5');
    root.style.setProperty('--color-primary-100', '#d1fae5');
    root.style.setProperty('--color-primary-200', '#a7f3d0');
    root.style.setProperty('--color-primary-300', '#6ee7b7');
    root.style.setProperty('--color-primary-400', '#34d399');
    root.style.setProperty('--color-primary-500', '#1fa33b');
    root.style.setProperty('--color-primary-600', '#1a732a');
    root.style.setProperty('--color-primary-700', '#145920');
    root.style.setProperty('--color-primary-800', '#0e3d16');
    root.style.setProperty('--color-primary-900', '#0a2b10');

    // No more offline handling
  }, [navigate]);



  return (
    <AuthProvider>
      <ScrollToTop />
      <Routes>
        {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Auth Dispatcher */}
          <Route path="/dispatch" element={
            <AuthGuard>
              <RoleRouter />
            </AuthGuard>
          } />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <AdminDashboard />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/quizzes" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <QuizManagement />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/questions/:quizId" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <QuestionBuilder />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/files/:quizId" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <FileExplorer />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/users" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <Users />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/reports" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <Reports />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/live-monitor/:quizId" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <LiveMonitor />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/security" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <Security />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/settings" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <Settings />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/roles" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <AdminRoles />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/membership" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <MembershipPricing />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/payments" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <PaymentRegistry />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/institution/:institutionName" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <LevelManagement />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/institution/:institutionName/level/:level" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <LevelManagement />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/level/:level" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <LevelManagement />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/students" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <StudentDirectory />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/enrollment" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <StudentEnrollment />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/logs" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <AdminLogs />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/support" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <SupportCenter />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/admin/library" element={
            <AuthGuard>
              <RoleGuard allowedRole="admin">
                <LibraryManagement />
              </RoleGuard>
            </AuthGuard>
          } />

          {/* Student Routes */}
          <Route path="/student" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <MembershipGuard>
                  <StudentDashboard />
                </MembershipGuard>
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/student/quiz/:id" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <MembershipGuard>
                  <QuizRoom />
                </MembershipGuard>
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/student/results/:submissionId" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <MembershipGuard>
                  <Results />
                </MembershipGuard>
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/student/review/:submissionId" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <MembershipGuard>
                  <AnswerReview />
                </MembershipGuard>
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/student/library" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <MembershipGuard>
                  <Library />
                </MembershipGuard>
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/student/profile" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <Profile />
              </RoleGuard>
            </AuthGuard>
          } />
          <Route path="/student/payment-required" element={
            <AuthGuard>
              <RoleGuard allowedRole="student">
                <PaymentRequiredView />
              </RoleGuard>
            </AuthGuard>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    </AuthProvider>
  );
};

export default App;
