import { Navigate, Route, Routes } from 'react-router-dom';
import { CartPage } from './pages/cart-page';
import { MenuPage } from './pages/menu-page';
import { OrderSubmittedPage } from './pages/order-submitted-page';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/menu" replace />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/order-submitted" element={<OrderSubmittedPage />} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}
