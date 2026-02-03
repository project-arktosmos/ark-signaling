<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Card, SectionHeader } from '$components/layout';
	import { FormField, TextInput, NumberInput, SelectInput } from '$components/forms';
	import type { ServerConfig, LoggingConfig, LogLevel } from '$types/signaling.type';
	import { LogLevel as LogLevelEnum } from '$types/signaling.type';

	export let server: ServerConfig;
	export let logging: LoggingConfig;

	const dispatch = createEventDispatcher<{
		change: { server: ServerConfig; logging: LoggingConfig };
	}>();

	const logLevelOptions = [
		{ value: LogLevelEnum.Debug, label: 'Debug' },
		{ value: LogLevelEnum.Info, label: 'Info' },
		{ value: LogLevelEnum.Warn, label: 'Warning' },
		{ value: LogLevelEnum.Error, label: 'Error' }
	];

	function handleChange() {
		dispatch('change', { server, logging });
	}
</script>

<Card>
	<SectionHeader title="Server Settings" description="Configure the signaling server connection" />

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<FormField label="Port" hint="Server listening port (default: 6742)">
			<NumberInput bind:value={server.port} min={1} max={65535} on:change={handleChange} />
		</FormField>

		<FormField label="WebSocket Path" hint="Path for WebSocket connections">
			<TextInput bind:value={server.wsPath} placeholder="/ws" on:change={handleChange} />
		</FormField>

		<FormField label="Host" hint="Bind address (0.0.0.0 for all interfaces)">
			<TextInput bind:value={server.host} placeholder="0.0.0.0" on:change={handleChange} />
		</FormField>

		<FormField label="Log Level">
			<SelectInput
				bind:value={logging.level}
				options={logLevelOptions}
				on:change={handleChange}
			/>
		</FormField>
	</div>
</Card>
