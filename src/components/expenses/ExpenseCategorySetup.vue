<template>
  <section class="setup-panel" :class="{ 'setup-panel--dialog': editMode }">
    <div class="setup-copy">
      <h1>{{ editMode ? t('expenses.setup.editTitle') : t('expenses.setup.title') }}</h1>
      <p>{{ editMode ? t('expenses.setup.editDescription') : t('expenses.setup.description') }}</p>
    </div>

    <div class="category-grid">
      <template v-for="category in expenseCategories" :key="category.id">
        <div
          v-if="editMode"
          class="category-choice category-choice--expandable"
          :class="{
            selected: selected.includes(category.id),
            'category-choice--expanded': expanded.includes(category.id),
          }"
        >
          <div class="category-choice__header">
            <q-checkbox
              :model-value="selected.includes(category.id)"
              :disable="
                selected.includes(category.id) && categoryHasSelectedSubcategories(category)
              "
              :aria-label="t('expenses.setup.toggleCategory', { category: t(category.nameKey) })"
              :title="
                selected.includes(category.id) && categoryHasSelectedSubcategories(category)
                  ? t('expenses.setup.categoryHasSubcategories')
                  : undefined
              "
              @update:model-value="toggle(category.id, $event)"
            />
            <button
              type="button"
              class="category-choice__toggle"
              :aria-expanded="expanded.includes(category.id)"
              @click="toggleExpanded(category.id)"
            >
              <span class="category-icon"><q-icon :name="category.icon" /></span>
              <span class="category-choice__copy">
                <strong>{{ t(category.nameKey) }}</strong>
                <small>{{ subcategorySummary(category) }}</small>
              </span>
              <q-icon
                class="expand-mark"
                name="expand_more"
                :class="{ 'expand-mark--open': expanded.includes(category.id) }"
              />
            </button>
          </div>

          <q-slide-transition>
            <div v-show="expanded.includes(category.id)" class="subcategory-panel">
              <q-checkbox
                :model-value="
                  someSubcategoriesSelected(category) ? null : allSubcategoriesSelected(category)
                "
                class="subcategory-select-all"
                :label="t('expenses.setup.selectAll')"
                @update:model-value="toggleAllSubcategories(category)"
              />
              <q-separator />
              <div class="subcategory-list">
                <q-checkbox
                  v-for="subcategory in category.suggestions"
                  :key="subcategory.id"
                  :model-value="selectedSubcategories.includes(subcategory.id)"
                  :label="t(subcategory.nameKey)"
                  class="subcategory-choice"
                  @update:model-value="toggleSubcategory(category.id, subcategory.id)"
                />
              </div>
            </div>
          </q-slide-transition>
        </div>

        <button
          v-else
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
      </template>
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
        class="app-btn--wide app-btn--mobile-block"
        :label="editMode ? t('common.save') : t('common.continue')"
        :disable="selected.length === 0"
        :loading="saving"
        @click="save"
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
  initialSelectedSubcategories: { type: Array, default: () => [] },
  saving: Boolean,
})
const emit = defineEmits(['save', 'cancel'])
const { t } = useI18n()
const selected = ref([...props.initialSelected])
const selectedSubcategories = ref([...props.initialSelectedSubcategories])
const expanded = ref([])

watch(
  () => props.initialSelected,
  (value) => (selected.value = [...value]),
)
watch(
  () => props.initialSelectedSubcategories,
  (value) => (selectedSubcategories.value = [...value]),
)

function toggle(categoryId, nextSelected = null) {
  const category = expenseCategories.find(({ id }) => id === categoryId)
  const isSelected = selected.value.includes(categoryId)
  const shouldSelect = nextSelected === null ? !isSelected : nextSelected
  if (isSelected && !shouldSelect && categoryHasSelectedSubcategories(category)) return

  selected.value = selected.value.includes(categoryId)
    ? selected.value.filter((id) => id !== categoryId)
    : [...selected.value, categoryId]
}

function categoryHasSelectedSubcategories(category) {
  return Boolean(category?.suggestions.some(({ id }) => selectedSubcategories.value.includes(id)))
}

function toggleExpanded(categoryId) {
  expanded.value = expanded.value.includes(categoryId)
    ? expanded.value.filter((id) => id !== categoryId)
    : [...expanded.value, categoryId]
}

function toggleSubcategory(categoryId, subcategoryId) {
  selectedSubcategories.value = selectedSubcategories.value.includes(subcategoryId)
    ? selectedSubcategories.value.filter((id) => id !== subcategoryId)
    : [...selectedSubcategories.value, subcategoryId]
  if (!selected.value.includes(categoryId) && selectedSubcategories.value.includes(subcategoryId)) {
    selected.value = [...selected.value, categoryId]
  }
}

function allSubcategoriesSelected(category) {
  return category.suggestions.every(({ id }) => selectedSubcategories.value.includes(id))
}

function someSubcategoriesSelected(category) {
  return (
    !allSubcategoriesSelected(category) &&
    category.suggestions.some(({ id }) => selectedSubcategories.value.includes(id))
  )
}

function toggleAllSubcategories(category) {
  const subcategoryIds = category.suggestions.map(({ id }) => id)
  if (allSubcategoriesSelected(category)) {
    selectedSubcategories.value = selectedSubcategories.value.filter(
      (id) => !subcategoryIds.includes(id),
    )
    return
  }
  selectedSubcategories.value = [...new Set([...selectedSubcategories.value, ...subcategoryIds])]
  if (!selected.value.includes(category.id)) selected.value = [...selected.value, category.id]
}

function subcategorySummary(category) {
  const count = category.suggestions.filter(({ id }) =>
    selectedSubcategories.value.includes(id),
  ).length
  return count
    ? t('expenses.setup.selectedSubcategories', { count, total: category.suggestions.length })
    : t(category.descriptionKey)
}

function save() {
  if (!props.editMode) {
    emit('save', selected.value)
    return
  }
  const activeSubcategoryIds = expenseCategories
    .filter(({ id }) => selected.value.includes(id))
    .flatMap(({ suggestions }) => suggestions.map(({ id }) => id))
  emit('save', {
    categoryIds: selected.value,
    subcategoryIds: selectedSubcategories.value.filter((id) => activeSubcategoryIds.includes(id)),
  })
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

@include category-setup($dialog: true);

.category-grid {
  align-items: start;
  grid-auto-rows: max-content;
}

.category-icon {
  background: var(--color-red-soft);
  color: var(--color-danger);
}

.category-choice--expandable {
  display: block;
  align-self: start;
  height: auto;
  padding: 0;
  overflow: hidden;
  cursor: default;
}

.category-choice--expanded {
  grid-column: 1 / -1;
}

.category-choice__header {
  display: flex;
  align-items: center;
  min-height: 5.5rem;
  padding-left: 0.55rem;
}

.category-choice__toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  flex: 1;
  gap: 1rem;
  min-width: 0;
  min-height: 5.5rem;
  padding: 0.9rem 1rem 0.9rem 0.25rem;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.category-choice__toggle:focus-visible {
  @include focus-ring;
  outline-offset: -3px;
}

.category-choice__copy strong,
.category-choice__copy small {
  display: block;
}

.category-choice__copy small {
  margin-top: 0.25rem;
  color: var(--color-copy);
  font-size: 0.8rem;
  line-height: 1.35;
}

.expand-mark {
  color: var(--color-copy);
  font-size: 1.5rem;
  transition: transform 180ms ease;
}

.expand-mark--open {
  transform: rotate(180deg);
}

.subcategory-panel {
  display: grid;
  padding: 0 1rem 0.75rem 3.55rem;
}

.subcategory-list {
  display: grid;
  padding-top: 0.25rem;
}

.subcategory-select-all {
  min-height: 2.75rem;
  font-weight: 700;
}

.subcategory-choice {
  min-height: 2.5rem;
}

@media (max-width: 699px) {
  .subcategory-panel {
    padding-left: 1rem;
  }
}
</style>
