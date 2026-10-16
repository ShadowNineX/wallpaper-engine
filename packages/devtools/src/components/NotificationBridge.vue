<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables';
import { onScopeDispose } from 'vue';
import { setNotificationHandler } from '../notifications';

const toast = useToast();
onScopeDispose(setNotificationHandler(message => toast.add({ title: message, duration: 3600 })));
</script>

<template>
  <span hidden />
</template>
