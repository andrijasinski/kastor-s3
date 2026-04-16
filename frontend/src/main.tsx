import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {MantineProvider} from '@mantine/core';
import '@mantine/core/styles.css';
import {Notifications} from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import {App} from './App';

const rootEl = document.getElementById('root');
if (rootEl === null) {
	throw new Error('Root element not found');
}

createRoot(rootEl).render(
	<StrictMode>
		<BrowserRouter>
			<MantineProvider forceColorScheme="dark">
				<Notifications />
				<App />
			</MantineProvider>
		</BrowserRouter>
	</StrictMode>,
);
