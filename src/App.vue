<script setup>
import { onMounted, ref } from 'vue';
import { api, getToken, clearToken } from './api';
import AdminLogin from './components/AdminLogin.vue';
import AdminShell from './components/AdminShell.vue';

const screen = ref('loading'); // loading | login | dashboard
const admin = ref(null);

onMounted(async () => {
    if (!getToken()) {
        screen.value = 'login';
        return;
    }

    try {
        const { data } = await api.me();
        if (!data.is_admin) {
            throw new Error('not admin');
        }
        admin.value = data;
        screen.value = 'dashboard';
    } catch {
        clearToken();
        screen.value = 'login';
    }
});

function onAuthenticated(user) {
    admin.value = user;
    screen.value = 'dashboard';
}

function onLogout() {
    admin.value = null;
    screen.value = 'login';
}
</script>

<template>
    <div class="min-h-full">
        <div v-if="screen === 'loading'" class="flex min-h-screen items-center justify-center text-slate-400">
            Loading…
        </div>

        <AdminLogin v-else-if="screen === 'login'" @authenticated="onAuthenticated" />

        <AdminShell v-else-if="screen === 'dashboard'" :admin="admin" @logout="onLogout" />
    </div>
</template>
