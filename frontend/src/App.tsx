import {Routes, Route} from 'react-router-dom';
import {BucketsProvider} from './contexts/BucketsContext';
import {AppShell} from './components/AppShell';
import {BucketListPage} from './pages/BucketListPage';
import {ObjectBrowserPage} from './pages/ObjectBrowserPage';

export const App = () => (
	<BucketsProvider>
		<AppShell>
			<Routes>
				<Route path="/" element={<BucketListPage />} />
				<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
			</Routes>
		</AppShell>
	</BucketsProvider>
);
