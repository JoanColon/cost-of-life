<template>
  <q-card class="setup-card">
    <div class="dialog-layout">
      <q-card-section class="setup-heading">
        <div>
          <h2>{{ t('expenseTracker.manage.title') }}</h2>
          <p>{{ t('expenseTracker.manage.description') }}</p>
        </div>
        <q-btn
          flat
          round
          dense
          icon="close"
          class="dialog-close"
          :aria-label="t('common.cancel')"
          @click="$emit('cancel')"
        />
      </q-card-section>

      <q-card-section class="setup-body">
        <div class="setup-groups">
          <section v-for="group in groups" :key="group.id" class="setup-group">
          <header class="group-heading">
            <span class="group-icon"><q-icon :name="group.icon" /></span>
            <h3>{{ t(group.nameKey) }}</h3>
          </header>
          <div class="setup-options">
            <button
              v-for="subcategory in group.subcategories"
              :key="subcategory.id"
              type="button"
              class="subcategory-option"
              :class="{ selected: selected.includes(subcategory.id) }"
              :aria-pressed="selected.includes(subcategory.id)"
              @click="toggle(subcategory.id)"
            >
              <q-icon
                :name="selected.includes(subcategory.id) ? 'check_circle' : 'add_circle_outline'"
              />
              <span>{{ t(subcategory.nameKey) }}</span>
            </button>
          </div>
          </section>
        </div>
      </q-card-section>

      <q-card-actions class="setup-actions">
        <div class="primary-actions">
          <q-btn outline no-caps :label="t('common.cancel')" @click="$emit('cancel')" />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :loading="saving"
            @click="$emit('save', selected)"
          />
        </div>
      </q-card-actions>
    </div>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { groupedExpenseTrackingCategories } from '@/config/expense-tracking-categories'

const props = defineProps({
  initialSelected: { type: Array, default: () => [] },
  subcategories: { type: Array, default: () => [] },
  saving: Boolean,
})
defineEmits(['save', 'cancel'])
const { t } = useI18n()
const groups = computed(() => groupedExpenseTrackingCategories(props.subcategories))
const selected = ref([])

watch(
  () => props.initialSelected,
  (value) => {
    selected.value = [...value]
  },
  { immediate: true },
)

function toggle(subcategoryId) {
  selected.value = selected.value.includes(subcategoryId)
    ? selected.value.filter((id) => id !== subcategoryId)
    : [...selected.value, subcategoryId]
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.setup-card {
  @include financial-dialog-card(72rem);
  max-width: none;
}

.dialog-layout {
  @include financial-dialog-layout;
}

.setup-heading {
  @include financial-dialog-header;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
}

.setup-heading h2 {
  font-size: 2rem;
}

.setup-heading p {
  max-width: 38rem;
  margin: 0.65rem 0 0;
  color: var(--color-copy);
}

.setup-body {
  @include financial-dialog-body;
}

.setup-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 0;
}

.setup-group {
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 1rem;
  background: var(--color-surface-soft);
}

.group-heading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 0.8rem;
}

.group-icon {
  display: grid;
  place-items: center;
  flex: 0 0 2rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: #e9f3ff;
  color: var(--color-primary);
}

.group-heading h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 0.95rem;
}

.setup-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.subcategory-option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--color-line);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-copy);
  font-size: 0.78rem;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease,
    transform 140ms ease;
}

.subcategory-option:hover {
  border-color: rgb(22 136 248 / 42%);
  transform: translateY(-1px);
}

.subcategory-option:focus-visible {
  @include focus-ring;
}

.subcategory-option .q-icon {
  color: var(--color-muted);
  font-size: 1rem;
}

.subcategory-option.selected {
  border-color: rgb(22 136 248 / 40%);
  background: #eaf4ff;
  color: var(--color-ink);
  font-weight: 650;
}

.subcategory-option.selected .q-icon {
  color: var(--color-primary);
}

.setup-actions {
  @include financial-dialog-actions;
}

@media (max-width: 749px) {
  .setup-groups {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 599px) {
  .setup-card {
    min-height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }

  .setup-group {
    padding: 0.85rem;
  }
}
</style>
