<template>
  <button class="crime-quick-button" type="button" @click="$emit('select', category)">
    <span class="crime-quick-button__emoji">{{ category.emoji }}</span>
    <span class="crime-quick-button__label">{{ category.shortLabel }}</span>
  </button>
</template>

<script setup>
defineProps({
  category: {
    type: Object,
    required: true,
  },
})

defineEmits(['select'])
</script>
