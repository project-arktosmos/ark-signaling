<script lang="ts">
	import classNames from 'classnames';
	import { createEventDispatcher } from 'svelte';
	import { ThemeColors, ThemeSizes } from '$types/core.type';

	export let checked: boolean = false;
	export let disabled: boolean = false;
	export let color: ThemeColors = ThemeColors.Primary;
	export let size: ThemeSizes = ThemeSizes.Medium;
	export let label: string = '';
	export let classes: string = '';

	const dispatch = createEventDispatcher<{
		change: { checked: boolean };
	}>();

	const sizeClasses: Record<ThemeSizes, string> = {
		[ThemeSizes.XSmall]: 'toggle-xs',
		[ThemeSizes.Small]: 'toggle-sm',
		[ThemeSizes.Medium]: 'toggle-md',
		[ThemeSizes.Large]: 'toggle-lg',
		[ThemeSizes.XLarge]: 'toggle-lg'
	};

	const colorClasses: Record<ThemeColors, string> = {
		[ThemeColors.Primary]: 'toggle-primary',
		[ThemeColors.Secondary]: 'toggle-secondary',
		[ThemeColors.Accent]: 'toggle-accent',
		[ThemeColors.Success]: 'toggle-success',
		[ThemeColors.Error]: 'toggle-error',
		[ThemeColors.Info]: 'toggle-info',
		[ThemeColors.Warning]: 'toggle-warning',
		[ThemeColors.Neutral]: 'toggle-neutral'
	};

	$: toggleClasses = classNames('toggle', sizeClasses[size], colorClasses[color], classes);

	function handleChange(e: Event) {
		const target = e.target as HTMLInputElement;
		checked = target.checked;
		dispatch('change', { checked });
	}
</script>

<label class="label cursor-pointer justify-start gap-3">
	<input type="checkbox" class={toggleClasses} {checked} {disabled} on:change={handleChange} />
	{#if label}
		<span class="label-text">{label}</span>
	{/if}
</label>
