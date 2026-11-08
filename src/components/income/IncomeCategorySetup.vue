<template>
  <section class="setup-panel">
    <div class="setup-copy">
      <h1>{{ editMode ? t('income.setup.editTitle') : t('income.setup.title') }}</h1>
      <p>{{ t('income.setup.subtitle') }}</p>
    </div>
    <div class="category-grid">
      <button
        v-for="category in incomeCategories"
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
        class="app-btn--wide app-btn--mobile-block"
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
import { incomeCategories } from '@/config/income-categories'

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

@include category-setup;

.category-icon {
  background: var(--color-green-soft);
  color: var(--color-success-dark);
}
</style>
