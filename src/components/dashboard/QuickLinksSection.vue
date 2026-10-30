<template>
  <section class="quick-links" :aria-label="t('dashboard.quickLinks.title')">
    <div class="quick-links-header">
      <h2>{{ t('dashboard.quickLinks.title') }}</h2>
      <button type="button" class="configure-link" @click="openDialog">
        {{ t('dashboard.quickLinks.configure') }}
      </button>
    </div>

    <div v-if="selectedLinks.length" class="quick-link-chips">
      <router-link
        v-for="link in selectedLinks"
        :key="link.id"
        :to="link.to"
        class="quick-link-chip"
      >
        <q-icon :name="link.icon" aria-hidden="true" />
        <span>{{ link.label }}</span>
        <q-icon name="arrow_forward" class="chip-arrow" aria-hidden="true" />
      </router-link>
    </div>
    <p v-else-if="!quickLinksStore.loading" class="quick-links-empty">
      {{ t('dashboard.quickLinks.empty') }}
    </p>

    <q-dialog v-model="dialogOpen" :maximized="$q.screen.lt.sm">
      <q-card class="quick-links-dialog">
        <q-card-section class="dialog-heading">
          <div>
            <h2>{{ t('dashboard.quickLinks.dialogTitle') }}</h2>
            <p>{{ t('dashboard.quickLinks.dialogDescription') }}</p>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            :aria-label="t('common.cancel')"
            :disable="quickLinksStore.saving"
            @click="dialogOpen = false"
          />
        </q-card-section>

        <q-card-section class="dialog-search">
          <q-input
            v-model="search"
            outlined
            dense
            clearable
            autofocus
            :placeholder="t('dashboard.quickLinks.search')"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </q-card-section>

        <q-card-section class="link-options">
          <div v-for="group in filteredGroups" :key="group.label" class="link-group">
            <h3>{{ group.label }}</h3>
            <q-list separator>
              <q-item v-for="link in group.links" :key="link.id" tag="label" clickable>
                <q-item-section avatar>
                  <span class="option-icon"><q-icon :name="link.icon" /></span>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ link.label }}</q-item-label>
                  <q-item-label v-if="link.description" caption>
                    {{ link.description }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-checkbox v-model="draftIds" :val="link.id" color="primary" />
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <p v-if="!filteredGroups.length" class="no-results">
            {{ t('dashboard.quickLinks.noResults') }}
          </p>
        </q-card-section>

        <q-card-actions align="right" class="dialog-actions">
          <q-btn
            flat
            no-caps
            :label="t('common.cancel')"
            :disable="quickLinksStore.saving"
            @click="dialogOpen = false"
          />
          <q-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.save')"
            :loading="quickLinksStore.saving"
            @click="save"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useQuickLinksStore } from '@/stores/quick-links-store'

const props = defineProps({
  workspaceId: { type: String, required: true },
  candidates: { type: Array, default: () => [] },
})

const { t } = useI18n()
const $q = useQuasar()
const quickLinksStore = useQuickLinksStore()
const dialogOpen = ref(false)
const draftIds = ref([])
const search = ref('')

const selectedIds = computed(() => quickLinksStore.linksFor(props.workspaceId))
const candidatesById = computed(() => new Map(props.candidates.map((link) => [link.id, link])))
const selectedLinks = computed(() =>
  selectedIds.value.map((id) => candidatesById.value.get(id)).filter(Boolean),
)
const filteredGroups = computed(() => {
  const query = String(search.value || '').trim().toLocaleLowerCase()
  const links = query
    ? props.candidates.filter((link) =>
        `${link.label} ${link.description || ''}`.toLocaleLowerCase().includes(query),
      )
    : props.candidates
  const groups = new Map()

  links.forEach((link) => {
    if (!groups.has(link.group)) groups.set(link.group, [])
    groups.get(link.group).push(link)
  })

  return [...groups.entries()].map(([label, groupLinks]) => ({ label, links: groupLinks }))
})

watch(
  () => props.workspaceId,
  (workspaceId) => quickLinksStore.load(workspaceId),
  { immediate: true },
)

function openDialog() {
  draftIds.value = [...selectedIds.value]
  search.value = ''
  dialogOpen.value = true
}

async function save() {
  try {
    await quickLinksStore.save(props.workspaceId, draftIds.value)
    dialogOpen.value = false
    $q.notify({
      type: 'positive',
      message: t('dashboard.quickLinks.saved'),
      position: 'top',
    })
  } catch {
    $q.notify({
      type: 'negative',
      message: t('dashboard.quickLinks.saveError'),
      position: 'top',
    })
  }
}
</script>

<style scoped lang="scss">
@use '@/css/mixins' as *;

.quick-links {
  min-height: 4.5rem;
  margin-top: 1.15rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.quick-links-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1rem;
  letter-spacing: -0.02em;
}

.configure-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.configure-link:hover {
  text-decoration: underline;
}

.configure-link:focus-visible,
.quick-link-chip:focus-visible {
  @include focus-ring;
}

.quick-link-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.75rem;
}

.quick-link-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-line));
  border-radius: 999px;
  background: var(--color-blue-soft);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.quick-link-chip:hover {
  border-color: var(--color-primary);
}

.chip-arrow {
  font-size: 0.85rem;
}

.quick-links-empty {
  margin: 0.55rem 0 0;
  color: var(--color-muted);
  font-size: 0.78rem;
}

.quick-links-dialog {
  display: flex;
  flex-direction: column;
  width: min(42rem, calc(100vw - 2rem));
  max-height: min(46rem, calc(100vh - 3rem));
  border-radius: var(--radius-lg);
}

.dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.65rem;
}

.dialog-heading h2 {
  font-size: 1.35rem;
}

.dialog-heading p {
  margin: 0.25rem 0 0;
  color: var(--color-copy);
  font-size: 0.85rem;
}

.dialog-search {
  padding-top: 0;
  padding-bottom: 0.65rem;
}

.link-options {
  flex: 1;
  padding-top: 0;
  overflow-y: auto;
}

.link-group + .link-group {
  margin-top: 1.1rem;
}

.link-group h3 {
  margin: 0 0 0.35rem;
  color: var(--color-muted);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.option-icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-blue-soft);
  color: var(--color-primary);
}

.no-results {
  margin: 2rem 0;
  color: var(--color-muted);
  text-align: center;
}

.dialog-actions {
  border-top: 1px solid var(--color-line);
  padding: 0.75rem 1rem;
}

@media (min-width: 1024px) {
  .quick-links {
    min-height: 2.75rem;
    margin-top: clamp(0.55rem, 1.3vh, 0.8rem);
    padding: 0.7rem 1rem;
  }

  .quick-link-chips {
    margin-top: 0.55rem;
  }
}

@media (max-width: 599px) {
  .quick-links {
    padding: 0.9rem 1rem;
  }

  .quick-links-header {
    align-items: baseline;
  }

  .quick-links-dialog {
    width: 100%;
    max-height: none;
    border-radius: 0;
  }
}
</style>
