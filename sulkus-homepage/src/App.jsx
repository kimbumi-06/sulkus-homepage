import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './MainPages/MainPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="*" element={<Navigate to="/?page=1" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
