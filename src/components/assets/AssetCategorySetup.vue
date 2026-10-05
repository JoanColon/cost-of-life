<template>
  <section class="setup-panel">
    <div class="setup-copy">
      <div class="eyebrow">{{ t('assets.eyebrow') }}</div>
      <h1>{{ editMode ? t('assets.setup.editTitle') : t('assets.setup.title') }}</h1>
      <p>{{ t('assets.setup.subtitle') }}</p>
    </div>

    <div class="category-grid">
      <button
        v-for="category in assetCategories"
        :key="category.id"
        type="button"
        class="category-choice"
        :class="{ selected: selected.includes(category.id) }"
        :aria-pressed="selected.includes(category.id)"
        @click="toggle(category.id)"
      >
        <span class="category-icon"><q-icon :name="category.icon" /></span>
        <span>
          <strong>{{ t(category.nameKey) }}</strong>
          <small>{{ t(category.descriptionKey) }}</small>
        </span>
        <q-icon
          class="selection-mark"
          :name="selected.includes(category.id) ? 'check_circle' : 'add_circle_outline'"
        />
      </button>
    </div>

    <div class="setup-actions">
      <q-btn
        v-if="editMode"
        flat
        no-caps
        :label="t('common.cancel')"
        :disable="saving"
        @click="$emit('cancel')"
      />
      <q-btn
        unelevated
        no-caps
        color="primary"
        class="continue-button"
        :label="editMode ? t('common.save') : t('common.continue')"
        :disable="selected.length === 0"
        :loading="saving"
        @click="$emit('save', selected)"
      />
    </div>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { assetCategories } from '@/config/asset-categories'

const props = defineProps({
  initialSelected: { type: Array, default: () => [] },
  editMode: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
})

defineEmits(['save', 'cancel'])
const { t } = useI18n()
const selected = ref([...props.initialSelected])

watch(
  () => props.initialSelected,
  (value) => {
    selected.value = [...value]
  },
)

function toggle(categoryId) {
  selected.value = selected.value.includes(categoryId)
    ? selected.value.filter((id) => id !== categoryId)
    : [...selected.value, categoryId]
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.setup-panel {
  width: 100%;
  max-width: 64rem;
  margin: 0 auto;
}

.setup-copy {
  max-width: 40rem;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

h1 {
  margin: 0.45rem 0 0;
  color: var(--color-ink);
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

p {
  margin: 0.8rem 0 0;
  color: var(--color-copy);
  font-size: 1rem;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 2rem;
}

.category-choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 7rem;
  padding: 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.category-choice:hover {
  transform: translateY(-2px);
}

.category-choice.selected {
  border-color: var(--color-primary);
  box-shadow: 0 12px 38px rgb(22 136 248 / 12%);
}

.category-choice:focus-visible {
  @include focus-ring;
}

.category-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 1.4rem;
}

.category-choice strong,
.category-choice small {
  display: block;
}

.category-choice strong {
  font-size: 1rem;
}

.category-choice small {
  margin-top: 0.25rem;
  color: var(--color-copy);
  font-size: 0.8rem;
  line-height: 1.35;
}

.selection-mark {
  color: var(--color-primary);
  font-size: 1.4rem;
}

.setup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.continue-button {
  min-width: 10rem;
  min-height: 3rem;
  border-radius: 0.8rem;
}

@media (max-width: 699px) {
  .category-grid {
    grid-template-columns: 1fr;
  }

  .category-choice {
    min-height: 6.25rem;
  }

  .setup-actions,
  .setup-actions .q-btn {
    width: 100%;
  }
}
</style>
