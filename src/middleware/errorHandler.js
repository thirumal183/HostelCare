// ===========================================================
// Centralized error handler
// ===========================================================
// Express recognizes this as an error handler because of its
// 4-argument signature: (err, req, res, next).
//
// In production we do NOT leak stack traces or internal
// error details to the client. The full error is logged
// server-side for debugging.
// ===========================================================

exports.errorHandler = (err, req, res, next) => {
    // Server-side log so the developer can debug.
    console.error('[errorHandler]', err);

    const statusCode = err.statusCode && Number.isInteger(err.statusCode)
        ? err.statusCode
        : 500;

    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 ? 'Internal server error' : err.message,
    });
};
