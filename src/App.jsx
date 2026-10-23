import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import Signup from './pages/Signup';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SellerDashboard from './pages/SellerDashboard';
import BuyerDashboard from './pages/BuyerDashboard';
import AccountDelivery from './pages/AccountDelivery';
import PaymentCallback from './pages/PaymentCallback';
import CreateListing from './pages/CreateListing';
import EditListing from './pages/EditListing';
import BrowseListings from './pages/BrowseListings';
import ListingDetail from './pages/ListingDetail';
import AdminDashboard from './pages/AdminDashboard';
import Settings from './pages/Settings';
import { Terms, Privacy, Help } from './pages/InfoPages'; // KV-P17-APPIMP
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/dashboard/seller/new"
        element={
          <ProtectedRoute role="seller">
            <CreateListing />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/callback"
        element={
          <ProtectedRoute role="buyer">
            <PaymentCallback />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/seller/edit/:id"
        element={
          <ProtectedRoute role="seller">
            <EditListing />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/browse" element={<BrowseListings />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/help" element={<Help />} />
      <Route path="/faq" element={<Help />} />
      <Route path="/listing/:id" element={<ListingDetail />} />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute role="buyer">
            <AccountDelivery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/seller"
        element={
          <ProtectedRoute role="seller">
            <SellerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/buyer"
        element={
          <ProtectedRoute role="buyer">
            <BuyerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}