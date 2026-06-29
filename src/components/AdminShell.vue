<script setup>
import { ref } from 'vue';
import { api, clearToken } from '../api';
import AdminDashboard from './AdminDashboard.vue';
import AdminCourses from './AdminCourses.vue';

const props = defineProps({
    admin: { type: Object, required: true },
});

const emit = defineEmits(['logout']);

const tab = ref('dashboard'); // dashboard | courses
const loggingOut = ref(false);

const tabs = [
    { key: 'dashboard', label: 'Users' },
    { key: 'courses', label: 'Courses' },
];

async function logout() {
    loggingOut.value = true;
    try {
        await api.logout();
    } catch {
        // Drop the token regardless.
    } finally {
        clearToken();
        emit('logout');
    }
}
</script>

<template>
    <div class="min-h-full">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4">
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">A</div>
                    <h1 class="text-sm font-bold text-slate-900">VueJS Demo Admin</h1>
                </div>
                <nav class="flex gap-1">
                    <button
                        v-for="t in tabs"
                        :key="t.key"
                        class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
                        :class="tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'"
                        @click="tab = t.key"
                    >
                        {{ t.label }}
                    </button>
                </nav>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs text-slate-500">{{ admin.name }} ({{ admin.phone }})</span>
                <button
                    class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                    :disabled="loggingOut"
                    @click="logout"
                >
                    Log out
                </button>
            </div>
        </header>

        <AdminDashboard v-if="tab === 'dashboard'" />
        <AdminCourses v-else-if="tab === 'courses'" />
    </div>
</template>
