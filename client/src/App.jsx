import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Register from './pages/Register';
import Login from './pages/Login';
// Mock pages to be created
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Listings from './pages/Listings';
import Bookings from './pages/Bookings';
import Payments from './pages/Payments';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/login" />} />
          <Route path="register" element={<Register />} />
          <Route path="login" element={<Login />} />
          
          {/* App routes */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="listings" element={<Listings />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="payments" element={<Payments />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
