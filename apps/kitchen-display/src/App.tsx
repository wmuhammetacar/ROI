import { Navigate, Route, Routes } from 'react-router-dom';
import { KdsShell } from './app/kds-shell';
import { RouteGuard } from './app/route-guard';
import { BoardPage } from './pages/board-page';
import { LoginPage } from './pages/login-page';
import { StationsPage } from './pages/stations-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RouteGuard>
            <KdsShell />
          </RouteGuard>
        }
      >
        <Route path="/" element={<Navigate to="/stations" replace />} />
        <Route path="/stations" element={<StationsPage />} />
        <Route path="/board" element={<BoardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/stations" replace />} />
    </Routes>
  );
}
