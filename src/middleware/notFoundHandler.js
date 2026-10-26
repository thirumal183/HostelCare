// ===========================================================
// Not-Found handler
// ===========================================================
// Catches any request that didn't match a defined route and
// returns a consistent JSON 404 response.
// ===========================================================

exports.notFoundHandler = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
};
