<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	export let values: string[] = [];
	export let placeholder: string = 'Add item...';
	export let disabled: boolean = false;
	export let color: ThemeColors = ThemeColors.Primary;
	export let size: ThemeSizes = ThemeSizes.Medium;
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		change: { values: string[] };
	}>();

	let inputValue = '';

	const sizeClasses: Record<ThemeSizes, string> = {
		[ThemeSizes.XSmall]: 'input-xs',
		[ThemeSizes.Small]: 'input-sm',
		[ThemeSizes.Medium]: 'input-md',
		[ThemeSizes.Large]: 'input-lg',
		[ThemeSizes.XLarge]: 'input-lg'
	};

	const badgeSizeClasses: Record<ThemeSizes, string> = {
		[ThemeSizes.XSmall]: 'badge-xs',
		[ThemeSizes.Small]: 'badge-sm',
		[ThemeSizes.Medium]: 'badge-md',
		[ThemeSizes.Large]: 'badge-lg',
		[ThemeSizes.XLarge]: 'badge-lg'
	};

	const colorClasses: Record<ThemeColors, string> = {
		[ThemeColors.Primary]: 'badge-primary',
		[ThemeColors.Secondary]: 'badge-secondary',
		[ThemeColors.Accent]: 'badge-accent',
		[ThemeColors.Success]: 'badge-success',
		[ThemeColors.Error]: 'badge-error',
		[ThemeColors.Info]: 'badge-info',
		[ThemeColors.Warning]: 'badge-warning',
		[ThemeColors.Neutral]: 'badge-neutral'
	};

	$: containerClasses = classNames(
		'flex',
		'flex-wrap',
		'gap-2',
		'p-2',
		'border',
		'border-base-300',
		'rounded-btn',
		'bg-base-100',
		'min-h-12',
		'items-center',
		classes
	);

	$: inputClasses = classNames(
		'input',
		'input-ghost',
		'flex-1',
		'min-w-24',
		'focus:outline-none',
		sizeClasses[size]
	);

	$: badgeClasses = classNames('badge', 'gap-1', badgeSizeClasses[size], colorClasses[color]);

	function addValue() {
		const trimmed = inputValue.trim();
		if (trimmed && !values.includes(trimmed)) {
			values = [...values, trimmed];
			inputValue = '';
			dispatch('change', { values });
		}
	}

	function removeValue(index: number) {
		values = values.filter((_, i) => i !== index);
		dispatch('change', { values });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addValue();
		} else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
			removeValue(values.length - 1);
		}
	}
</script>

<div class={containerClasses}>
	{#each values as value, index}
		<span class={badgeClasses}>
			{value}
			{#if !disabled}
				<button type="button" class="cursor-pointer" on:click={() => removeValue(index)}>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						class="inline-block w-4 h-4 stroke-current"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			{/if}
		</span>
	{/each}

	{#if !disabled}
		<input
			type="text"
			class={inputClasses}
			{placeholder}
			bind:value={inputValue}
			on:keydown={handleKeydown}
			on:blur={addValue}
		/>
	{/if}
</div>
