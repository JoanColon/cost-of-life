<template>
  <article class="achievement-share-card">
    <div class="achievement-share-card__stamp">FINANCIAL CRIMES</div>

    <section class="achievement-share-card__content">
      <img class="achievement-share-card__image" :src="asset" :alt="`${name} badge`" />
      <div class="achievement-share-card__type">{{ typeLabel }}</div>
      <h1>{{ name }}</h1>
      <p>{{ description }}</p>
      <div class="achievement-share-card__month">UNLOCKED {{ monthLabel }}</div>
    </section>
  </article>
</template>

<script setup>
defineProps({
  asset: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  typeLabel: {
    type: String,
    required: true,
  },
  monthLabel: {
    type: String,
    required: true,
  },
})
</script>
