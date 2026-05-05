import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import API from "./services/api";

import ProtectedRoute from "./components/ProtectedRoute.jsx";

import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import InterpreterPage from "./pages/InterpreterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import DescriptionPage from "./pages/DescriptionPage.jsx";
import FaqPage from "./pages/FaqPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import LearningsPage from "./pages/LearningsPage.jsx";
import ResourcesPage from "./pages/ResourcesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ModuleView from "./pages/ModuleView.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminMonitor from "./pages/AdminMonitor.jsx";

export default function App() {
  useEffect(() => {
    const ping = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        await API.post("/api/users/ping");
      } catch {
        // ignore ping failures
      }
    };

    ping();
    const interval = setInterval(ping, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Learning modules / quizzes (public or protected – up to you) */}
        <Route path="/module/:id" element={<ModuleView />} />
        <Route path="/quiz/:id" element={<QuizPage />} />

        {/* Protected Routes – require login */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/interpreter"
          element={
            <ProtectedRoute>
              <InterpreterPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/description"
          element={
            <ProtectedRoute>
              <DescriptionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/faq"
          element={
            <ProtectedRoute>
              <FaqPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/learnings"
          element={
            <ProtectedRoute>
              <LearningsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/resources"
          element={
            <ProtectedRoute>
              <ResourcesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminMonitor />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/manage"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

      </Routes>
    </Router>
  );
}
