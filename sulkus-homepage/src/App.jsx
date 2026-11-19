import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './pages/MainPage/MainPage';

// 운영진 페이지는 따로 불러옴 (일반 방문자는 Firebase 코드를 내려받지 않음)
const AdminPage = lazy(() => import('./admin/AdminPage'));
const ADMIN_PATH = '/wlqqnwjsdyd';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route
          path={ADMIN_PATH}
          element={
            <Suspense fallback={null}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/?page=1" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
