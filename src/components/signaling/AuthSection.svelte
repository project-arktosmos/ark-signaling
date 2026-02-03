<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Card, SectionHeader } from '$components/layout';
	import { FormField, TextInput, NumberInput, SelectInput, ToggleSwitch } from '$components/forms';
	import type { AuthConfig, AuthMethod } from '$types/signaling.type';
	import { AuthMethod as AuthMethodEnum } from '$types/signaling.type';

	export let auth: AuthConfig;

	const dispatch = createEventDispatcher<{
		change: { auth: AuthConfig };
	}>();

	const authMethodOptions = [
		{ value: AuthMethodEnum.None, label: 'None (no authentication)' },
		{ value: AuthMethodEnum.Token, label: 'Token (Bearer token validation)' },
		{ value: AuthMethodEnum.Basic, label: 'Basic Authentication' },
		{ value: AuthMethodEnum.EthereumHandshake, label: 'Ethereum Handshake (wallet signature)' }
	];

	function handleChange() {
		dispatch('change', { auth });
	}
</script>

<Card>
	<SectionHeader title="Authentication" description="Configure client authentication for the signaling server" />

	<div class="space-y-4">
		<FormField label="Enable Authentication">
			<ToggleSwitch
				bind:checked={auth.enabled}
				label="Require authentication for connections"
				on:change={handleChange}
			/>
		</FormField>

		{#if auth.enabled}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Authentication Method">
					<SelectInput bind:value={auth.method} options={authMethodOptions} on:change={handleChange} />
				</FormField>

				{#if auth.method === AuthMethodEnum.Token}
					<FormField label="Token Secret" hint="Secret key for JWT/token validation">
						<TextInput
							type="password"
							bind:value={auth.tokenSecret}
							placeholder="Enter secret key"
							on:change={handleChange}
						/>
					</FormField>

					<FormField label="Token Expiry (seconds)" hint="How long tokens are valid">
						<NumberInput
							bind:value={auth.tokenExpiry}
							min={60}
							max={86400}
							on:change={handleChange}
						/>
					</FormField>
				{/if}

				{#if auth.method === AuthMethodEnum.EthereumHandshake}
					<FormField label="Server Private Key" hint="Server's Ethereum wallet private key for signing handshake tokens">
						<TextInput
							type="password"
							bind:value={auth.serverPrivateKey}
							placeholder="0x..."
							on:change={handleChange}
						/>
					</FormField>

					<FormField label="Handshake Message" hint="Custom message included in the handshake token (optional)">
						<TextInput
							bind:value={auth.handshakeMessage}
							placeholder="Sign this to authenticate with the signaling server"
							on:change={handleChange}
						/>
					</FormField>

					<FormField label="Handshake Expiry (seconds)" hint="How long handshake tokens are valid">
						<NumberInput
							bind:value={auth.handshakeExpiry}
							min={30}
							max={3600}
							on:change={handleChange}
						/>
					</FormField>
				{/if}

				<FormField label="Allow Anonymous">
					<ToggleSwitch
						bind:checked={auth.allowAnonymous}
						label="Allow connections without authentication"
						on:change={handleChange}
					/>
				</FormField>

				{#if auth.allowAnonymous}
					<FormField label="Anonymous ID Prefix" hint="Prefix for auto-generated anonymous client IDs">
						<TextInput
							bind:value={auth.anonymousPrefix}
							placeholder="anon_"
							on:change={handleChange}
						/>
					</FormField>
				{/if}
			</div>
		{:else}
			<div class="alert alert-info">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
				<span>Authentication is disabled. All clients can connect without verification.</span>
			</div>
		{/if}
	</div>
</Card>
