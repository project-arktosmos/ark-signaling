<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Card, SectionHeader } from '$components/layout';
	import { FormField, TextInput, NumberInput, SelectInput } from '$components/forms';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { IPFilter, ConnectionLimits, IPFilterType } from '$types/signaling.type';
	import { IPFilterType as IPFilterTypeEnum } from '$types/signaling.type';

	export let ipFilters: IPFilter[] = [];
	export let connectionLimits: ConnectionLimits;

	const dispatch = createEventDispatcher<{
		change: { ipFilters: IPFilter[]; connectionLimits: ConnectionLimits };
	}>();

	let editingFilter: IPFilter | null = null;
	let showFilterForm = false;

	const filterTypeOptions = [
		{ value: IPFilterTypeEnum.Whitelist, label: 'Whitelist (allow only)' },
		{ value: IPFilterTypeEnum.Blacklist, label: 'Blacklist (block)' }
	];

	function createNewFilter(): IPFilter {
		return {
			id: crypto.randomUUID(),
			pattern: '',
			type: IPFilterTypeEnum.Blacklist,
			description: '',
			createdAt: new Date().toISOString()
		};
	}

	function handleAddFilter() {
		editingFilter = createNewFilter();
		showFilterForm = true;
	}

	function handleEditFilter(filter: IPFilter) {
		editingFilter = { ...filter };
		showFilterForm = true;
	}

	function handleDeleteFilter(filterId: string | number) {
		ipFilters = ipFilters.filter((f) => f.id !== filterId);
		dispatch('change', { ipFilters, connectionLimits });
	}

	function handleSaveFilter() {
		if (!editingFilter) return;

		const existingIndex = ipFilters.findIndex((f) => f.id === editingFilter!.id);
		if (existingIndex >= 0) {
			ipFilters[existingIndex] = editingFilter;
			ipFilters = [...ipFilters];
		} else {
			ipFilters = [...ipFilters, editingFilter];
		}

		dispatch('change', { ipFilters, connectionLimits });
		showFilterForm = false;
		editingFilter = null;
	}

	function handleCancelFilter() {
		showFilterForm = false;
		editingFilter = null;
	}

	function handleLimitsChange() {
		dispatch('change', { ipFilters, connectionLimits });
	}
</script>

<Card>
	<SectionHeader title="Client Filtering" description="Configure IP filtering and connection limits" />

	<div class="space-y-6">
		<!-- Connection Limits -->
		<div>
			<h4 class="font-medium mb-3">Connection Limits</h4>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Max connections per IP">
					<NumberInput
						bind:value={connectionLimits.maxConnectionsPerIP}
						min={1}
						max={1000}
						on:change={handleLimitsChange}
					/>
				</FormField>

				<FormField label="Max connections per user">
					<NumberInput
						bind:value={connectionLimits.maxConnectionsPerUser}
						min={1}
						max={100}
						on:change={handleLimitsChange}
					/>
				</FormField>

				<FormField label="Max connections per room">
					<NumberInput
						bind:value={connectionLimits.maxConnectionsPerRoom}
						min={1}
						max={10000}
						on:change={handleLimitsChange}
					/>
				</FormField>

				<FormField label="Max total connections">
					<NumberInput
						bind:value={connectionLimits.maxTotalConnections}
						min={1}
						max={100000}
						on:change={handleLimitsChange}
					/>
				</FormField>
			</div>
		</div>

		<!-- IP Filters -->
		<div>
			<div class="flex justify-between items-center mb-3">
				<h4 class="font-medium">IP Filters</h4>
				<Button color={ThemeColors.Primary} size={ThemeSizes.Small} on:click={handleAddFilter}>Add Filter</Button>
			</div>

			{#if showFilterForm && editingFilter}
				<div class="bg-base-200 p-4 rounded-lg mb-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField label="IP Pattern" hint="IP address or CIDR notation (e.g., 192.168.1.0/24)">
							<TextInput bind:value={editingFilter.pattern} placeholder="192.168.1.0/24" />
						</FormField>

						<FormField label="Filter Type">
							<SelectInput bind:value={editingFilter.type} options={filterTypeOptions} />
						</FormField>

						<FormField label="Description" classes="md:col-span-2">
							<TextInput bind:value={editingFilter.description} placeholder="Optional description" />
						</FormField>
					</div>

					<div class="flex gap-2 justify-end mt-4">
						<Button color={ThemeColors.Neutral} outline on:click={handleCancelFilter}>Cancel</Button>
						<Button color={ThemeColors.Primary} on:click={handleSaveFilter}>Save Filter</Button>
					</div>
				</div>
			{/if}

			{#if ipFilters.length === 0}
				<p class="text-base-content/60 text-center py-4">No IP filters configured.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table table-zebra table-sm">
						<thead>
							<tr>
								<th>Pattern</th>
								<th>Type</th>
								<th>Description</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each ipFilters as filter}
								<tr>
									<td class="font-mono">{filter.pattern}</td>
									<td>
										<span
											class="badge badge-sm"
											class:badge-success={filter.type === IPFilterTypeEnum.Whitelist}
											class:badge-error={filter.type === IPFilterTypeEnum.Blacklist}
										>
											{filter.type}
										</span>
									</td>
									<td class="text-base-content/60">{filter.description || '-'}</td>
									<td>
										<div class="flex gap-1">
											<Button size={ThemeSizes.XSmall} color={ThemeColors.Info} outline on:click={() => handleEditFilter(filter)}>
												Edit
											</Button>
											<Button size={ThemeSizes.XSmall} color={ThemeColors.Error} outline on:click={() => handleDeleteFilter(filter.id)}>
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
	</div>
</Card>
