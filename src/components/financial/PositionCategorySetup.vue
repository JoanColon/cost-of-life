<template>
  <section
    class="setup-panel"
    :class="[`setup-panel--${variant}`, { 'setup-panel--dialog': editMode }]"
  >
    <div class="setup-copy">
      <h1>
        {{
          editMode
            ? t(`${translationNamespace}.setup.editTitle`)
            : t(`${translationNamespace}.setup.title`)
        }}
      </h1>
      <p>{{ t(`${translationNamespace}.setup.subtitle`) }}</p>
    </div>

    <div class="category-grid">
      <button
        v-for="category in categories"
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

const props = defineProps({
  categories: { type: Array, required: true },
  translationNamespace: { type: String, required: true },
  variant: { type: String, required: true },
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

@include category-setup(
  $choice-min-height: 7rem,
  $choice-padding: 1.25rem,
  $dialog: true,
  $mobile-choice-min-height: 6.25rem
);

.setup-panel--assets p,
.setup-panel--assets .category-choice strong {
  font-size: 1rem;
}

.setup-panel--assets .category-choice {
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.setup-panel--assets .category-choice:hover {
  transform: translateY(-2px);
}

.category-icon {
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.setup-panel--liabilities .category-icon {
  background: var(--color-red-soft);
  color: var(--color-danger);
}
</style>
