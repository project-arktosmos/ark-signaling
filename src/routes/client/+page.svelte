<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ConnectionState } from '$types/client.type';
	import { signalingClientService } from '$services/client/signaling-client.service';
	import { walletAuthService } from '$services/client/wallet-auth.service';
	import { ConnectionStatus, PeersList, MessagePanel } from '$components/client';

	let clientState = signalingClientService.store;
	let walletState = walletAuthService.store;

	$: isConnected = $clientState.connectionState === ConnectionState.Connected;
	$: displayAddress = $clientState.walletAddress || $walletState.address;

	onMount(async () => {
		await walletAuthService.init();
	});

	onDestroy(() => {
		signalingClientService.disconnect();
		walletAuthService.destroy();
	});

	async function handleConnect() {
		await signalingClientService.connect();
	}

	function handleDisconnect() {
		signalingClientService.disconnect();
	}

	function handleSendMessage(e: CustomEvent<{ content: string }>) {
		signalingClientService.broadcast(e.detail.content);
	}

	function handleClearMessages() {
		signalingClientService.clearMessages();
	}
</script>

<div class="container mx-auto p-4 max-w-4xl">
	<div class="mb-6">
		<h1 class="text-2xl font-bold">Signaling Client</h1>
		<p class="text-base-content/60">Connect to the signaling server and chat with peers</p>
	</div>

	<div class="mb-6">
		<ConnectionStatus
			connectionState={$clientState.connectionState}
			walletAddress={displayAddress}
			clientId={$clientState.clientId}
			error={$clientState.error || $walletState.error}
			on:connect={handleConnect}
			on:disconnect={handleDisconnect}
		/>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="lg:col-span-1">
			<PeersList peers={$clientState.peers} ownAddress={displayAddress} />
		</div>

		<div class="lg:col-span-2">
			<MessagePanel
				messages={$clientState.messages}
				disabled={!isConnected}
				on:send={handleSendMessage}
				on:clear={handleClearMessages}
			/>
		</div>
	</div>

	<div class="mt-8 text-sm text-base-content/40 text-center">
		<p>WebSocket Server: ws://localhost:6742/ws | Auth: Ethereum Handshake</p>
	</div>
</div>
