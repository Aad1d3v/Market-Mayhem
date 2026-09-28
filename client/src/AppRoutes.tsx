import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth-context.js";
import AppLayout from "./layouts/AppLayout.js";
import LandingPage from "./pages/LandingPage.js";
import LoginPage from "./pages/LoginPage.js";
import RegisterPage from "./pages/RegisterPage.js";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.js";
import DashboardPage from "./pages/DashboardPage.js";
import MarketsPage from "./pages/MarketsPage.js";
import NewsPage from "./pages/NewsPage.js";
import StockDetailPage from "./pages/StockDetailPage.js";
import WatchlistPage from "./pages/WatchlistPage.js";
import PortfolioPage from "./pages/PortfolioPage.js";
import TradePage from "./pages/TradePage.js";
import SimulatorPage from "./pages/SimulatorPage.js";
import WalletPage from "./pages/WalletPage.js";
import ActivityPage from "./pages/ActivityPage.js";
import LearnPage from "./pages/LearnPage.js";
import LessonPage from "./pages/LessonPage.js";
import LeaderboardPage from "./pages/LeaderboardPage.js";
import HelpPage from "./pages/HelpPage.js";
import SettingsPage from "./pages/SettingsPage.js";
import AdminPage from "./pages/AdminPage.js";
import { Skeleton } from "./components/ui.js";

function Protected() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function AdminOnly() {
  const { user } = useAuth();
  if (!user || user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export default function AppRoutes() {
  const { user, isLoading } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={isLoading ? <Skeleton className="h-screen" /> : user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
      />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<Protected />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/stocks/:symbol" element={<StockDetailPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:lessonId" element={<LessonPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route element={<AdminOnly />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
