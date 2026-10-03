import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import HomePage from "@/pages/Home/HomePage";
import MovieDetailPage from "@/pages/MovieDetail/MovieDetailPage";
import SearchPage from "@/pages/Search/SearchPage";
import ActorDetailPage from "@/pages/ActorDetail/ActorDetailPage";
import DirectorDetailPage from "@/pages/DirectorDetail/DirectorDetailPage";
import ListsPage from "@/pages/Lists/ListsPage";
import ListDetailPage from "@/pages/Lists/ListDetailPage";
import LoginPage from "@/pages/Login/LoginPage";
import ForgotPasswordPage from "@/pages/Login/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/Login/ResetPasswordPage";
import RegisterPage from "@/pages/Register/RegisterPage";
import ProfilePage from "@/pages/Profile/ProfilePage";
import AdminPage from "@/pages/Admin/AdminPage";
import ScreeningLogPage from "@/pages/ScreeningLog/ScreeningLogPage";
import SessionManager from "@/components/common/SessionManager";
import BetaNotice from "@/components/common/BetaNotice";
import EditProfilePage from "@/pages/Profile/EditProfilePage";
import CreateListPage from "@/pages/Lists/CreateListPage";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import EditListPage from "@/pages/Lists/EditListPage";
import UsersPage from "@/pages/Users/UsersPage";
import UserProfilePage from "@/pages/Users/UserProfilePage";
import PrivacyPolicyPage from "@/pages/Legal/PrivacyPolicyPage";
import TermsPage from "@/pages/Legal/TermsPage";

function AppShell() {
  useScrollRestoration();

  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-shell__main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/movies/:id" element={<MovieDetailPage />} />
          <Route path="/actors/:id" element={<ActorDetailPage />} />
          <Route path="/directors/:id" element={<DirectorDetailPage />} />
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:id" element={<ListDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/log" element={<ScreeningLogPage />} />
            <Route path="/lists/new" element={<CreateListPage />} />
            <Route path="/lists/edit/:id" element={<EditListPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:userName" element={<UserProfilePage />} />
          </Route>

          <Route element={<ProtectedRoute requireAdmin />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    // NOT: basename kaldırıldı — "/UFMDb" GitHub Pages'in proje sayfası path'iydi.
    // Cloudflare'de domain kökünde ("/") çalıştığımız için basename olmadan
    // varsayılan "/" kullanılır; aksi halde hiçbir route eşleşmiyor ve sayfa boş kalıyordu.
    <BrowserRouter>
      <SessionManager />
      <AppShell />
      <BetaNotice />
    </BrowserRouter>
  );
}
