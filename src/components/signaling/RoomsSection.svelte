<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { Card, SectionHeader } from '$components/layout';
	import { FormField, TextInput, NumberInput, SelectInput, ToggleSwitch, TagInput } from '$components/forms';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';
	import type { Room, MessageType, RoutingMode } from '$types/signaling.type';
	import { RoutingMode as RoutingModeEnum, MessageType as MessageTypeEnum } from '$types/signaling.type';

	export let rooms: Room[] = [];

	const dispatch = createEventDispatcher<{
		change: { rooms: Room[] };
	}>();

	let editingRoom: Room | null = null;
	let showForm = false;

	const routingOptions = [
		{ value: RoutingModeEnum.Broadcast, label: 'Broadcast (all clients)' },
		{ value: RoutingModeEnum.Unicast, label: 'Unicast (specific client)' },
		{ value: RoutingModeEnum.Multicast, label: 'Multicast (selected clients)' }
	];

	const messageTypeOptions = Object.values(MessageTypeEnum);

	function createNewRoom(): Room {
		return {
			id: crypto.randomUUID(),
			name: '',
			description: '',
			maxClients: 100,
			isPrivate: false,
			routingMode: RoutingModeEnum.Broadcast,
			allowedMessageTypes: Object.values(MessageTypeEnum),
			createdAt: new Date().toISOString()
		};
	}

	function handleAdd() {
		editingRoom = createNewRoom();
		showForm = true;
	}

	function handleEdit(room: Room) {
		editingRoom = { ...room };
		showForm = true;
	}

	function handleDelete(roomId: string | number) {
		rooms = rooms.filter((r) => r.id !== roomId);
		dispatch('change', { rooms });
	}

	function handleSave() {
		if (!editingRoom) return;

		const existingIndex = rooms.findIndex((r) => r.id === editingRoom!.id);
		if (existingIndex >= 0) {
			rooms[existingIndex] = editingRoom;
			rooms = [...rooms];
		} else {
			rooms = [...rooms, editingRoom];
		}

		dispatch('change', { rooms });
		showForm = false;
		editingRoom = null;
	}

	function handleCancel() {
		showForm = false;
		editingRoom = null;
	}

	function toggleMessageType(type: MessageType) {
		if (!editingRoom) return;
		const index = editingRoom.allowedMessageTypes.indexOf(type);
		if (index >= 0) {
			editingRoom.allowedMessageTypes = editingRoom.allowedMessageTypes.filter((t) => t !== type);
		} else {
			editingRoom.allowedMessageTypes = [...editingRoom.allowedMessageTypes, type];
		}
	}
</script>

<Card>
	<SectionHeader title="Room Management" description="Configure signaling rooms for client connections">
		<svelte:fragment slot="actions">
			<Button color={ThemeColors.Primary} on:click={handleAdd}>Add Room</Button>
		</svelte:fragment>
	</SectionHeader>

	{#if showForm && editingRoom}
		<div class="bg-base-200 p-4 rounded-lg mb-4">
			<h4 class="font-medium mb-4">{editingRoom.id ? 'Edit Room' : 'New Room'}</h4>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<FormField label="Room Name" required>
					<TextInput bind:value={editingRoom.name} placeholder="Room name" />
				</FormField>

				<FormField label="Max Clients">
					<NumberInput bind:value={editingRoom.maxClients} min={1} max={10000} />
				</FormField>

				<FormField label="Description" classes="md:col-span-2">
					<TextInput bind:value={editingRoom.description} placeholder="Optional description" />
				</FormField>

				<FormField label="Routing Mode">
					<SelectInput bind:value={editingRoom.routingMode} options={routingOptions} />
				</FormField>

				<FormField label="Private Room">
					<ToggleSwitch bind:checked={editingRoom.isPrivate} label="Require password" />
				</FormField>

				{#if editingRoom.isPrivate}
					<FormField label="Password" classes="md:col-span-2">
						<TextInput type="password" bind:value={editingRoom.password} placeholder="Room password" />
					</FormField>
				{/if}

				<FormField label="Allowed Message Types" classes="md:col-span-2">
					<div class="flex flex-wrap gap-2">
						{#each messageTypeOptions as type}
							<label class="label cursor-pointer gap-2">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={editingRoom.allowedMessageTypes.includes(type)}
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
				<Button color={ThemeColors.Primary} on:click={handleSave}>Save Room</Button>
			</div>
		</div>
	{/if}

	{#if rooms.length === 0}
		<p class="text-base-content/60 text-center py-8">No rooms configured. Add a room to get started.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-zebra">
				<thead>
					<tr>
						<th>Name</th>
						<th>Max Clients</th>
						<th>Routing</th>
						<th>Private</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each rooms as room}
						<tr>
							<td>
								<div class="font-medium">{room.name}</div>
								{#if room.description}
									<div class="text-sm text-base-content/60">{room.description}</div>
								{/if}
							</td>
							<td>{room.maxClients}</td>
							<td>
								<span class="badge badge-sm">{room.routingMode}</span>
							</td>
							<td>
								{#if room.isPrivate}
									<span class="badge badge-warning badge-sm">Private</span>
								{:else}
									<span class="badge badge-ghost badge-sm">Public</span>
								{/if}
							</td>
							<td>
								<div class="flex gap-1">
									<Button size={ThemeSizes.XSmall} color={ThemeColors.Info} outline on:click={() => handleEdit(room)}>
										Edit
									</Button>
									<Button size={ThemeSizes.XSmall} color={ThemeColors.Error} outline on:click={() => handleDelete(room.id)}>
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
