<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	interface Option {
		value: string;
		label: string;
		disabled?: boolean;
	}

	export let value: string = '';
	export let options: Option[] = [];
	export let placeholder: string = '';
	export let disabled: boolean = false;
	export let color: ThemeColors = ThemeColors.Primary;
	export let size: ThemeSizes = ThemeSizes.Medium;
	export let error: boolean = false;
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		change: { value: string };
	}>();

	const sizeClasses: Record<ThemeSizes, string> = {
		[ThemeSizes.XSmall]: 'select-xs',
		[ThemeSizes.Small]: 'select-sm',
		[ThemeSizes.Medium]: 'select-md',
		[ThemeSizes.Large]: 'select-lg',
		[ThemeSizes.XLarge]: 'select-lg'
	};

	const colorClasses: Record<ThemeColors, string> = {
		[ThemeColors.Primary]: 'select-primary',
		[ThemeColors.Secondary]: 'select-secondary',
		[ThemeColors.Accent]: 'select-accent',
		[ThemeColors.Success]: 'select-success',
		[ThemeColors.Error]: 'select-error',
		[ThemeColors.Info]: 'select-info',
		[ThemeColors.Warning]: 'select-warning',
		[ThemeColors.Neutral]: 'select-neutral'
	};

	$: selectClasses = classNames(
		'select',
		'select-bordered',
		'w-full',
		sizeClasses[size],
		{
			[colorClasses[color]]: !error,
			'select-error': error
		},
		classes
	);

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		value = target.value;
		dispatch('change', { value });
	}
</script>

<select class={selectClasses} {disabled} {value} on:change={handleChange}>
	{#if placeholder}
		<option value="" disabled>{placeholder}</option>
	{/if}
	{#each options as option}
		<option value={option.value} disabled={option.disabled}>
			{option.label}
		</option>
	{/each}
</select>
