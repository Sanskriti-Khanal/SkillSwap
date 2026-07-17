import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TutorApplicationWizard from './pages/TutorApplicationWizard';
import ApplicationStatus from './pages/ApplicationStatus';
import AdminTutorApplicationsList from './pages/admin/AdminTutorApplicationsList';
import AdminTutorApplicationDetail from './pages/admin/AdminTutorApplicationDetail';
import TutorDashboardLayout from './pages/tutor-dashboard/TutorDashboardLayout';
import TutorDashboardOverview from './pages/tutor-dashboard/TutorDashboardOverview';
import TutorAvailabilitySettings from './pages/tutor-dashboard/TutorAvailabilitySettings';
import TutorReviews from './pages/tutor-dashboard/TutorReviews';
import ComingSoon from './components/ComingSoon';
import Profile from './pages/Profile';
import Listings from './pages/Listings';
import ListingDetail from './pages/ListingDetail';
import Bookings from './pages/Bookings';
import Payments from './pages/Payments';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public landing page — no Layout/Navbar wrapper */}
        <Route path="/" element={<Home />} />

        {/* All app pages use Layout (Navbar + Outlet) */}
        <Route element={<Layout />}>
          <Route path="register" element={<Register />} />
          <Route path="login" element={<Login />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route element={<RequireAuth />}>
            <Route path="tutor/apply/:step?" element={<TutorApplicationWizard />} />
            <Route path="tutor/application/status" element={<ApplicationStatus />} />
            <Route path="tutor/dashboard" element={<TutorDashboardLayout />}>
              <Route index element={<TutorDashboardOverview />} />
              <Route path="courses" element={<ComingSoon feature="Courses" />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="availability" element={<TutorAvailabilitySettings />} />
              <Route path="wallet" element={<ComingSoon feature="Wallet" />} />
              <Route path="withdrawals" element={<ComingSoon feature="Withdrawals" />} />
              <Route path="messages" element={<ComingSoon feature="Messages" />} />
              <Route path="reviews" element={<TutorReviews />} />
              <Route path="analytics" element={<ComingSoon feature="Analytics" />} />
              <Route path="settings" element={<Profile />} />
            </Route>
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="admin/tutor-applications" element={<AdminTutorApplicationsList />} />
            <Route path="admin/tutor-applications/:id" element={<AdminTutorApplicationDetail />} />
          </Route>
          <Route path="profile" element={<Profile />} />
          <Route path="listings" element={<Listings />} />
          <Route path="listings/:id" element={<ListingDetail />} />
          <Route path="bookings" element={<Bookings />} />

          <Route path="payments" element={<Payments />} />
          <Route path="payment-success" element={<PaymentSuccess />} />
          <Route path="payment-cancel" element={<PaymentCancel />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
