// ===========================================================
// Validation helpers
// ===========================================================
// Pure functions used by the auth layer to validate incoming
// request bodies. Return `null` for valid input, or a short
// human-readable error message for invalid input.
// Keep them dependency-free so they can be unit-tested easily.
// ===========================================================

// Basic RFC-5322-ish email shape check. Good enough for a V1
// backend; full RFC compliance is not the goal here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function validateEmail(value) {
    if (!isNonEmptyString(value)) return 'email is required';
    if (!EMAIL_RE.test(value.trim())) return 'email is not valid';
    return null;
}

function validatePassword(value) {
    if (!isNonEmptyString(value)) return 'password is required';
    if (value.length < 8) return 'password must be at least 8 characters';
    if (value.length > 128) return 'password is too long';
    return null;
}

function validateActivationKey(value) {
    if (!isNonEmptyString(value)) return 'activationKey is required';
    if (value.length > 100) return 'activationKey is too long';
    return null;
}

function validateHostelName(value) {
    if (!isNonEmptyString(value)) return 'hostel is required';
    if (value.length > 100) return 'hostel is too long';
    return null;
}

function validateRoomNumber(value) {
    if (!isNonEmptyString(value)) return 'room is required';
    if (value.length > 20) return 'room is too long';
    return null;
}

// Phase 4A: complaint creation validators. Length caps match
// the spec: title max 150, description max 2000.
const COMPLAINT_TITLE_MAX = 150;
const COMPLAINT_DESCRIPTION_MAX = 2000;

function validateComplaintTitle(value) {
    if (typeof value !== 'string') return 'title is required';
    const trimmed = value.trim();
    if (trimmed.length === 0) return 'title is required';
    if (trimmed.length > COMPLAINT_TITLE_MAX) {
        return `title must be at most ${COMPLAINT_TITLE_MAX} characters`;
    }
    return null;
}

function validateComplaintDescription(value) {
    if (typeof value !== 'string') return 'description is required';
    const trimmed = value.trim();
    if (trimmed.length === 0) return 'description is required';
    if (trimmed.length > COMPLAINT_DESCRIPTION_MAX) {
        return `description must be at most ${COMPLAINT_DESCRIPTION_MAX} characters`;
    }
    return null;
}

function validateComplaintCategory(value) {
    if (typeof value !== 'string') return 'category is required';
    const trimmed = value.trim();
    if (trimmed.length === 0) return 'category is required';
    if (trimmed.length > 50) return 'category is too long';
    return null;
}

module.exports = {
    validateEmail,
    validatePassword,
    validateActivationKey,
    validateHostelName,
    validateRoomNumber,
    validateComplaintTitle,
    validateComplaintDescription,
    validateComplaintCategory,
};
