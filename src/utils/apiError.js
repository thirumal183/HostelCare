// ===========================================================
// ApiError — typed error the central errorHandler understands
// ===========================================================
// The errorHandler middleware (src/middleware/errorHandler.js)
// reads `err.statusCode` and `err.message` to build the JSON
// response. Throwing an ApiError is the recommended way to
// surface a non-500 error from a service or controller.
// ===========================================================

class ApiError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

module.exports = ApiError;
