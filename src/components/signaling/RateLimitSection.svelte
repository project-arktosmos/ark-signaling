<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Card, SectionHeader } from '$components/layout';
	import { FormField, TextInput, NumberInput, SelectInput, ToggleSwitch } from '$components/forms';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { RateLimitRule, RateLimitScope, MessageType } from '$types/signaling.type';
	import { RateLimitScope as RateLimitScopeEnum, MessageType as MessageTypeEnum } from '$types/signaling.type';

	export let rateLimitRules: RateLimitRule[] = [];

	const dispatch = createEventDispatcher<{
		change: { rateLimitRules: RateLimitRule[] };
	}>();

	let editingRule: RateLimitRule | null = null;
	let showForm = false;

	const scopeOptions = [
		{ value: RateLimitScopeEnum.Global, label: 'Global (all clients)' },
		{ value: RateLimitScopeEnum.PerClient, label: 'Per Client' },
		{ value: RateLimitScopeEnum.PerRoom, label: 'Per Room' },
		{ value: RateLimitScopeEnum.PerIP, label: 'Per IP Address' }
	];

	const messageTypeOptions = Object.values(MessageTypeEnum);

	function createNewRule(): RateLimitRule {
		return {
			id: crypto.randomUUID(),
			name: '',
			scope: RateLimitScopeEnum.PerClient,
			maxMessages: 100,
			windowMs: 1000,
			messageTypes: undefined,
			enabled: true
		};
	}

	function handleAdd() {
		editingRule = createNewRule();
		showForm = true;
	}

	function handleEdit(rule: RateLimitRule) {
		editingRule = { ...rule, messageTypes: rule.messageTypes ? [...rule.messageTypes] : undefined };
		showForm = true;
	}

	function handleDelete(ruleId: string | number) {
		rateLimitRules = rateLimitRules.filter((r) => r.id !== ruleId);
		dispatch('change', { rateLimitRules });
	}

	function handleSave() {
		if (!editingRule) return;

		const existingIndex = rateLimitRules.findIndex((r) => r.id === editingRule!.id);
		if (existingIndex >= 0) {
			rateLimitRules[existingIndex] = editingRule;
			rateLimitRules = [...rateLimitRules];
		} else {
			rateLimitRules = [...rateLimitRules, editingRule];
		}

		dispatch('change', { rateLimitRules });
		showForm = false;
		editingRule = null;
	}

	function handleCancel() {
		showForm = false;
		editingRule = null;
	}

	function toggleEnabled(rule: RateLimitRule) {
		rule.enabled = !rule.enabled;
		rateLimitRules = [...rateLimitRules];
		dispatch('change', { rateLimitRules });
	}

	function toggleMessageType(type: MessageType) {
		if (!editingRule) return;
		if (!editingRule.messageTypes) {
			editingRule.messageTypes = [type];
		} else {
			const index = editingRule.messageTypes.indexOf(type);
			if (index >= 0) {
				editingRule.messageTypes = editingRule.messageTypes.filter((t) => t !== type);
				if (editingRule.messageTypes.length === 0) {
					editingRule.messageTypes = undefined;
				}
			} else {
				editingRule.messageTypes = [...editingRule.messageTypes, type];
			}
		}
	}
</script>

<Card>
	<SectionHeader title="Rate Limiting" description="Configure message rate limits to prevent abuse">
		<svelte:fragment slot="actions">
			<Button color={ThemeColors.Primary} on:click={handleAdd}>Add Rule</Button>
		</svelte:fragment>
	</SectionHeader>

	{#if showForm && editingRule}
		<div class="bg-base-200 p-4 rounded-lg mb-4">
			<h4 class="font-medium mb-4">{editingRule.name ? 'Edit Rule' : 'New Rate Limit Rule'}</h4>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Rule Name" required>
					<TextInput bind:value={editingRule.name} placeholder="Rule name" />
				</FormField>

				<FormField label="Scope">
					<SelectInput bind:value={editingRule.scope} options={scopeOptions} />
				</FormField>

				<FormField label="Max Messages" hint="Maximum messages allowed in time window">
					<NumberInput bind:value={editingRule.maxMessages} min={1} max={10000} />
				</FormField>

				<FormField label="Time Window (ms)" hint="Time window in milliseconds">
					<NumberInput bind:value={editingRule.windowMs} min={100} max={60000} step={100} />
				</FormField>

				<FormField label="Enabled">
					<ToggleSwitch bind:checked={editingRule.enabled} label="Rule is active" />
				</FormField>

				<FormField label="Apply to Message Types" classes="md:col-span-2" hint="Leave empty to apply to all types">
					<div class="flex flex-wrap gap-2">
						{#each messageTypeOptions as type}
							<label class="label cursor-pointer gap-2">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={editingRule.messageTypes?.includes(type) ?? false}
									on:change={() => toggleMessageType(type)}
								/>
								<span class="label-text">{type}</span>
							</label>
						{/each}
					</div>
				</FormField>
			</div>

			<div class="flex gap-2 justify-end mt-4">
				<Button color={ThemeColors.Neutral} outline on:click={handleCancel}>Cancel</Button>
				<Button color={ThemeColors.Primary} on:click={handleSave}>Save Rule</Button>
			</div>
		</div>
	{/if}

	{#if rateLimitRules.length === 0}
		<p class="text-base-content/60 text-center py-8">No rate limit rules configured.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Name</th>
						<th>Scope</th>
						<th>Limit</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rateLimitRules as rule}
						<tr>
							<td>
								<div class="font-medium">{rule.name}</div>
								{#if rule.messageTypes}
									<div class="text-xs text-base-content/60">
										Types: {rule.messageTypes.join(', ')}
									</div>
								{/if}
							</td>
							<td>
								<span class="badge badge-sm badge-ghost">{rule.scope}</span>
							</td>
							<td>
								{rule.maxMessages} / {rule.windowMs}ms
							</td>
							<td>
								<input
									type="checkbox"
									class="toggle toggle-sm toggle-success"
									checked={rule.enabled}
									on:change={() => toggleEnabled(rule)}
								/>
							</td>
							<td>
								<div class="flex gap-1">
									<Button size={ThemeSizes.XSmall} color={ThemeColors.Info} outline on:click={() => handleEdit(rule)}>
										Edit
									</Button>
									<Button size={ThemeSizes.XSmall} color={ThemeColors.Error} outline on:click={() => handleDelete(rule.id)}>
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
</Card>
