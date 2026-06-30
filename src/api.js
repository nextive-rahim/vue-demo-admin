// Base URL of the Laravel Demo API. Defaults to a relative path so the Vite dev
// proxy (see vite.config.js) forwards it to the backend without CORS. Override
// with VITE_API_URL for a deployed build.
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'admin_token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Error thrown for any non-2xx API response. Carries the HTTP status and the
 * Laravel validation `errors` bag so components can surface field-level messages.
 */
export class ApiError extends Error {
    constructor(status, data) {
        super(data?.message || 'Something went wrong.');
        this.status = status;
        this.errors = data?.errors || {};
        this.data = data || {};
    }

    firstError(field) {
        return this.errors?.[field]?.[0] ?? null;
    }
}

async function request(method, path, body = null) {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    let data = {};
    try {
        data = await response.json();
    } catch {
        // Empty or non-JSON body — leave data as {}.
    }

    if (!response.ok) {
        throw new ApiError(response.status, data);
    }

    return data;
}

/**
 * POST a multipart/form-data body (file upload). The browser sets the
 * Content-Type (with boundary) automatically, so we must not set it here.
 */
async function upload(path, formData) {
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: formData });

    let data = {};
    try {
        data = await response.json();
    } catch {
        // Empty or non-JSON body.
    }

    if (!response.ok) {
        throw new ApiError(response.status, data);
    }

    return data;
}

export const api = {
    login: (payload) => request('POST', '/auth/login', payload),
    logout: () => request('POST', '/auth/logout'),
    me: () => request('GET', '/auth/user'),
    users: () => request('GET', '/admin/users'),
    stats: () => request('GET', '/admin/stats'),

    // Courses
    courses: () => request('GET', '/admin/courses'),
    course: (id) => request('GET', `/admin/courses/${id}`),
    createCourse: (payload) => request('POST', '/admin/courses', payload),
    updateCourse: (id, payload) => request('PUT', `/admin/courses/${id}`, payload),
    deleteCourse: (id) => request('DELETE', `/admin/courses/${id}`),

    // PDF upload (multipart) to S3 — returns { path, url }
    uploadPdf: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return upload('/admin/uploads/pdf', fd);
    },

    // Course content items
    showContent: (courseId, contentId) => request('GET', `/admin/courses/${courseId}/contents/${contentId}`),
    addContent: (courseId, payload) => request('POST', `/admin/courses/${courseId}/contents`, payload),
    updateContent: (courseId, contentId, payload) => request('PUT', `/admin/courses/${courseId}/contents/${contentId}`, payload),
    deleteContent: (courseId, contentId) => request('DELETE', `/admin/courses/${courseId}/contents/${contentId}`),

    // MCQ store — categories
    categories: () => request('GET', '/admin/categories'),
    category: (id) => request('GET', `/admin/categories/${id}`),
    createCategory: (payload) => request('POST', '/admin/categories', payload),
    updateCategory: (id, payload) => request('PUT', `/admin/categories/${id}`, payload),
    deleteCategory: (id) => request('DELETE', `/admin/categories/${id}`),

    // MCQ store — subcategories
    subcategories: (categoryId = null) => request('GET', `/admin/subcategories${query({ category_id: categoryId })}`),
    createSubcategory: (payload) => request('POST', '/admin/subcategories', payload),
    updateSubcategory: (id, payload) => request('PUT', `/admin/subcategories/${id}`, payload),
    deleteSubcategory: (id) => request('DELETE', `/admin/subcategories/${id}`),

    // MCQ store — questions
    questions: (filters = {}) => request('GET', `/admin/questions${query(filters)}`),
    question: (id) => request('GET', `/admin/questions/${id}`),
    createQuestion: (payload) => request('POST', '/admin/questions', payload),
    updateQuestion: (id, payload) => request('PUT', `/admin/questions/${id}`, payload),
    deleteQuestion: (id) => request('DELETE', `/admin/questions/${id}`),

    // Exam builder — attach store questions to an exam content item
    examQuestions: (courseId, contentId) => request('GET', `/admin/courses/${courseId}/contents/${contentId}/questions`),
    attachExamQuestions: (courseId, contentId, questionIds) => request('POST', `/admin/courses/${courseId}/contents/${contentId}/questions`, { question_ids: questionIds }),
    detachExamQuestion: (courseId, contentId, questionId) => request('DELETE', `/admin/courses/${courseId}/contents/${contentId}/questions/${questionId}`),

    // Exam analytics
    examAttempts: (courseId, contentId) => request('GET', `/admin/courses/${courseId}/contents/${contentId}/attempts`),
    examAnalysis: (courseId, contentId) => request('GET', `/admin/courses/${courseId}/contents/${contentId}/analysis`),
};

/** Build a `?a=1&b=2` query string from a params object, skipping null/undefined/empty values. */
function query(params = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') {
            search.append(key, value);
        }
    }
    const string = search.toString();
    return string ? `?${string}` : '';
}

// The six content types and the payload fields each one needs.
export const CONTENT_TYPES = [
    { value: 'note', label: 'Note', fields: [{ key: 'body', label: 'Body', type: 'textarea' }] },
    { value: 'pdf', label: 'PDF', fields: [{ key: 'url', label: 'PDF URL', type: 'url' }] },
    { value: 'video', label: 'Video', fields: [{ key: 'url', label: 'Video URL', type: 'url' }, { key: 'provider', label: 'Provider', type: 'text' }] },
    { value: 'live', label: 'Live', fields: [{ key: 'url', label: 'Join URL', type: 'url' }, { key: 'scheduled_at', label: 'Scheduled at', type: 'datetime-local' }] },
    { value: 'link', label: 'Link', fields: [{ key: 'url', label: 'URL', type: 'url' }] },
    { value: 'exam', label: 'Exam', fields: [{ key: 'duration_minutes', label: 'Duration (min)', type: 'number' }, { key: 'start_time', label: 'Start time', type: 'datetime-local' }, { key: 'end_time', label: 'End time', type: 'datetime-local' }, { key: 'result_publish_time', label: 'Result publish time', type: 'datetime-local' }] },
];
