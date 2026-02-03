<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher, afterUpdate } from 'svelte';
	import type { ChatMessage } from '$types/client.type';
	import { signalingMessageAdapter } from '$adapters/classes/signaling-message.adapter';
	import { Card } from '$components/layout';
	import Button from '$components/core/Button.svelte';
	import { ThemeColors } from '$types/core.type';

	export let messages: ChatMessage[] = [];
	export let disabled: boolean = false;

	const dispatch = createEventDispatcher<{
		send: { content: string };
		clear: void;
	}>();

	let messageInput = '';
	let messagesContainer: HTMLDivElement;

	afterUpdate(() => {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	function handleSend() {
		const content = messageInput.trim();
		if (!content) return;

		dispatch('send', { content });
		messageInput = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<Card title="Messages" classes="flex flex-col h-full">
	<div bind:this={messagesContainer} class="flex-1 overflow-y-auto max-h-96 space-y-2 mb-4">
		{#if messages.length === 0}
			<div class="text-center py-8 text-base-content/60">
				<p>No messages yet</p>
				<p class="text-sm">Send a message to start the conversation</p>
			</div>
		{:else}
			{#each messages as message (message.id)}
				<div
					class={classNames('chat', {
						'chat-end': message.isOwn,
						'chat-start': !message.isOwn
					})}
				>
					<div class="chat-header text-xs opacity-60">
						{signalingMessageAdapter.truncateAddress(message.senderAddress)}
						<time class="ml-1">{formatTime(message.timestamp)}</time>
					</div>
					<div
						class={classNames('chat-bubble', {
							'chat-bubble-primary': message.isOwn
						})}
					>
						{message.content}
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<div class="flex gap-2 pt-2 border-t border-base-300">
		<div class="flex-1">
			<input
				type="text"
				bind:value={messageInput}
				placeholder={disabled ? 'Connect to send messages' : 'Type a message...'}
				{disabled}
				on:keydown={handleKeydown}
				class="input input-bordered input-primary w-full"
			/>
		</div>
		<Button
			color={ThemeColors.Primary}
			disabled={disabled || !messageInput.trim()}
			on:click={handleSend}
		>
			Send
		</Button>
	</div>

	<svelte:fragment slot="actions">
		{#if messages.length > 0}
			<Button color={ThemeColors.Neutral} outline on:click={() => dispatch('clear')}>
				Clear Messages
			</Button>
		{/if}
	</svelte:fragment>
</Card>
