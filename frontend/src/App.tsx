import { Routes, Route } from 'react-router-dom';
import { BucketListPage } from './pages/BucketListPage';

export const App = () => (
  <Routes>
    <Route path="/" element={<BucketListPage />} />
  </Routes>
);
