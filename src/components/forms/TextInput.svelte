<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	export let value: string = '';
	export let placeholder: string = '';
	export let type: 'text' | 'password' | 'email' | 'url' = 'text';
	export let disabled: boolean = false;
	export let readonly: boolean = false;
	export let color: ThemeColors = ThemeColors.Primary;
	export let size: ThemeSizes = ThemeSizes.Medium;
	export let error: boolean = false;
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		input: { value: string };
		change: { value: string };
		blur: void;
		focus: void;
	}>();

	const sizeClasses: Record<ThemeSizes, string> = {
		[ThemeSizes.XSmall]: 'input-xs',
		[ThemeSizes.Small]: 'input-sm',
		[ThemeSizes.Medium]: 'input-md',
		[ThemeSizes.Large]: 'input-lg',
		[ThemeSizes.XLarge]: 'input-lg'
	};

	const colorClasses: Record<ThemeColors, string> = {
		[ThemeColors.Primary]: 'input-primary',
		[ThemeColors.Secondary]: 'input-secondary',
		[ThemeColors.Accent]: 'input-accent',
		[ThemeColors.Success]: 'input-success',
		[ThemeColors.Error]: 'input-error',
		[ThemeColors.Info]: 'input-info',
		[ThemeColors.Warning]: 'input-warning',
		[ThemeColors.Neutral]: 'input-neutral'
	};

	$: inputClasses = classNames(
		'input',
		'input-bordered',
		'w-full',
		sizeClasses[size],
		{
			[colorClasses[color]]: !error,
			'input-error': error
		},
		classes
	);

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		dispatch('input', { value });
	}

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		dispatch('change', { value: target.value });
	}
</script>

<input
	{type}
	{value}
	{placeholder}
	{disabled}
	{readonly}
	class={inputClasses}
	on:input={handleInput}
	on:change={handleChange}
	on:blur={() => dispatch('blur')}
	on:focus={() => dispatch('focus')}
/>
