<script lang="ts">
	import type { Peer } from '$types/client.type';
	import { signalingMessageAdapter } from '$adapters/classes/signaling-message.adapter';
	import { Card } from '$components/layout';

	export let peers: Peer[] = [];
	export let ownAddress: string | null = null;

	$: formattedPeers = peers.map((peer) => ({
		...peer,
		...signalingMessageAdapter.formatPeer(peer),
		isOwn: peer.address.toLowerCase() === ownAddress?.toLowerCase()
	}));
</script>

<Card title="Peers in Room" compact>
	{#if peers.length === 0}
		<div class="text-center py-4 text-base-content/60">
			<p>No other peers connected</p>
		</div>
	{:else}
		<ul class="divide-y divide-base-300">
			{#each formattedPeers as peer (peer.id)}
				<li class="py-2 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full bg-success"></div>
						<code class="text-sm">{peer.shortAddress}</code>
						{#if peer.isOwn}
							<span class="badge badge-sm badge-primary">You</span>
						{/if}
					</div>
					<span class="text-xs text-base-content/60">{peer.joinedAgo}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-2 pt-2 border-t border-base-300">
		<span class="text-xs text-base-content/60">
			{peers.length} peer{peers.length !== 1 ? 's' : ''} connected
		</span>
	</div>
</Card>
