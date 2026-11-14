<template>
  <header class="app-page-header" :class="`app-page-header--${size}`">
    <div class="app-page-header__content">
      <q-btn
        v-if="backLabel && backTo"
        flat
        dense
        no-caps
        color="grey-7"
        icon="arrow_back"
        :label="backLabel"
        :to="backTo"
        class="app-page-header__back"
      />

      <div class="app-page-header__title-row">
        <slot name="title-prefix" />
        <h1>{{ title }}</h1>
        <slot name="title-action" />
      </div>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="$slots.actions" class="app-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  backLabel: { type: String, default: '' },
  backTo: { type: [String, Object], default: null },
  size: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'hero'].includes(value),
  },
})
</script>

<style scoped lang="scss">
.app-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  min-width: 0;
}

.app-page-header__content {
  min-width: 0;
}

.app-page-header__back {
  min-height: 1.5rem;
  margin: 0 0 0.35rem -0.5rem;
  padding: 0 0.5rem;
  font-size: 0.78rem;
}

.app-page-header__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

h1 {
  margin: 0;
  color: var(--color-ink);
  font-size: clamp(2rem, 3.5vh, 2.7rem);
  line-height: 1;
  letter-spacing: -0.055em;
}

.app-page-header--hero h1 {
  font-size: clamp(2.25rem, 5vw, 4rem);
  letter-spacing: -0.05em;
}

p {
  max-width: 48rem;
  margin: 0.5rem 0 0;
  color: var(--color-copy);
  font-size: 0.95rem;
  line-height: 1.45;
}

.app-page-header__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.75rem;
}

@media (max-width: 760px) {
  .app-page-header {
    align-items: flex-end;
    gap: 0.75rem;
  }

  .app-page-header__back {
    max-width: min(80vw, 22rem);
    margin-bottom: 0.3rem;
    font-size: 0.7rem;
  }

  .app-page-header__back :deep(.q-btn__content) {
    flex-wrap: nowrap;
    min-width: 0;
  }

  .app-page-header__back :deep(.block) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  h1,
  .app-page-header--hero h1 {
    font-size: 2rem;
    line-height: 1.05;
  }

  p {
    font-size: 0.88rem;
  }
}

@media (max-width: 599px) {
  .app-page-header:has(.app-page-header__actions) {
    align-items: stretch;
    flex-direction: column;
  }

  .app-page-header__actions {
    align-self: flex-start;
  }
}
</style>
