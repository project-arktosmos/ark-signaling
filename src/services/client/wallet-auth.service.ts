import { writable, type Writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { PrivateKeyAccount } from 'viem';

const STORAGE_KEY = 'signaling-client-wallet-pk';

export interface WalletState {
	isAvailable: boolean;
	isConnected: boolean;
	address: string | null;
	error: string | null;
}

class WalletAuthService {
	store: Writable<WalletState>;
	private account: PrivateKeyAccount | null = null;

	constructor() {
		this.store = writable<WalletState>({
			isAvailable: false,
			isConnected: false,
			address: null,
			error: null
		});
	}

	async init(): Promise<boolean> {
		if (!browser) return false;

		this.store.update((s) => ({ ...s, isAvailable: true, error: null }));

		let privateKey = localStorage.getItem(STORAGE_KEY) as `0x${string}` | null;

		if (privateKey) {
			try {
				this.account = privateKeyToAccount(privateKey);
				this.store.update((s) => ({
					...s,
					isConnected: true,
					address: this.account!.address.toLowerCase()
				}));
				console.log('[Wallet] Loaded existing wallet:', this.account.address);
				return true;
			} catch (err) {
				console.error('[Wallet] Invalid stored key, generating new one');
				localStorage.removeItem(STORAGE_KEY);
				privateKey = null;
			}
		}

		// Auto-generate wallet if none exists
		privateKey = generatePrivateKey();
		localStorage.setItem(STORAGE_KEY, privateKey);
		this.account = privateKeyToAccount(privateKey);
		this.store.update((s) => ({
			...s,
			isConnected: true,
			address: this.account!.address.toLowerCase()
		}));
		console.log('[Wallet] Generated new wallet:', this.account.address);

		return true;
	}

	async connect(): Promise<string | null> {
		if (!browser) {
			this.store.update((s) => ({ ...s, error: 'Not in browser' }));
			return null;
		}

		try {
			let privateKey = localStorage.getItem(STORAGE_KEY) as `0x${string}` | null;

			if (!privateKey) {
				privateKey = generatePrivateKey();
				localStorage.setItem(STORAGE_KEY, privateKey);
				console.log('[Wallet] Generated new wallet');
			}

			this.account = privateKeyToAccount(privateKey);
			const address = this.account.address.toLowerCase();

			this.store.update((s) => ({
				...s,
				isConnected: true,
				address,
				error: null
			}));

			console.log('[Wallet] Connected:', address);
			return address;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create wallet';
			this.store.update((s) => ({ ...s, error: message }));
			return null;
		}
	}

	async signMessage(message: string): Promise<string | null> {
		if (!this.account) {
			this.store.update((s) => ({ ...s, error: 'Wallet not connected' }));
			return null;
		}

		try {
			const signature = await this.account.signMessage({ message });
			return signature;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
			this.store.update((s) => ({ ...s, error: errorMessage }));
			return null;
		}
	}

	getAddress(): string | null {
		return get(this.store).address;
	}

	getPrivateKey(): string | null {
		if (!browser) return null;
		return localStorage.getItem(STORAGE_KEY);
	}

	destroy(): void {
		this.account = null;
	}
}

export const walletAuthService = new WalletAuthService();
