<template>
  <q-dialog v-model="dialogModel" persistent>
    <q-card class="edit-dialog app-confirm-dialog">
      <q-card-section class="dialog-header">
        <h2>{{ title }}</h2>
        <q-btn v-close-popup flat round dense color="white" icon="close" aria-label="Close" />
      </q-card-section>

      <q-card-section class="app-confirm-dialog__message">
        {{ message }}
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-close-popup flat color="white" no-caps label="Cancel" />
        <q-btn
          v-close-popup
          :color="confirmColor"
          :text-color="confirmTextColor"
          unelevated
          no-caps
          :label="confirmLabel"
          @click="$emit('confirm')"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  confirmLabel: {
    type: String,
    required: true,
  },
  confirmColor: {
    type: String,
    default: 'negative',
  },
  confirmTextColor: {
    type: String,
    default: undefined,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
</script>
