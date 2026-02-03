<script lang="ts">
	import classNames from 'classnames';

	export let title: string;
	export let description: string = '';
	export let classes: string = '';

	$: headerClasses = classNames('flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center', 'gap-2', 'mb-4', classes);
</script>

<div class={headerClasses}>
	<div>
		<h3 class="text-lg font-semibold">{title}</h3>
		{#if description}
			<p class="text-sm text-base-content/60">{description}</p>
		{/if}
	</div>
	{#if $$slots.actions}
		<div class="flex gap-2">
			<slot name="actions" />
		</div>
	{/if}
</div>
