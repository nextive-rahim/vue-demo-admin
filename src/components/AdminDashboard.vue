<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api';
import AlertMessage from './AlertMessage.vue';

const stats = ref(null);
const users = ref([]);
const loading = ref(true);
const error = ref(null);

async function load() {
    loading.value = true;
    error.value = null;
    try {
        const [statsRes, usersRes] = await Promise.all([api.stats(), api.users()]);
        stats.value = statsRes;
        users.value = usersRes.data;
    } catch (e) {
        error.value = 'Could not load dashboard data.';
    } finally {
        loading.value = false;
    }
}

function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString();
}

onMounted(load);
</script>

<template>
    <main class="mx-auto max-w-6xl p-8">
        <div class="mb-6 flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">Users</h2>
            <button class="text-sm font-medium text-slate-500 hover:text-slate-900" @click="load">Refresh</button>
        </div>

        <AlertMessage type="error" :message="error" class="mb-6" />

        <!-- Stat cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="rounded-xl border border-slate-200 bg-white p-5">
                <p class="text-sm text-slate-500">Total users</p>
                <p class="mt-1 text-3xl font-bold text-slate-900">{{ stats?.total_users ?? '—' }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-5">
                <p class="text-sm text-slate-500">Customers</p>
                <p class="mt-1 text-3xl font-bold text-slate-900">{{ stats?.customers ?? '—' }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-5">
                <p class="text-sm text-slate-500">Admins</p>
                <p class="mt-1 text-3xl font-bold text-slate-900">{{ stats?.admins ?? '—' }}</p>
            </div>
        </div>

        <!-- Users table -->
        <div class="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div v-if="loading" class="px-5 py-10 text-center text-sm text-slate-400">Loading…</div>

            <table v-else class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th class="px-5 py-3">ID</th>
                        <th class="px-5 py-3">Name</th>
                        <th class="px-5 py-3">Phone</th>
                        <th class="px-5 py-3">Email</th>
                        <th class="px-5 py-3">Role</th>
                        <th class="px-5 py-3">Joined</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="user in users" :key="user.id" class="hover:bg-slate-50">
                        <td class="px-5 py-3 text-slate-500">{{ user.id }}</td>
                        <td class="px-5 py-3 font-medium text-slate-900">{{ user.name }}</td>
                        <td class="px-5 py-3 text-slate-700">{{ user.phone }}</td>
                        <td class="px-5 py-3 text-slate-700">{{ user.email || '—' }}</td>
                        <td class="px-5 py-3">
                            <span
                                class="rounded-full px-2 py-0.5 text-xs font-medium"
                                :class="user.is_admin ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'"
                            >
                                {{ user.is_admin ? 'Admin' : 'Customer' }}
                            </span>
                        </td>
                        <td class="px-5 py-3 text-slate-500">{{ formatDate(user.created_at) }}</td>
                    </tr>
                    <tr v-if="!users.length">
                        <td colspan="6" class="px-5 py-10 text-center text-slate-400">No users yet.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </main>
</template>
