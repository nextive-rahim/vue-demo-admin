<script setup>
import { onMounted, ref } from 'vue';
import { api, ApiError } from '../api';
import AlertMessage from './AlertMessage.vue';

const props = defineProps({
    courseId: { type: [Number, String], required: true },
    contentId: { type: [Number, String], required: true },
});

const mode = ref('questions'); // questions | analytics
const error = ref(null);

// Attached questions
const attached = ref([]);
const loadingAttached = ref(true);

// Question picker (from the bank)
const showPicker = ref(false);
const bank = ref([]);
const bankSearch = ref('');
const loadingBank = ref(false);
const selectedIds = ref([]);
const attaching = ref(false);

// Analytics
const attempts = ref([]);
const analysis = ref(null);
const loadingAnalytics = ref(false);

async function loadAttached() {
    loadingAttached.value = true;
    error.value = null;
    try {
        attached.value = (await api.examQuestions(props.courseId, props.contentId)).data;
    } catch (e) {
        error.value = 'Could not load exam questions.';
    } finally {
        loadingAttached.value = false;
    }
}

async function openPicker() {
    showPicker.value = true;
    selectedIds.value = [];
    await loadBank();
}

async function loadBank() {
    loadingBank.value = true;
    try {
        bank.value = (await api.questions({ search: bankSearch.value })).data;
    } catch (e) {
        error.value = 'Could not load the question bank.';
    } finally {
        loadingBank.value = false;
    }
}

function toggle(id) {
    const i = selectedIds.value.indexOf(id);
    if (i === -1) {
        selectedIds.value.push(id);
    } else {
        selectedIds.value.splice(i, 1);
    }
}

function isAttached(id) {
    return attached.value.some((q) => q.id === id);
}

async function attachSelected() {
    if (!selectedIds.value.length) return;
    attaching.value = true;
    try {
        attached.value = (await api.attachExamQuestions(props.courseId, props.contentId, selectedIds.value)).data;
        showPicker.value = false;
    } catch (e) {
        error.value = e instanceof ApiError ? e.message : 'Could not attach questions.';
    } finally {
        attaching.value = false;
    }
}

async function detach(question) {
    if (!confirm('Remove this question from the exam?')) return;
    try {
        await api.detachExamQuestion(props.courseId, props.contentId, question.id);
        attached.value = attached.value.filter((q) => q.id !== question.id);
    } catch (e) {
        error.value = 'Could not remove the question.';
    }
}

async function loadAnalytics() {
    loadingAnalytics.value = true;
    error.value = null;
    try {
        [attempts.value, analysis.value] = await Promise.all([
            api.examAttempts(props.courseId, props.contentId).then((r) => r.data),
            api.examAnalysis(props.courseId, props.contentId).then((r) => r.data),
        ]);
    } catch (e) {
        error.value = 'Could not load analytics.';
    } finally {
        loadingAnalytics.value = false;
    }
}

function switchMode(next) {
    mode.value = next;
    if (next === 'analytics' && analysis.value === null) {
        loadAnalytics();
    }
}

function correctBody(question) {
    return question.options?.find((o) => o.is_correct)?.body ?? '—';
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : '—';
}

onMounted(loadAttached);
</script>

<template>
    <div class="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
        <div class="mb-3 flex items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-wide text-purple-700">Exam</span>
            <div class="ml-auto flex gap-1">
                <button
                    class="rounded-md px-3 py-1 text-xs font-medium"
                    :class="mode === 'questions' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-100'"
                    @click="switchMode('questions')"
                >Questions</button>
                <button
                    class="rounded-md px-3 py-1 text-xs font-medium"
                    :class="mode === 'analytics' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-100'"
                    @click="switchMode('analytics')"
                >Analytics</button>
            </div>
        </div>

        <AlertMessage type="error" :message="error" class="mb-3" />

        <!-- QUESTIONS MODE -->
        <div v-if="mode === 'questions'">
            <div class="mb-2 flex items-center justify-between">
                <p class="text-xs text-slate-500">{{ attached.length }} question(s) attached</p>
                <button class="rounded-md bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-500" @click="openPicker">
                    + Add from bank
                </button>
            </div>

            <p v-if="loadingAttached" class="text-xs text-slate-400">Loading…</p>
            <ol v-else class="space-y-2">
                <li v-for="(q, i) in attached" :key="q.id" class="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <span class="mt-0.5 text-xs font-bold text-slate-400">{{ i + 1 }}.</span>
                    <div class="flex-1">
                        <p class="text-slate-800">{{ q.body }}</p>
                        <p class="mt-0.5 text-xs text-emerald-600">✓ {{ correctBody(q) }}</p>
                        <p class="text-xs text-slate-400">{{ q.marks }} mark(s) · {{ q.subcategory?.category?.name }} / {{ q.subcategory?.name }}</p>
                    </div>
                    <button class="text-xs text-red-500 hover:text-red-700" @click="detach(q)">Remove</button>
                </li>
                <li v-if="!attached.length" class="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                    No questions yet. Add some from the bank.
                </li>
            </ol>

            <!-- Picker -->
            <div v-if="showPicker" class="mt-3 rounded-lg border border-slate-300 bg-white p-3">
                <div class="mb-2 flex gap-2">
                    <input
                        v-model="bankSearch"
                        placeholder="Search questions…"
                        class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                        @keyup.enter="loadBank"
                    />
                    <button class="rounded-md bg-slate-900 px-3 py-1 text-xs text-white" @click="loadBank">Search</button>
                    <button class="rounded-md px-3 py-1 text-xs text-slate-500" @click="showPicker = false">Close</button>
                </div>
                <p v-if="loadingBank" class="text-xs text-slate-400">Loading…</p>
                <ul v-else class="max-h-60 space-y-1 overflow-y-auto">
                    <li v-for="q in bank" :key="q.id">
                        <label
                            class="flex items-start gap-2 rounded-md p-2 text-xs"
                            :class="isAttached(q.id) ? 'opacity-40' : 'hover:bg-slate-50 cursor-pointer'"
                        >
                            <input
                                type="checkbox"
                                class="mt-0.5"
                                :disabled="isAttached(q.id)"
                                :checked="selectedIds.includes(q.id)"
                                @change="toggle(q.id)"
                            />
                            <span>
                                <span class="text-slate-800">{{ q.body }}</span>
                                <span class="ml-1 text-slate-400">({{ q.subcategory?.name }})</span>
                                <span v-if="isAttached(q.id)" class="ml-1 text-emerald-600">· already added</span>
                            </span>
                        </label>
                    </li>
                    <li v-if="!bank.length" class="p-2 text-center text-xs text-slate-400">No questions found.</li>
                </ul>
                <button
                    :disabled="attaching || !selectedIds.length"
                    class="mt-2 w-full rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                    @click="attachSelected"
                >
                    {{ attaching ? 'Adding…' : `Add ${selectedIds.length} question(s)` }}
                </button>
            </div>
        </div>

        <!-- ANALYTICS MODE -->
        <div v-else>
            <p v-if="loadingAnalytics" class="text-xs text-slate-400">Loading analytics…</p>
            <div v-else-if="analysis">
                <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="rounded-lg border border-slate-200 bg-white p-3 text-center">
                        <p class="text-lg font-bold text-slate-900">{{ analysis.participation.submitted }}</p>
                        <p class="text-xs text-slate-500">Submitted</p>
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-white p-3 text-center">
                        <p class="text-lg font-bold text-slate-900">{{ analysis.participation.in_progress }}</p>
                        <p class="text-xs text-slate-500">In progress</p>
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-white p-3 text-center">
                        <p class="text-lg font-bold text-slate-900">{{ analysis.scores.average_percentage ?? '—' }}<span v-if="analysis.scores.average_percentage !== null">%</span></p>
                        <p class="text-xs text-slate-500">Avg score</p>
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-white p-3 text-center">
                        <p class="text-lg font-bold text-slate-900">{{ analysis.scores.pass_rate ?? '—' }}<span v-if="analysis.scores.pass_rate !== null">%</span></p>
                        <p class="text-xs text-slate-500">Pass rate</p>
                    </div>
                </div>

                <h4 class="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Per-question accuracy</h4>
                <ul class="mb-4 space-y-1">
                    <li v-for="q in analysis.questions" :key="q.id" class="flex items-center gap-2 text-xs">
                        <span class="flex-1 truncate text-slate-700">{{ q.body }}</span>
                        <div class="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                            <div class="h-full bg-emerald-500" :style="{ width: (q.correct_rate ?? 0) + '%' }"></div>
                        </div>
                        <span class="w-20 text-right text-slate-500">{{ q.correct }}/{{ q.answered }} ({{ q.correct_rate ?? 0 }}%)</span>
                    </li>
                </ul>

                <h4 class="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Attempts</h4>
                <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-slate-500">
                            <tr>
                                <th class="px-3 py-2">User</th>
                                <th class="px-3 py-2">Status</th>
                                <th class="px-3 py-2">Score</th>
                                <th class="px-3 py-2">%</th>
                                <th class="px-3 py-2">Time</th>
                                <th class="px-3 py-2">Submitted</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr v-for="a in attempts" :key="a.id">
                                <td class="px-3 py-2 text-slate-800">{{ a.user?.name }}<span class="block text-slate-400">{{ a.user?.phone }}</span></td>
                                <td class="px-3 py-2">
                                    <span class="rounded-full px-2 py-0.5 font-medium" :class="a.status === 'submitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'">{{ a.status }}</span>
                                </td>
                                <td class="px-3 py-2 text-slate-700">{{ a.score ?? '—' }}<span v-if="a.total_marks"> / {{ a.total_marks }}</span></td>
                                <td class="px-3 py-2 text-slate-700">{{ a.percentage ?? '—' }}</td>
                                <td class="px-3 py-2 text-slate-700">{{ formatDuration(a.time_taken_seconds) }}</td>
                                <td class="px-3 py-2 text-slate-500">{{ formatDateTime(a.submitted_at) }}</td>
                            </tr>
                            <tr v-if="!attempts.length"><td colspan="6" class="px-3 py-6 text-center text-slate-400">No attempts yet.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>
