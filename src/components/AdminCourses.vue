<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api, ApiError, CONTENT_TYPES } from '../api';
import AlertMessage from './AlertMessage.vue';
import ExamManager from './ExamManager.vue';

const courses = ref([]);
const loading = ref(true);
const error = ref(null);

// New-course form
const newCourse = reactive({ title: '', description: '', is_published: true });
const creating = ref(false);

// Selected course (full detail with contents)
const selected = ref(null);

// Step 3: the content item clicked in the list, loaded from its own endpoint.
const viewedId = ref(null);
const viewedContent = ref(null);
const viewLoading = ref(false);
const viewError = ref(null);

// Content form — doubles as the "add" and "edit" form. `editingId` is null when
// creating a new item, or the id of the content item being edited.
const blankContent = () => ({ type: 'note', title: '', payload: {} });
const content = reactive(blankContent());
const contentErrors = ref({});
const savingContent = ref(false);
const editingId = ref(null);

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
    editingId.value = null;
    viewedId.value = null;
    viewedContent.value = null;
    try {
        selected.value = (await api.course(id)).data;
    } catch (e) {
        error.value = 'Could not open course.';
    }
}

/** Step 3: load one content item's full data when its row is clicked. */
async function viewContent(item) {
    viewedId.value = item.id;
    viewedContent.value = null;
    viewError.value = null;
    viewLoading.value = true;
    try {
        viewedContent.value = (await api.showContent(selected.value.id, item.id)).data;
    } catch (e) {
        viewError.value = 'Could not load this content item.';
    } finally {
        viewLoading.value = false;
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

/** Load the clicked item's data into the form and switch to edit mode. */
async function startEdit(item) {
    error.value = null;
    contentErrors.value = {};
    pdfError.value = null;
    try {
        const data = (await api.showContent(selected.value.id, item.id)).data;
        editingId.value = data.id;
        Object.assign(content, {
            type: data.type,
            title: data.title,
            payload: { ...data.payload },
        });
    } catch (e) {
        error.value = 'Could not load this content item.';
    }
}

/** Leave edit mode and clear the form back to a blank "add" state. */
function cancelEdit() {
    editingId.value = null;
    Object.assign(content, blankContent());
    contentErrors.value = {};
    pdfError.value = null;
}

/** Create a new content item, or update the one being edited. */
async function saveContent() {
    savingContent.value = true;
    contentErrors.value = {};
    const payload = {
        type: content.type,
        title: content.title,
        payload: { ...content.payload },
    };
    try {
        if (editingId.value) {
            await api.updateContent(selected.value.id, editingId.value, payload);
        } else {
            await api.addContent(selected.value.id, payload);
        }
        editingId.value = null;
        Object.assign(content, blankContent());
        viewedId.value = null;
        viewedContent.value = null;
        await selectCourse(selected.value.id);
        await load();
    } catch (e) {
        if (e instanceof ApiError) {
            contentErrors.value = e.errors;
        } else {
            error.value = 'Could not save content.';
        }
    } finally {
        savingContent.value = false;
    }
}

async function deleteContent(item) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
        await api.deleteContent(selected.value.id, item.id);
        if (viewedId.value === item.id) {
            viewedId.value = null;
            viewedContent.value = null;
        }
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
                            <template v-for="item in selected.contents" :key="item.id">
                                <li class="flex items-center justify-between px-5 py-3" :class="viewedId === item.id ? 'bg-indigo-50/50' : ''">
                                    <button class="flex items-center gap-3 text-left" @click="viewContent(item)">
                                        <span class="rounded-full px-2 py-0.5 text-xs font-semibold uppercase" :class="typeBadge[item.type]">{{ item.type }}</span>
                                        <span class="text-sm text-slate-800 hover:text-indigo-600">{{ item.title }}</span>
                                    </button>
                                    <div class="flex items-center gap-3">
                                        <button class="text-xs font-medium text-indigo-600 hover:text-indigo-500" :class="editingId === item.id ? 'underline' : ''" @click="startEdit(item)">Edit</button>
                                        <button class="text-xs text-red-500 hover:text-red-700" @click="deleteContent(item)">Delete</button>
                                    </div>
                                </li>

                                <!-- Step 3: clicked content item's data, loaded from its own endpoint. -->
                                <li v-if="viewedId === item.id" class="bg-slate-50 px-5 py-3">
                                    <p v-if="viewLoading" class="text-xs text-slate-400">Loading…</p>
                                    <AlertMessage v-else-if="viewError" type="error" :message="viewError" />
                                    <template v-else-if="viewedContent">
                                        <dl class="space-y-1 text-xs">
                                            <div v-for="(value, key) in viewedContent.payload" :key="key" class="flex gap-2">
                                                <dt class="min-w-28 font-semibold uppercase tracking-wide text-slate-500">{{ key }}</dt>
                                                <dd class="break-all text-slate-800">{{ value }}</dd>
                                            </div>
                                            <p v-if="!Object.keys(viewedContent.payload || {}).length" class="text-slate-400">No extra data for this item.</p>
                                        </dl>

                                        <!-- Exam builder + analytics for exam content items -->
                                        <ExamManager
                                            v-if="viewedContent.type === 'exam'"
                                            :key="viewedContent.id"
                                            class="mt-3"
                                            :course-id="selected.id"
                                            :content-id="viewedContent.id"
                                        />
                                    </template>
                                </li>
                            </template>
                            <li v-if="!selected.contents.length" class="px-5 py-8 text-center text-sm text-slate-400">No content yet.</li>
                        </ul>
                    </div>

                    <form class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-5" @submit.prevent="saveContent">
                        <div class="flex items-center justify-between">
                            <h3 class="font-semibold text-slate-900">{{ editingId ? 'Edit content' : 'Add content' }}</h3>
                            <button v-if="editingId" type="button" class="text-xs text-slate-500 hover:text-slate-700" @click="cancelEdit">Cancel</button>
                        </div>

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
                            {{ savingContent ? 'Saving…' : (editingId ? 'Save changes' : 'Add content') }}
                        </button>
                    </form>
                </div>
            </section>
        </div>
    </div>
</template>
