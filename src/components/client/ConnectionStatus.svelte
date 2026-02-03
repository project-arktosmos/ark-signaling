<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { ConnectionState } from '$types/client.type';
	import { signalingMessageAdapter } from '$adapters/classes/signaling-message.adapter';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors } from '$types/core.type';

	export let connectionState: ConnectionState;
	export let walletAddress: string | null = null;
	export let clientId: string | null = null;
	export let error: string | null = null;

	const dispatch = createEventDispatcher<{
		connect: void;
		disconnect: void;
	}>();

	const stateLabels: Record<ConnectionState, string> = {
		[ConnectionState.Disconnected]: 'Disconnected',
		[ConnectionState.Connecting]: 'Connecting...',
		[ConnectionState.Authenticating]: 'Authenticating...',
		[ConnectionState.Connected]: 'Connected',
		[ConnectionState.Error]: 'Error'
	};

	$: statusLabel = stateLabels[connectionState];
	$: isConnected = connectionState === ConnectionState.Connected;
	$: isConnecting =
		connectionState === ConnectionState.Connecting ||
		connectionState === ConnectionState.Authenticating;
	$: displayAddress = walletAddress ? signalingMessageAdapter.truncateAddress(walletAddress) : null;

	$: indicatorClasses = classNames('w-3 h-3 rounded-full', {
		'bg-neutral': connectionState === ConnectionState.Disconnected,
		'bg-warning animate-pulse': connectionState === ConnectionState.Connecting,
		'bg-info animate-pulse': connectionState === ConnectionState.Authenticating,
		'bg-success': connectionState === ConnectionState.Connected,
		'bg-error': connectionState === ConnectionState.Error
	});
</script>

<div class="flex flex-col gap-4 p-4 bg-base-200 rounded-lg">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class={indicatorClasses}></div>
			<span class="font-medium">{statusLabel}</span>
		</div>

		{#if isConnected}
			<Button color={ThemeColors.Error} outline on:click={() => dispatch('disconnect')}>
				Disconnect
			</Button>
		{:else if !isConnecting}
			<Button color={ThemeColors.Primary} on:click={() => dispatch('connect')}>
				Connect to Server
			</Button>
		{:else}
			<span class="loading loading-spinner loading-sm"></span>
		{/if}
	</div>

	{#if displayAddress}
		<div class="flex items-center gap-2 text-sm">
			<span class="text-base-content/60">Wallet:</span>
			<code class="px-2 py-1 bg-base-300 rounded">{displayAddress}</code>
		</div>
	{/if}

	{#if clientId && isConnected}
		<div class="flex items-center gap-2 text-sm">
			<span class="text-base-content/60">Client ID:</span>
			<code class="px-2 py-1 bg-base-300 rounded text-xs">{clientId}</code>
		</div>
	{/if}

	{#if error}
		<div class="alert alert-error text-sm">
			<span>{error}</span>
		</div>
	{/if}
</div>
