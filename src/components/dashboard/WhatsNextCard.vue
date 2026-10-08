<template>
  <q-card flat class="whats-next-card">
    <header class="whats-next-header">
      <div class="whats-next-heading">
        <div class="whats-next-icon"><q-icon name="flag" /></div>
        <div>
          <h2>{{ t('dashboard.whatsNext.title') }}</h2>
          <p>{{ t('dashboard.whatsNext.subtitle') }}</p>
        </div>
      </div>

      <div class="carousel-controls" :aria-label="t('dashboard.whatsNext.controls')">
        <q-btn
          flat
          round
          dense
          disable
          icon="chevron_left"
          :aria-label="t('dashboard.whatsNext.previous')"
        />
        <q-btn
          flat
          round
          dense
          disable
          icon="chevron_right"
          :aria-label="t('dashboard.whatsNext.next')"
        />
      </div>
    </header>

    <div class="carousel-viewport" role="region" :aria-label="t('dashboard.whatsNext.title')" />
  </q-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.whats-next-card {
  @include dashboard-card;
  padding: clamp(1.25rem, 2.5vw, 2rem);
  color: var(--color-ink);
}

.whats-next-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.whats-next-heading {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.whats-next-icon {
  display: grid;
  place-items: center;
  flex: 0 0 3.5rem;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--color-purple-soft);
  color: var(--color-purple);
  font-size: 1.65rem;
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

.carousel-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

.carousel-controls .q-btn {
  width: 2.65rem;
  height: 2.65rem;
  border: 1px solid var(--color-line);
  color: var(--color-copy);
}

.carousel-viewport {
  min-height: 7rem;
  margin-top: 1.15rem;
  border: 1px dashed #dce5ec;
  border-radius: var(--radius-md);
  background: linear-gradient(145deg, rgb(247 250 252 / 75%), rgb(242 247 249 / 55%));
}

@media (max-width: 599px) {
  .whats-next-card {
    padding: 1.2rem;
    border-radius: var(--radius-md);
  }

  .whats-next-icon {
    flex-basis: 3rem;
    width: 3rem;
    height: 3rem;
    font-size: 1.4rem;
  }

  .carousel-controls {
    gap: 0.25rem;
  }

  .carousel-controls .q-btn {
    width: 2.35rem;
    height: 2.35rem;
  }

  .carousel-viewport {
    min-height: 6rem;
  }
}
</style>
