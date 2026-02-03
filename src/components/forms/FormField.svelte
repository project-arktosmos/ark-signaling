<script lang="ts">
	import classNames from 'classnames';

	export let label: string = '';
	export let required: boolean = false;
	export let error: string = '';
	export let hint: string = '';
	export let classes: string = '';

	$: fieldClasses = classNames('form-control', 'w-full', classes);
</script>

<div class={fieldClasses}>
	{#if label}
		<label class="label">
			<span class="label-text">
				{label}
				{#if required}
					<span class="text-error">*</span>
				{/if}
			</span>
		</label>
	{/if}

	<slot />

	{#if error}
		<label class="label">
			<span class="label-text-alt text-error">{error}</span>
		</label>
	{:else if hint}
		<label class="label">
			<span class="label-text-alt text-base-content/60">{hint}</span>
		</label>
	{/if}
</div>
