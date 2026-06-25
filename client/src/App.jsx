import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
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
