<script lang="ts">
	import classNames from 'classnames';

	export let title: string = '';
	export let compact: boolean = false;
	export let bordered: boolean = true;
	export let classes: string = '';

	$: cardClasses = classNames(
		'card',
		'bg-base-100',
		{
			'card-compact': compact,
			'card-bordered': bordered,
			shadow: !bordered
		},
		classes
	);
</script>

<div class={cardClasses}>
	<div class="card-body">
		{#if title}
			<h2 class="card-title">{title}</h2>
		{/if}
		<slot />
		{#if $$slots.actions}
			<div class="card-actions justify-end mt-4">
				<slot name="actions" />
			</div>
		{/if}
	</div>
</div>
