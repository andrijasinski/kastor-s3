import { Routes, Route } from 'react-router-dom';
import { BucketListPage } from './pages/BucketListPage';
import { ObjectBrowserPage } from './pages/ObjectBrowserPage';
import { ImagePreviewPage } from './pages/ImagePreviewPage';
import { SettingsFab } from './components/SettingsFab';

export const App = () => (
	<>
		<Routes>
			<Route path="/" element={<BucketListPage />} />
			<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
			<Route path="/buckets/:bucket/preview" element={<ImagePreviewPage />} />
		</Routes>
		<SettingsFab />
	</>
);
