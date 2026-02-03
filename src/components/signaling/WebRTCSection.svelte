<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Card, SectionHeader } from '$components/layout';
	import { FormField, TextInput, NumberInput, SelectInput, ToggleSwitch, TagInput } from '$components/forms';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { WebRTCConfig, ICEServer, ICECandidateFilter } from '$types/signaling.type';

	export let webrtc: WebRTCConfig;

	const dispatch = createEventDispatcher<{
		change: { webrtc: WebRTCConfig };
	}>();

	let editingServer: ICEServer | null = null;
	let showServerForm = false;

	const bundlePolicyOptions = [
		{ value: 'balanced', label: 'Balanced' },
		{ value: 'max-compat', label: 'Max Compatibility' },
		{ value: 'max-bundle', label: 'Max Bundle' }
	];

	const transportPolicyOptions = [
		{ value: 'all', label: 'All (direct and relay)' },
		{ value: 'relay', label: 'Relay only (TURN required)' }
	];

	function createNewServer(): ICEServer {
		return {
			id: crypto.randomUUID(),
			urls: []
		};
	}

	function handleAddServer() {
		editingServer = createNewServer();
		showServerForm = true;
	}

	function handleEditServer(server: ICEServer) {
		editingServer = { ...server, urls: [...server.urls] };
		showServerForm = true;
	}

	function handleDeleteServer(serverId: string | number) {
		webrtc.iceServers = webrtc.iceServers.filter((s) => s.id !== serverId);
		webrtc = { ...webrtc };
		dispatch('change', { webrtc });
	}

	function handleSaveServer() {
		if (!editingServer || editingServer.urls.length === 0) return;

		const existingIndex = webrtc.iceServers.findIndex((s) => s.id === editingServer!.id);
		if (existingIndex >= 0) {
			webrtc.iceServers[existingIndex] = editingServer;
		} else {
			webrtc.iceServers = [...webrtc.iceServers, editingServer];
		}

		webrtc = { ...webrtc };
		dispatch('change', { webrtc });
		showServerForm = false;
		editingServer = null;
	}

	function handleCancelServer() {
		showServerForm = false;
		editingServer = null;
	}

	function handleConfigChange() {
		dispatch('change', { webrtc });
	}

	function handleFilterChange() {
		webrtc = { ...webrtc };
		dispatch('change', { webrtc });
	}
</script>

<Card>
	<SectionHeader title="WebRTC Configuration" description="Configure ICE servers and WebRTC policies" />

	<div class="space-y-6">
		<!-- ICE Servers -->
		<div>
			<div class="flex justify-between items-center mb-3">
				<h4 class="font-medium">ICE Servers (STUN/TURN)</h4>
				<Button color={ThemeColors.Primary} size={ThemeSizes.Small} on:click={handleAddServer}>Add Server</Button>
			</div>

			{#if showServerForm && editingServer}
				<div class="bg-base-200 p-4 rounded-lg mb-4">
					<h5 class="font-medium mb-3">ICE Server Configuration</h5>

					<div class="space-y-4">
						<FormField label="Server URLs" hint="Add STUN/TURN URLs (e.g., stun:stun.l.google.com:19302)">
							<TagInput
								bind:values={editingServer.urls}
								placeholder="stun:server.example.com:3478"
							/>
						</FormField>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField label="Username" hint="Optional: For TURN authentication">
								<TextInput bind:value={editingServer.username} placeholder="Username (optional)" />
							</FormField>

							<FormField label="Credential" hint="Optional: Password for TURN">
								<TextInput
									type="password"
									bind:value={editingServer.credential}
									placeholder="Credential (optional)"
								/>
							</FormField>
						</div>
					</div>

					<div class="flex gap-2 justify-end mt-4">
						<Button color={ThemeColors.Neutral} outline on:click={handleCancelServer}>Cancel</Button>
						<Button color={ThemeColors.Primary} on:click={handleSaveServer}>Save Server</Button>
					</div>
				</div>
			{/if}

			{#if webrtc.iceServers.length === 0}
				<p class="text-base-content/60 text-center py-4">No ICE servers configured.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-zebra table-sm">
						<thead>
							<tr>
								<th>URLs</th>
								<th>Auth</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each webrtc.iceServers as server}
								<tr>
									<td>
										<div class="flex flex-col gap-1">
											{#each server.urls as url}
												<code class="text-xs bg-base-200 px-1 rounded">{url}</code>
											{/each}
										</div>
									</td>
									<td>
										{#if server.username}
											<span class="badge badge-sm badge-info">Authenticated</span>
										{:else}
											<span class="badge badge-sm badge-ghost">None</span>
										{/if}
									</td>
									<td>
										<div class="flex gap-1">
											<Button size={ThemeSizes.XSmall} color={ThemeColors.Info} outline on:click={() => handleEditServer(server)}>
												Edit
											</Button>
											<Button size={ThemeSizes.XSmall} color={ThemeColors.Error} outline on:click={() => handleDeleteServer(server.id)}>
												Delete
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- WebRTC Policies -->
		<div>
			<h4 class="font-medium mb-3">WebRTC Policies</h4>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="ICE Candidate Pool Size">
					<NumberInput
						bind:value={webrtc.iceCandidatePoolSize}
						min={0}
						max={256}
						on:change={handleConfigChange}
					/>
				</FormField>

				<FormField label="Bundle Policy">
					<SelectInput
						bind:value={webrtc.bundlePolicy}
						options={bundlePolicyOptions}
						on:change={handleConfigChange}
					/>
				</FormField>

				<FormField label="ICE Transport Policy">
					<SelectInput
						bind:value={webrtc.iceTransportPolicy}
						options={transportPolicyOptions}
						on:change={handleConfigChange}
					/>
				</FormField>
			</div>
		</div>

		<!-- ICE Candidate Filtering -->
		<div>
			<h4 class="font-medium mb-3">ICE Candidate Filtering</h4>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
				<FormField label="Host Candidates">
					<ToggleSwitch
						bind:checked={webrtc.candidateFilter.allowHost}
						label="Allow"
						on:change={handleFilterChange}
					/>
				</FormField>

				<FormField label="Server Reflexive">
					<ToggleSwitch
						bind:checked={webrtc.candidateFilter.allowSrflx}
						label="Allow"
						on:change={handleFilterChange}
					/>
				</FormField>

				<FormField label="Peer Reflexive">
					<ToggleSwitch
						bind:checked={webrtc.candidateFilter.allowPrflx}
						label="Allow"
						on:change={handleFilterChange}
					/>
				</FormField>

				<FormField label="Relay Candidates">
					<ToggleSwitch
						bind:checked={webrtc.candidateFilter.allowRelay}
						label="Allow"
						on:change={handleFilterChange}
					/>
				</FormField>

				<FormField label="IPv6 Candidates">
					<ToggleSwitch
						bind:checked={webrtc.candidateFilter.allowIPv6}
						label="Allow"
						on:change={handleFilterChange}
					/>
				</FormField>
			</div>
		</div>
	</div>
</Card>
