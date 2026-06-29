<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api, ApiError, CONTENT_TYPES } from '../api';
import AlertMessage from './AlertMessage.vue';

const courses = ref([]);
const loading = ref(true);
const error = ref(null);

// New-course form
const newCourse = reactive({ title: '', description: '', is_published: true });
const creating = ref(false);

// Selected course (full detail with contents)
const selected = ref(null);

// New-content form
const blankContent = () => ({ type: 'note', title: '', payload: {} });
const content = reactive(blankContent());
const contentErrors = ref({});
const savingContent = ref(false);

const pdfInput = ref(null);
const uploadingPdf = ref(false);
const pdfError = ref(null);

function typeFields(type) {
    return CONTENT_TYPES.find((t) => t.value === type)?.fields ?? [];
}

function pickPdf() {
    pdfInput.value?.click();
}

async function onPdfSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    uploadingPdf.value = true;
    pdfError.value = null;
    try {
        const { url } = await api.uploadPdf(file);
        content.payload.url = url;
    } catch (e) {
        pdfError.value = e instanceof ApiError ? (e.errors?.file?.[0] || e.message) : 'Upload failed.';
    } finally {
        uploadingPdf.value = false;
        event.target.value = '';
    }
}

async function load() {
    loading.value = true;
    error.value = null;
    try {
        courses.value = (await api.courses()).data;
    } catch (e) {
        error.value = 'Could not load courses.';
    } finally {
        loading.value = false;
    }
}

async function createCourse() {
    creating.value = true;
    error.value = null;
    try {
        await api.createCourse({ ...newCourse });
        Object.assign(newCourse, { title: '', description: '', is_published: true });
        await load();
    } catch (e) {
        error.value = e instanceof ApiError ? e.message : 'Failed to create course.';
    } finally {
        creating.value = false;
    }
}

async function selectCourse(id) {
    error.value = null;
    Object.assign(content, blankContent());
    contentErrors.value = {};
    try {
        selected.value = (await api.course(id)).data;
    } catch (e) {
        error.value = 'Could not open course.';
    }
}

async function togglePublish(course) {
    try {
        await api.updateCourse(course.id, { is_published: !course.is_published });
        await load();
        if (selected.value?.id === course.id) {
            await selectCourse(course.id);
        }
    } catch (e) {
        error.value = 'Could not update course.';
    }
}

async function deleteCourse(course) {
    if (!confirm(`Delete "${course.title}" and all its content?`)) return;
    try {
        await api.deleteCourse(course.id);
        if (selected.value?.id === course.id) selected.value = null;
        await load();
    } catch (e) {
        error.value = 'Could not delete course.';
    }
}

async function addContent() {
    savingContent.value = true;
    contentErrors.value = {};
    try {
        await api.addContent(selected.value.id, {
            type: content.type,
            title: content.title,
            payload: { ...content.payload },
        });
        Object.assign(content, blankContent());
        await selectCourse(selected.value.id);
        await load();
    } catch (e) {
        if (e instanceof ApiError) {
            contentErrors.value = e.errors;
        } else {
            error.value = 'Could not add content.';
        }
    } finally {
        savingContent.value = false;
    }
}

async function deleteContent(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
        await api.deleteContent(selected.value.id, item.id);
        await selectCourse(selected.value.id);
        await load();
    } catch (e) {
        error.value = 'Could not delete content.';
    }
}

const typeBadge = {
    note: 'bg-amber-100 text-amber-700',
    pdf: 'bg-red-100 text-red-700',
    exam: 'bg-purple-100 text-purple-700',
    video: 'bg-blue-100 text-blue-700',
    live: 'bg-rose-100 text-rose-700',
    link: 'bg-slate-100 text-slate-700',
};

onMounted(load);
</script>

<template>
    <div class="mx-auto max-w-6xl p-8">
        <AlertMessage type="error" :message="error" class="mb-6" />

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Left: course list + create -->
            <section>
                <div class="rounded-xl border border-slate-200 bg-white">
                    <div class="border-b border-slate-200 px-5 py-4">
                        <h2 class="font-semibold text-slate-900">Courses</h2>
                    </div>

                    <div v-if="loading" class="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
                    <ul v-else class="divide-y divide-slate-100">
                        <li
                            v-for="course in courses"
                            :key="course.id"
                            class="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                            :class="selected?.id === course.id ? 'bg-indigo-50/50' : ''"
                        >
                            <button class="text-left" @click="selectCourse(course.id)">
                                <span class="font-medium text-slate-900">{{ course.title }}</span>
                                <span class="ml-2 text-xs text-slate-400">{{ course.contents_count }} items</span>
                            </button>
                            <div class="flex items-center gap-2">
                                <button
                                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                                    :class="course.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                                    @click="togglePublish(course)"
                                >
                                    {{ course.is_published ? 'Published' : 'Draft' }}
                                </button>
                                <button class="text-xs text-red-500 hover:text-red-700" @click="deleteCourse(course)">Delete</button>
                            </div>
                        </li>
                        <li v-if="!courses.length" class="px-5 py-8 text-center text-sm text-slate-400">No courses yet.</li>
                    </ul>
                </div>

                <form class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5" @submit.prevent="createCourse">
                    <h3 class="font-semibold text-slate-900">New course</h3>
                    <input v-model="newCourse.title" placeholder="Course title" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <textarea v-model="newCourse.description" placeholder="Description" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
                    <label class="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" v-model="newCourse.is_published" /> Published
                    </label>
                    <button :disabled="creating" class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                        {{ creating ? 'Creating…' : 'Create course' }}
                    </button>
                </form>
            </section>

            <!-- Right: selected course contents + add content -->
            <section>
                <div v-if="!selected" class="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
                    Select a course to manage its content.
                </div>

                <div v-else>
                    <div class="rounded-xl border border-slate-200 bg-white">
                        <div class="border-b border-slate-200 px-5 py-4">
                            <h2 class="font-semibold text-slate-900">{{ selected.title }}</h2>
                            <p class="text-xs text-slate-500">{{ selected.contents.length }} content items</p>
                        </div>
                        <ul class="divide-y divide-slate-100">
                            <li v-for="item in selected.contents" :key="item.id" class="flex items-center justify-between px-5 py-3">
                                <div class="flex items-center gap-3">
                                    <span class="rounded-full px-2 py-0.5 text-xs font-semibold uppercase" :class="typeBadge[item.type]">{{ item.type }}</span>
                                    <span class="text-sm text-slate-800">{{ item.title }}</span>
                                </div>
                                <button class="text-xs text-red-500 hover:text-red-700" @click="deleteContent(item)">Delete</button>
                            </li>
                            <li v-if="!selected.contents.length" class="px-5 py-8 text-center text-sm text-slate-400">No content yet.</li>
                        </ul>
                    </div>

                    <form class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5" @submit.prevent="addContent">
                        <h3 class="font-semibold text-slate-900">Add content</h3>

                        <div class="grid grid-cols-2 gap-3">
                            <select v-model="content.type" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                <option v-for="t in CONTENT_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                            </select>
                            <input v-model="content.title" placeholder="Title" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                        <p v-if="contentErrors.title" class="text-xs text-red-600">{{ contentErrors.title[0] }}</p>

                        <!-- PDF upload to S3 (fills the URL field below) -->
                        <div v-if="content.type === 'pdf'" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                            <button
                                type="button"
                                class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                                :disabled="uploadingPdf"
                                @click="pickPdf"
                            >
                                {{ uploadingPdf ? 'Uploading…' : 'Upload PDF to S3' }}
                            </button>
                            <span v-if="content.payload.url" class="ml-2 text-xs text-emerald-600">Uploaded ✓</span>
                            <p v-if="pdfError" class="mt-1 text-xs text-red-600">{{ pdfError }}</p>
                            <input ref="pdfInput" type="file" accept="application/pdf" class="hidden" @change="onPdfSelected" />
                        </div>

                        <!-- Dynamic per-type fields -->
                        <div v-for="field in typeFields(content.type)" :key="field.key">
                            <label class="mb-1 block text-xs font-medium text-slate-600">{{ field.label }}</label>
                            <textarea
                                v-if="field.type === 'textarea'"
                                v-model="content.payload[field.key]"
                                rows="3"
                                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            ></textarea>
                            <input
                                v-else
                                v-model="content.payload[field.key]"
                                :type="field.type"
                                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            />
                            <p v-if="contentErrors[`payload.${field.key}`]" class="mt-1 text-xs text-red-600">
                                {{ contentErrors[`payload.${field.key}`][0] }}
                            </p>
                        </div>

                        <button :disabled="savingContent" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                            {{ savingContent ? 'Saving…' : 'Add content' }}
                        </button>
                    </form>
                </div>
            </section>
        </div>
    </div>
</template>
