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
			'#eef8f3',
			'#d0eed5',
			'#a3d5b0',
			'#6db889',
			'#459f68',
			'#34a06b',
			'#2b8659',
			'#226b48',
			'#185137',
			'#0e3826',
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
