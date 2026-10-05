<template>
  <div class="empty-state">
    <div class="empty-state__title">{{ title }}</div>
    <div class="empty-state__text">{{ text }}</div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
})
</script>
