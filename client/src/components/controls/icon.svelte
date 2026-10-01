
<!--
	Icon: one of the drawings in public/assets/icons/icons.svg. Lines take the text colour.

	Props:
		name   the symbol's id, e.g. 'check'
		class  extra classes
-->

<script>
	let { name, class: className = '' } = $props();
</script>

<svg class="icon {className}" viewBox="0 0 24 24" aria-hidden="true"><use href="/assets/icons/icons.svg#{name}" /></svg>
