import { Route, Routes } from 'react-router-dom';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import GigsPage from './pages/GigsPage';
import GigDetailPage from './pages/GigDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyGigsPage from './pages/MyGigsPage';
import GigEditorPage from './pages/GigEditorPage';
import BookingsPage from './pages/BookingsPage';
import TransactionsPage from './pages/TransactionsPage';
import EarningsPage from './pages/EarningsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <Routes>
          {/* Public */}
          <Route path="/" element={<GigsPage />} />
          <Route path="/gigs/:id" element={<GigDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Freelancer */}
          <Route path="/my-gigs" element={<ProtectedRoute roles={['freelancer']}><MyGigsPage /></ProtectedRoute>} />
          <Route path="/my-gigs/new" element={<ProtectedRoute roles={['freelancer']}><GigEditorPage /></ProtectedRoute>} />
          <Route path="/my-gigs/:id/edit" element={<ProtectedRoute roles={['freelancer']}><GigEditorPage /></ProtectedRoute>} />
          <Route path="/earnings" element={<ProtectedRoute roles={['freelancer']}><EarningsPage /></ProtectedRoute>} />

          {/* Any logged-in user (results are scoped by the API) */}
          <Route path="/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminPage /></ProtectedRoute>} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="footer">HustleHub+ · Secure freelance marketplace · INSY7314 / APDS7311 POE</footer>
    </>
  );
}
