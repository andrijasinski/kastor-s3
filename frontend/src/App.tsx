import {Routes, Route} from 'react-router-dom';
import {Link} from 'react-router-dom';
import {Container} from '@mantine/core';
import {BucketListPage} from './pages/BucketListPage';
import {ObjectBrowserPage} from './pages/ObjectBrowserPage';
import {ImagePreviewPage} from './pages/ImagePreviewPage';
import {SettingsFab} from './components/SettingsFab';

export const App = () => (
	<>
		<Container size="lg" pt="md">
			<Link to="/">
				<img src="/logo.png" alt="Home" height={48} style={{display: 'block'}} />
			</Link>
		</Container>
		<Routes>
			<Route path="/" element={<BucketListPage />} />
			<Route path="/buckets/:bucket" element={<ObjectBrowserPage />} />
			<Route path="/buckets/:bucket/preview" element={<ImagePreviewPage />} />
		</Routes>
		<SettingsFab />
	</>
);
