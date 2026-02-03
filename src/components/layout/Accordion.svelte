<script lang="ts">
	import classNames from 'classnames';

	export let title: string;
	export let open: boolean = false;
	export let name: string = '';
	export let icon: string = '';
	export let classes: string = '';

	$: accordionClasses = classNames('collapse', 'collapse-arrow', 'bg-base-200', classes);
</script>

<div class={accordionClasses}>
	<input type="radio" {name} checked={open} on:change />
	<div class="collapse-title text-lg font-medium flex items-center gap-2">
		{#if icon}
			<span class="text-xl">{icon}</span>
		{/if}
		{title}
	</div>
	<div class="collapse-content">
		<slot />
	</div>
</div>
