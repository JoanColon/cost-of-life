<template>
  <q-card flat class="dashboard-card">
    <header class="card-header">
      <div class="card-heading">
        <div v-if="icon" class="card-icon" :class="iconTone">
          <q-icon :name="icon" />
        </div>
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <q-btn
        flat
        round
        dense
        icon="chevron_right"
        class="card-link"
        :aria-label="title"
        @click="$emit('open')"
      />
    </header>
    <slot />
  </q-card>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  iconTone: { type: String, default: 'green' },
})

defineEmits(['open'])
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.dashboard-card {
  @include dashboard-card;
  container-type: inline-size;
  padding: clamp(1.25rem, 2.5vw, 2rem);
  color: var(--color-ink);
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.card-heading {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.card-icon {
  display: grid;
  place-items: center;
  flex: 0 0 3.5rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  font-size: 1.65rem;
}

.card-icon.green {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}

.card-icon.blue {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.card-icon.purple {
  background: var(--color-purple-soft);
  color: var(--color-purple);
}

h2 {
  margin: 0;
  font-size: clamp(1.35rem, 2vw, 1.75rem);
  font-weight: 750;
  line-height: 1.15;
  letter-spacing: -0.035em;
}

p {
  margin: 0.35rem 0 0;
  color: var(--color-copy);
  font-size: 0.95rem;
}

.card-link {
  flex: 0 0 auto;
  margin: -0.4rem -0.55rem 0 0;
  color: var(--color-copy);
}

@media (max-width: 599px) {
  .dashboard-card {
    padding: 1.2rem;
    border-radius: var(--radius-md);
  }

  .card-header {
    margin-bottom: 1rem;
  }

  .card-icon {
    flex-basis: 3rem;
    width: 3rem;
    height: 3rem;
    font-size: 1.4rem;
  }
}
</style>
