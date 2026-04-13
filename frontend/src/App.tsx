import { Routes, Route } from 'react-router-dom';
import { BucketListPage } from './pages/BucketListPage';
import { ObjectBrowserPage } from './pages/ObjectBrowserPage';

export const App = () => (
	<Routes>
		<Route path="/" element={<BucketListPage />} />
		<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
	</Routes>
);
