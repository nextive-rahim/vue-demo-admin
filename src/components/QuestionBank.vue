<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api, ApiError } from '../api';
import AlertMessage from './AlertMessage.vue';

const error = ref(null);

// Categories + subcategories
const categories = ref([]);
const loadingCats = ref(true);
const newCategory = ref('');
const selectedCategoryId = ref(null);
const newSubcategory = ref('');

// Questions
const questions = ref([]);
const loadingQuestions = ref(false);
const filterSubcategoryId = ref('');
const search = ref('');

// Question form (create/edit)
const blankQuestion = () => ({
    subcategory_id: '',
    body: '',
    marks: 1,
    options: [
        { body: '', is_correct: true },
        { body: '', is_correct: false },
    ],
});
const form = reactive(blankQuestion());
const formErrors = ref({});
const editingId = ref(null);
const saving = ref(false);

const selectedCategory = computed(() => categories.value.find((c) => c.id === selectedCategoryId.value) || null);
const subcategories = computed(() => selectedCategory.value?.subcategories ?? []);
const allSubcategories = computed(() => categories.value.flatMap((c) => (c.subcategories ?? []).map((s) => ({ ...s, categoryName: c.name }))));

async function loadCategories() {
    loadingCats.value = true;
    try {
        categories.value = (await api.categories()).data;
        if (!selectedCategoryId.value && categories.value.length) {
            selectedCategoryId.value = categories.value[0].id;
        }
    } catch (e) {
        error.value = 'Could not load categories.';
    } finally {
        loadingCats.value = false;
    }
}

async function addCategory() {
    if (!newCategory.value.trim()) return;
    try {
        await api.createCategory({ name: newCategory.value.trim() });
        newCategory.value = '';
        await loadCategories();
    } catch (e) {
        error.value = e instanceof ApiError ? e.message : 'Could not create category.';
    }
}

async function deleteCategory(category) {
    if (!confirm(`Delete "${category.name}" and all its subcategories and questions?`)) return;
    try {
        await api.deleteCategory(category.id);
        if (selectedCategoryId.value === category.id) selectedCategoryId.value = null;
        await loadCategories();
        await loadQuestions();
    } catch (e) {
        error.value = 'Could not delete category.';
    }
}

async function addSubcategory() {
    if (!newSubcategory.value.trim() || !selectedCategoryId.value) return;
    try {
        await api.createSubcategory({ category_id: selectedCategoryId.value, name: newSubcategory.value.trim() });
        newSubcategory.value = '';
        await loadCategories();
    } catch (e) {
        error.value = e instanceof ApiError ? e.message : 'Could not create subcategory.';
    }
}

async function deleteSubcategory(sub) {
    if (!confirm(`Delete "${sub.name}" and its questions?`)) return;
    try {
        await api.deleteSubcategory(sub.id);
        await loadCategories();
        await loadQuestions();
    } catch (e) {
        error.value = 'Could not delete subcategory.';
    }
}

async function loadQuestions() {
    loadingQuestions.value = true;
    try {
        questions.value = (await api.questions({
            subcategory_id: filterSubcategoryId.value || undefined,
            search: search.value || undefined,
        })).data;
    } catch (e) {
        error.value = 'Could not load questions.';
    } finally {
        loadingQuestions.value = false;
    }
}

// --- Question form helpers ---

function addOption() {
    if (form.options.length < 6) form.options.push({ body: '', is_correct: false });
}

function removeOption(index) {
    if (form.options.length <= 2) return;
    const wasCorrect = form.options[index].is_correct;
    form.options.splice(index, 1);
    if (wasCorrect) form.options[0].is_correct = true;
}

function setCorrect(index) {
    form.options.forEach((o, i) => { o.is_correct = i === index; });
}

function resetForm() {
    Object.assign(form, blankQuestion());
    if (filterSubcategoryId.value) form.subcategory_id = filterSubcategoryId.value;
    editingId.value = null;
    formErrors.value = {};
}

async function startEdit(question) {
    editingId.value = question.id;
    formErrors.value = {};
    Object.assign(form, {
        subcategory_id: question.subcategory_id,
        body: question.body,
        marks: question.marks,
        options: question.options.map((o) => ({ body: o.body, is_correct: o.is_correct })),
    });
}

async function saveQuestion() {
    saving.value = true;
    formErrors.value = {};
    const payload = {
        subcategory_id: form.subcategory_id,
        body: form.body,
        marks: form.marks,
        options: form.options.map((o) => ({ body: o.body, is_correct: o.is_correct })),
    };
    try {
        if (editingId.value) {
            await api.updateQuestion(editingId.value, payload);
        } else {
            await api.createQuestion(payload);
        }
        resetForm();
        await Promise.all([loadQuestions(), loadCategories()]);
    } catch (e) {
        if (e instanceof ApiError) {
            formErrors.value = e.errors;
            if (e.errors.options) error.value = e.errors.options[0];
        } else {
            error.value = 'Could not save question.';
        }
    } finally {
        saving.value = false;
    }
}

async function deleteQuestion(question) {
    if (!confirm('Delete this question?')) return;
    try {
        await api.deleteQuestion(question.id);
        await loadQuestions();
    } catch (e) {
        error.value = 'Could not delete question.';
    }
}

onMounted(async () => {
    await loadCategories();
    await loadQuestions();
    resetForm();
});
</script>

<template>
    <div class="mx-auto max-w-6xl p-8">
        <h1 class="mb-1 text-xl font-bold text-slate-900">Question Bank</h1>
        <p class="mb-6 text-sm text-slate-500">Organise MCQ questions by category and subcategory, then attach them to exams.</p>

        <AlertMessage type="error" :message="error" class="mb-6" />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <!-- Categories & subcategories -->
            <section class="space-y-4">
                <div class="rounded-xl border border-slate-200 bg-white">
                    <div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-900">Categories</h2></div>
                    <ul class="divide-y divide-slate-100">
                        <li
                            v-for="cat in categories"
                            :key="cat.id"
                            class="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50"
                            :class="selectedCategoryId === cat.id ? 'bg-indigo-50/50' : ''"
                        >
                            <button class="text-left text-slate-800" @click="selectedCategoryId = cat.id">
                                {{ cat.name }}
                                <span class="ml-1 text-xs text-slate-400">({{ cat.subcategories_count ?? cat.subcategories?.length ?? 0 }})</span>
                            </button>
                            <button class="text-xs text-red-500 hover:text-red-700" @click="deleteCategory(cat)">✕</button>
                        </li>
                        <li v-if="loadingCats" class="px-4 py-4 text-center text-xs text-slate-400">Loading…</li>
                        <li v-else-if="!categories.length" class="px-4 py-4 text-center text-xs text-slate-400">No categories yet.</li>
                    </ul>
                    <form class="flex gap-2 border-t border-slate-100 p-3" @submit.prevent="addCategory">
                        <input v-model="newCategory" placeholder="New category" class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm" />
                        <button class="rounded-md bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700">Add</button>
                    </form>
                </div>

                <div v-if="selectedCategory" class="rounded-xl border border-slate-200 bg-white">
                    <div class="border-b border-slate-200 px-4 py-3">
                        <h2 class="text-sm font-semibold text-slate-900">Subcategories of {{ selectedCategory.name }}</h2>
                    </div>
                    <ul class="divide-y divide-slate-100">
                        <li v-for="sub in subcategories" :key="sub.id" class="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50">
                            <span class="text-slate-800">{{ sub.name }} <span class="text-xs text-slate-400">({{ sub.questions_count ?? 0 }})</span></span>
                            <button class="text-xs text-red-500 hover:text-red-700" @click="deleteSubcategory(sub)">✕</button>
                        </li>
                        <li v-if="!subcategories.length" class="px-4 py-4 text-center text-xs text-slate-400">No subcategories.</li>
                    </ul>
                    <form class="flex gap-2 border-t border-slate-100 p-3" @submit.prevent="addSubcategory">
                        <input v-model="newSubcategory" placeholder="New subcategory" class="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm" />
                        <button class="rounded-md bg-slate-900 px-3 py-1 text-sm font-semibold text-white hover:bg-slate-700">Add</button>
                    </form>
                </div>
            </section>

            <!-- Questions list -->
            <section class="lg:col-span-2 space-y-4">
                <div class="rounded-xl border border-slate-200 bg-white">
                    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
                        <h2 class="text-sm font-semibold text-slate-900">Questions</h2>
                        <div class="ml-auto flex gap-2">
                            <select v-model="filterSubcategoryId" class="rounded-md border border-slate-300 px-2 py-1 text-xs" @change="loadQuestions">
                                <option value="">All subcategories</option>
                                <option v-for="s in allSubcategories" :key="s.id" :value="s.id">{{ s.categoryName }} / {{ s.name }}</option>
                            </select>
                            <input v-model="search" placeholder="Search…" class="rounded-md border border-slate-300 px-2 py-1 text-xs" @keyup.enter="loadQuestions" />
                            <button class="rounded-md bg-slate-900 px-3 py-1 text-xs text-white" @click="loadQuestions">Go</button>
                        </div>
                    </div>

                    <p v-if="loadingQuestions" class="px-4 py-6 text-center text-xs text-slate-400">Loading…</p>
                    <ul v-else class="divide-y divide-slate-100">
                        <li v-for="q in questions" :key="q.id" class="px-4 py-3 text-sm">
                            <div class="flex items-start justify-between gap-2">
                                <p class="font-medium text-slate-800">{{ q.body }}</p>
                                <div class="flex shrink-0 gap-2">
                                    <button class="text-xs font-medium text-indigo-600 hover:text-indigo-500" @click="startEdit(q)">Edit</button>
                                    <button class="text-xs text-red-500 hover:text-red-700" @click="deleteQuestion(q)">Delete</button>
                                </div>
                            </div>
                            <ul class="mt-1 space-y-0.5">
                                <li v-for="o in q.options" :key="o.id" class="text-xs" :class="o.is_correct ? 'font-semibold text-emerald-600' : 'text-slate-500'">
                                    {{ o.is_correct ? '✓' : '○' }} {{ o.body }}
                                </li>
                            </ul>
                            <p class="mt-1 text-xs text-slate-400">{{ q.marks }} mark(s) · {{ q.subcategory?.category?.name }} / {{ q.subcategory?.name }}</p>
                        </li>
                        <li v-if="!questions.length" class="px-4 py-6 text-center text-xs text-slate-400">No questions found.</li>
                    </ul>
                </div>

                <!-- Create / edit question -->
                <form class="space-y-3 rounded-xl border border-slate-200 bg-white p-5" @submit.prevent="saveQuestion">
                    <div class="flex items-center justify-between">
                        <h3 class="font-semibold text-slate-900">{{ editingId ? 'Edit question' : 'New question' }}</h3>
                        <button v-if="editingId" type="button" class="text-xs text-slate-500 hover:text-slate-700" @click="resetForm">Cancel</button>
                    </div>

                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <select v-model="form.subcategory_id" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2">
                            <option value="" disabled>Choose subcategory…</option>
                            <option v-for="s in allSubcategories" :key="s.id" :value="s.id">{{ s.categoryName }} / {{ s.name }}</option>
                        </select>
                        <input v-model.number="form.marks" type="number" min="1" placeholder="Marks" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </div>
                    <p v-if="formErrors.subcategory_id" class="text-xs text-red-600">{{ formErrors.subcategory_id[0] }}</p>

                    <textarea v-model="form.body" placeholder="Question text" rows="2" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
                    <p v-if="formErrors.body" class="text-xs text-red-600">{{ formErrors.body[0] }}</p>

                    <div>
                        <label class="mb-1 block text-xs font-medium text-slate-600">Options (select the correct one)</label>
                        <div v-for="(opt, i) in form.options" :key="i" class="mb-2 flex items-center gap-2">
                            <input type="radio" name="correct" :checked="opt.is_correct" @change="setCorrect(i)" />
                            <input v-model="opt.body" :placeholder="`Option ${i + 1}`" required class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                            <button type="button" class="text-xs text-red-400 hover:text-red-600 disabled:opacity-30" :disabled="form.options.length <= 2" @click="removeOption(i)">✕</button>
                        </div>
                        <button type="button" class="text-xs font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40" :disabled="form.options.length >= 6" @click="addOption">+ Add option</button>
                        <p v-if="formErrors.options" class="mt-1 text-xs text-red-600">{{ formErrors.options[0] }}</p>
                    </div>

                    <button :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                        {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Create question') }}
                    </button>
                </form>
            </section>
        </div>
    </div>
</template>
