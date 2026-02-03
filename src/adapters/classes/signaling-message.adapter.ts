import { AdapterClass } from '$adapters/classes/adapter.class';
import type { ChatMessage, Peer } from '$types/client.type';

export class SignalingMessageAdapter extends AdapterClass {
	constructor() {
		super('signaling-message');
	}

	formatChatMessage(message: ChatMessage): string {
		const time = new Date(message.timestamp).toLocaleTimeString();
		const shortAddress = this.truncateAddress(message.senderAddress);
		return `[${time}] ${shortAddress}: ${message.content}`;
	}

	truncateAddress(address: string): string {
		if (!address || address.length < 10) return address;
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	formatPeer(peer: Peer): { displayName: string; shortAddress: string; joinedAgo: string } {
		const shortAddress = this.truncateAddress(peer.address);
		const joinedAgo = this.formatTimeAgo(peer.joinedAt);

		return {
			displayName: shortAddress,
			shortAddress,
			joinedAgo
		};
	}

	formatTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);

		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}
}

export const signalingMessageAdapter = new SignalingMessageAdapter();
