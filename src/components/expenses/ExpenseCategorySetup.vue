<template>
  <section class="setup-panel" :class="{ 'setup-panel--dialog': editMode }">
    <div class="setup-copy">
      <h1>{{ editMode ? t('expenses.setup.editTitle') : t('expenses.setup.title') }}</h1>
      <p>{{ t('expenses.setup.description') }}</p>
    </div>

    <div class="category-grid">
      <button
        v-for="category in expenseCategories"
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
        outline
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
import { expenseCategories } from '@/config/expense-categories'

const props = defineProps({
  editMode: Boolean,
  initialSelected: { type: Array, default: () => [] },
  saving: Boolean,
})
defineEmits(['save', 'cancel'])
const { t } = useI18n()
const selected = ref([...props.initialSelected])

watch(
  () => props.initialSelected,
  (value) => (selected.value = [...value]),
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

.setup-panel--dialog {
  display: flex;
  flex-direction: column;
  max-width: none;
  max-height: calc(100dvh - 2rem);
}

.setup-panel--dialog .setup-copy {
  flex: 0 0 auto;
  max-width: none;
  padding: 1.5rem 1.75rem 0.85rem;
}

.setup-panel--dialog .setup-copy h1 {
  padding-right: 2.75rem;
  font-size: 2rem;
  line-height: 1.1;
  letter-spacing: -0.04em;
}

.setup-panel--dialog .setup-copy p {
  margin-top: 0.5rem;
}

.setup-panel--dialog .category-grid {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 0;
  padding: 0.75rem 1.75rem 1.5rem;
  overflow-y: auto;
}

.setup-panel--dialog .setup-actions {
  flex: 0 0 auto;
  min-height: 4.75rem;
  margin-top: 0;
  padding: 0.85rem 1.75rem;
  border-top: 1px solid var(--color-line);
  background: var(--color-surface);
}

.setup-copy {
  max-width: 40rem;
}

h1 {
  margin: 0;
  color: var(--color-ink);
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.05em;
}

p {
  margin: 0.8rem 0 0;
  color: var(--color-copy);
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
  min-height: 5.5rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  box-shadow: var(--shadow-card);
  cursor: pointer;
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
  background: #ffe9ea;
  color: #e85d65;
  font-size: 1.4rem;
}

.category-choice strong,
.category-choice small {
  display: block;
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

  .setup-actions,
  .setup-actions .q-btn {
    width: 100%;
  }

  .setup-panel--dialog {
    max-height: 100dvh;
  }

  .setup-panel--dialog .setup-copy {
    padding: 1.15rem 1rem 0.65rem;
  }

  .setup-panel--dialog .setup-copy h1 {
    font-size: 1.55rem;
  }

  .setup-panel--dialog .category-grid {
    padding: 0.6rem 1rem 1rem;
  }

  .setup-panel--dialog .setup-actions {
    padding: 0.65rem 1rem;
  }
}
</style>
