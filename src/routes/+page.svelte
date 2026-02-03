<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import classNames from 'classnames';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors } from '$types/core.type';
	import { configService } from '$services/signaling/config.service';
	import {
		ServerSettingsSection,
		RoomsSection,
		ClientsSection,
		RateLimitSection,
		AuthSection,
		WebRTCSection
	} from '$components/signaling';
	import type { SignalingConfig } from '$types/signaling.type';

	let config: SignalingConfig | null = null;
	let loading = false;
	let saving = false;
	let error: string | null = null;
	let saveSuccess = false;
	let hasChanges = false;
	let activeTab = 'server';

	const tabs = [
		{ id: 'server', label: 'Server', icon: '⚙️' },
		{ id: 'rooms', label: 'Rooms', icon: '🚪' },
		{ id: 'clients', label: 'Clients', icon: '👥' },
		{ id: 'rateLimit', label: 'Rate Limits', icon: '⏱️' },
		{ id: 'auth', label: 'Auth', icon: '🔐' },
		{ id: 'webrtc', label: 'WebRTC', icon: '📡' }
	];

	onMount(async () => {
		loading = true;
		error = null;
		try {
			config = await configService.fetch();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load configuration';
		} finally {
			loading = false;
		}
	});

	async function handleSave() {
		if (!config) return;

		saving = true;
		error = null;
		saveSuccess = false;

		try {
			const success = await configService.save(config);
			if (success) {
				saveSuccess = true;
				hasChanges = false;
				setTimeout(() => (saveSuccess = false), 3000);
			} else {
				error = 'Failed to save configuration';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save configuration';
		} finally {
			saving = false;
		}
	}

	function handleServerChange(e: CustomEvent<{ server: SignalingConfig['server']; logging: SignalingConfig['logging'] }>) {
		if (!config) return;
		config.server = e.detail.server;
		config.logging = e.detail.logging;
		hasChanges = true;
	}

	function handleRoomsChange(e: CustomEvent<{ rooms: SignalingConfig['rooms'] }>) {
		if (!config) return;
		config.rooms = e.detail.rooms;
		hasChanges = true;
	}

	function handleClientsChange(e: CustomEvent<{ ipFilters: SignalingConfig['ipFilters']; connectionLimits: SignalingConfig['connectionLimits'] }>) {
		if (!config) return;
		config.ipFilters = e.detail.ipFilters;
		config.connectionLimits = e.detail.connectionLimits;
		hasChanges = true;
	}

	function handleRateLimitChange(e: CustomEvent<{ rateLimitRules: SignalingConfig['rateLimitRules'] }>) {
		if (!config) return;
		config.rateLimitRules = e.detail.rateLimitRules;
		hasChanges = true;
	}

	function handleAuthChange(e: CustomEvent<{ auth: SignalingConfig['auth'] }>) {
		if (!config) return;
		config.auth = e.detail.auth;
		hasChanges = true;
	}

	function handleWebRTCChange(e: CustomEvent<{ webrtc: SignalingConfig['webrtc'] }>) {
		if (!config) return;
		config.webrtc = e.detail.webrtc;
		hasChanges = true;
	}
</script>

<div class="container mx-auto p-4 max-w-6xl">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
		<div>
			<h1 class="text-2xl font-bold">Signaling Server Configuration</h1>
			<p class="text-base-content/60">Configure WebRTC signaling server settings</p>
		</div>
		<div class="flex gap-2 items-center">
			{#if saveSuccess}
				<span class="text-success text-sm">Configuration saved!</span>
			{/if}
			<Button
				color={ThemeColors.Primary}
				disabled={!config || saving}
				on:click={handleSave}
			>
				{saving ? 'Saving...' : 'Save Configuration'}
			</Button>
		</div>
	</div>

	<!-- Restart Notice -->
	{#if hasChanges}
		<div class="alert alert-warning mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
			</svg>
			<span>Server restart required for changes to take effect.</span>
		</div>
	{/if}

	<!-- Error Display -->
	{#if error}
		<div class="alert alert-error mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
			<span>{error}</span>
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading}
		<div class="flex justify-center items-center py-20">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if config}
		<!-- Tab Navigation -->
		<div class="tabs tabs-boxed mb-6 flex-wrap">
			{#each tabs as tab}
				<button
					class={classNames('tab', 'gap-2', { 'tab-active': activeTab === tab.id })}
					on:click={() => (activeTab = tab.id)}
				>
					<span>{tab.icon}</span>
					<span class="hidden sm:inline">{tab.label}</span>
				</button>
			{/each}
		</div>

		<!-- Tab Content -->
		<div class="space-y-6">
			{#if activeTab === 'server'}
				<ServerSettingsSection
					bind:server={config.server}
					bind:logging={config.logging}
					on:change={handleServerChange}
				/>
			{:else if activeTab === 'rooms'}
				<RoomsSection
					bind:rooms={config.rooms}
					on:change={handleRoomsChange}
				/>
			{:else if activeTab === 'clients'}
				<ClientsSection
					bind:ipFilters={config.ipFilters}
					bind:connectionLimits={config.connectionLimits}
					on:change={handleClientsChange}
				/>
			{:else if activeTab === 'rateLimit'}
				<RateLimitSection
					bind:rateLimitRules={config.rateLimitRules}
					on:change={handleRateLimitChange}
				/>
			{:else if activeTab === 'auth'}
				<AuthSection
					bind:auth={config.auth}
					on:change={handleAuthChange}
				/>
			{:else if activeTab === 'webrtc'}
				<WebRTCSection
					bind:webrtc={config.webrtc}
					on:change={handleWebRTCChange}
				/>
			{/if}
		</div>

		<!-- Config Version Info -->
		<div class="mt-8 text-sm text-base-content/40 text-center">
			Config version: {config.version} | Last updated: {new Date(config.updatedAt).toLocaleString()}
		</div>
	{:else}
		<div class="alert alert-info">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
			</svg>
			<span>No configuration loaded. Please check if the server is running.</span>
		</div>
	{/if}
</div>
