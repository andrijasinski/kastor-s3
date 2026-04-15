import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MantineProvider} from '@mantine/core';
import {SettingsFab} from '../components/SettingsFab';

const renderComponent = () =>
	render(
		<MantineProvider>
			<SettingsFab />
		</MantineProvider>,
	);

describe('SettingsFab', () => {
	it('renders the settings button', () => {
		renderComponent();
		expect(screen.getByRole('button', {name: /settings/i})).toBeInTheDocument();
	});

	it('opens the popover when settings button is clicked', async () => {
		const user = userEvent.setup();
		renderComponent();
		await user.click(screen.getByRole('button', {name: /settings/i}));
		await waitFor(() => {
			expect(screen.getByText('Theme')).toBeInTheDocument();
		});
	});

	it('renders theme segmented control after opening', async () => {
		const user = userEvent.setup();
		renderComponent();
		await user.click(screen.getByRole('button', {name: /settings/i}));
		await waitFor(() => {
			expect(screen.getByText('Light')).toBeInTheDocument();
			expect(screen.getByText('Dark')).toBeInTheDocument();
			expect(screen.getByText('Auto')).toBeInTheDocument();
		});
	});

	it('closes the popover when settings button is clicked again', async () => {
		const user = userEvent.setup();
		renderComponent();
		await user.click(screen.getByRole('button', {name: /settings/i}));
		await waitFor(() => {
			expect(screen.getByText('Theme')).toBeInTheDocument();
		});
		await user.click(screen.getByRole('button', {name: /settings/i}));
		await waitFor(() => {
			expect(screen.queryByText('Theme')).not.toBeInTheDocument();
		});
	});
});
