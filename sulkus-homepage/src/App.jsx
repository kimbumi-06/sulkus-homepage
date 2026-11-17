import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainPage from './MainPages/MainPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/page/:page" element={<MainPage />} />
        <Route path="*" element={<Navigate to="/page/1" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
