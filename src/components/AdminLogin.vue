<script setup>
import { ref } from 'vue';
import { api, ApiError, setToken } from '../api';
import TextField from './TextField.vue';
import AlertMessage from './AlertMessage.vue';
import AuthButton from './AuthButton.vue';

const emit = defineEmits(['authenticated']);

// Default admin credentials seeded by the API (DefaultAdminSeeder).
const phone = ref('01718663032');
const password = ref('123456');
const loading = ref(false);
const formError = ref(null);

async function submit() {
    loading.value = true;
    formError.value = null;

    try {
        const { token, user } = await api.login({ phone: phone.value, password: password.value });

        if (!user.is_admin) {
            formError.value = 'This account does not have admin access.';
            return;
        }

        setToken(token);
        emit('authenticated', user);
    } catch (e) {
        formError.value = e instanceof ApiError
            ? (e.firstError('phone') || e.message)
            : 'Network error. Please try again.';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-full items-center justify-center p-6">
        <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60">
            <div class="mb-6 text-center">
                <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">A</div>
                <h1 class="text-xl font-bold text-slate-900">Admin sign in</h1>
                <p class="mt-1 text-sm text-slate-500">VueJS Demo Admin</p>
            </div>

            <form class="space-y-4" @submit.prevent="submit">
                <AlertMessage type="error" :message="formError" />
                <TextField v-model="phone" label="Phone" type="tel" autocomplete="username" />
                <TextField v-model="password" label="Password" type="password" autocomplete="current-password" />
                <AuthButton :loading="loading">Sign in</AuthButton>
            </form>

            <p class="mt-4 text-center text-xs text-slate-400">
                Default: 01718663032 / 123456
            </p>
        </div>
    </div>
</template>
