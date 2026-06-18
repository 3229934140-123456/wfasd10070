import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Papers from './pages/Papers';
import PaperDetail from './pages/PaperDetail';
import SubmitPaper from './pages/SubmitPaper';
import MyReviews from './pages/MyReviews';
import ReviewDetail from './pages/ReviewDetail';
import EditorPapers from './pages/EditorPapers';
import EditorPaperDetail from './pages/EditorPaperDetail';
import Statistics from './pages/Statistics';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';

function App() {
  const { isAuthenticated, fetchMe, token } = useAuthStore();

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchMe();
    }
  }, [token, isAuthenticated, fetchMe]);

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" />} />
      
      <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
        <Route index element={<Dashboard />} />
        <Route path="papers" element={<Papers />} />
        <Route path="papers/submit" element={<SubmitPaper />} />
        <Route path="papers/:id" element={<PaperDetail />} />
        <Route path="papers/:id/edit" element={<SubmitPaper />} />
        <Route path="reviews" element={<MyReviews />} />
        <Route path="reviews/:id" element={<ReviewDetail />} />
        <Route path="editor/papers" element={<EditorPapers />} />
        <Route path="editor/papers/:id" element={<EditorPaperDetail />} />
        <Route path="editor/statistics" element={<Statistics />} />
        <Route path="editor/users" element={<UserManagement />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
