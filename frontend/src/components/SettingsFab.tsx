import { useState } from 'react';
import {
	ActionIcon,
	Popover,
	SegmentedControl,
	Stack,
	Text,
	type MantineColorScheme,
} from '@mantine/core';
import { useMantineColorScheme } from '@mantine/core';
import { IconSettings } from '@tabler/icons-react';

enum ColorScheme {
	LIGHT = 'light',
	DARK = 'dark',
	AUTO = 'auto',
}

const COLOR_SCHEME_OPTIONS = [
	{ label: 'Light', value: ColorScheme.LIGHT },
	{ label: 'Dark', value: ColorScheme.DARK },
	{ label: 'Auto', value: ColorScheme.AUTO },
];

export const SettingsFab = () => {
	const [opened, setOpened] = useState(false);
	const { colorScheme, setColorScheme } = useMantineColorScheme();

	return (
		<Popover opened={opened} onChange={setOpened} position="top-end" offset={8} withArrow>
			<Popover.Target>
				<ActionIcon
					onClick={() => setOpened((o) => !o)}
					size="xl"
					radius="xl"
					variant="filled"
					style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}
					aria-label="Settings"
				>
					<IconSettings size={20} />
				</ActionIcon>
			</Popover.Target>

			<Popover.Dropdown>
				<Stack gap="xs">
					<Text size="sm" fw={500}>
						Theme
					</Text>
					<SegmentedControl
						value={colorScheme}
						onChange={(value) => setColorScheme(value as MantineColorScheme)}
						data={COLOR_SCHEME_OPTIONS}
					/>
				</Stack>
			</Popover.Dropdown>
		</Popover>
	);
};
