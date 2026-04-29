import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {createTheme, MantineProvider} from '@mantine/core';
import '@mantine/core/styles.css';
import {Notifications} from '@mantine/notifications';
import '@mantine/notifications/styles.css';
import './theme.css';
import {App} from './App';

/* Custom Mantine theme — kgreen as primary so accent CSS vars flow through */
const theme = createTheme({
	primaryColor: 'kgreen',
	colors: {
		kgreen: [
			'#e6fff2',
			'#b3f5d5',
			'#72e8ae',
			'#3dd48a',
			'#1cc870',
			'#0fbd60',
			'#0a9e50',
			'#077e3e',
			'#055c2e',
			'#03391c',
		],
	},
	fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
	fontFamilyMonospace: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
	defaultRadius: 'sm',
});

const rootEl = document.getElementById('root');
if (rootEl === null) {
	throw new Error('Root element not found');
}

createRoot(rootEl).render(
	<StrictMode>
		<BrowserRouter>
			<MantineProvider theme={theme} forceColorScheme="dark">
				<Notifications />
				<App />
			</MantineProvider>
		</BrowserRouter>
	</StrictMode>,
);
