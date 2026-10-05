<template>
  <article class="criminal-share-card">
    <img class="criminal-share-card__background" :src="backgroundAsset" alt="" />

    <section class="criminal-share-card__content">
      <div class="criminal-share-card__case">
        CASE NO. {{ caseNumber }}
        <br />
        DATE {{ dateLabel }}
        <br />
        CATEGORY {{ categoryLabel }}
      </div>
      <div class="criminal-share-card__amount">{{ amountLabel }}</div>
      <div class="criminal-share-card__title">{{ title }}</div>
      <blockquote class="criminal-share-card__quote">"{{ quote }}"</blockquote>
    </section>
  </article>
</template>

<script setup>
defineProps({
  backgroundAsset: {
    type: String,
    required: true,
  },
  caseNumber: {
    type: String,
    required: true,
  },
  dateLabel: {
    type: String,
    required: true,
  },
  categoryLabel: {
    type: String,
    required: true,
  },
  amountLabel: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  quote: {
    type: String,
    required: true,
  },
})
</script>
