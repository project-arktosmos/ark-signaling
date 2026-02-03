import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { SignalingConfig, APIResponse } from '$types/signaling.type';

class SignalingConfigService {
	store: Writable<SignalingConfig | null>;
	loading: Writable<boolean>;
	error: Writable<string | null>;
	saving: Writable<boolean>;

	constructor() {
		this.store = writable(null);
		this.loading = writable(false);
		this.error = writable(null);
		this.saving = writable(false);
	}

	async fetch(): Promise<SignalingConfig | null> {
		if (!browser) return null;

		this.loading.set(true);
		this.error.set(null);

		try {
			const response = await fetch('/api/signaling/config');
			const result: APIResponse<SignalingConfig> = await response.json();

			if (result.success && result.data) {
				this.store.set(result.data);
				return result.data;
			} else {
				this.error.set(result.error || 'Failed to load configuration');
				return null;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Network error';
			this.error.set(message);
			return null;
		} finally {
			this.loading.set(false);
		}
	}

	async save(config: SignalingConfig): Promise<boolean> {
		if (!browser) return false;

		this.saving.set(true);
		this.error.set(null);

		try {
			const response = await fetch('/api/signaling/config', {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(config)
			});

			const result: APIResponse<SignalingConfig> = await response.json();

			if (result.success && result.data) {
				this.store.set(result.data);
				return true;
			} else {
				this.error.set(result.error || 'Failed to save configuration');
				return false;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Network error';
			this.error.set(message);
			return false;
		} finally {
			this.saving.set(false);
		}
	}

	update(partial: Partial<SignalingConfig>): void {
		this.store.update((current) => {
			if (!current) return current;
			return { ...current, ...partial };
		});
	}

	get(): SignalingConfig | null {
		let value: SignalingConfig | null = null;
		this.store.subscribe((v) => (value = v))();
		return value;
	}
}

export const configService = new SignalingConfigService();
