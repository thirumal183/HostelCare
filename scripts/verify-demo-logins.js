require('dotenv').config();
const authService = require('../src/services/authService');
const pool = require('../src/config/db');

(async () => {
    // 1. Warden Login
    const wardenRes = await authService.loginUser({
        email: 'warden.bh3@hostelcare.test',
        password: 'Warden@123'
    });
    console.log('[TEST 1] Warden login successful:', wardenRes.user.email, 'Role:', wardenRes.user.role, 'Token exists:', !!wardenRes.token);

    // 2. Worker Login
    const workerRes = await authService.loginUser({
        email: 'worker.bh3.electrical@hostelcare.test',
        password: 'Worker@123'
    });
    console.log('[TEST 2] Worker login successful:', workerRes.user.email, 'Role:', workerRes.user.role, 'Token exists:', !!workerRes.token);

    // 3. Student Login
    const studentRes = await authService.loginUser({
        email: 'student.bh3.thiru@hostelcare.test',
        password: 'Student@123'
    });
    console.log('[TEST 3] Student login successful:', studentRes.user.email, 'Room:', studentRes.user.room_number, 'Hostel:', studentRes.user.hostel_name, 'Token exists:', !!studentRes.token);

    // 4. Invalid Password
    try {
        await authService.loginUser({
            email: 'warden.bh3@hostelcare.test',
            password: 'WrongPassword!'
        });
        console.error('[TEST 4] FAILED: Should have rejected invalid password');
    } catch (err) {
        console.log('[TEST 4] Correctly rejected invalid password:', err.message, 'Status:', err.statusCode);
    }

    // 5. Test Student Activation for student.bh4.aarav
    // Ensure it's unactivated first
    await pool.query('UPDATE students SET is_activated = FALSE WHERE user_id = 2');
    await pool.query('UPDATE users SET password_hash = NULL, is_active = FALSE WHERE user_id = 2');
    const actRes = await authService.activateStudent({
        email: 'student.bh4.aarav@hostelcare.test',
        hostel: 'BH-4',
        room: 'B-101',
        activationKey: 'HOSTELCARE2026',
        password: 'Student@123'
    });
    console.log('[TEST 5] Student activation successful:', actRes.email, 'Hostel:', actRes.hostel, 'Room:', actRes.room);

    await pool.end();
    console.log('\nAll auth tests passed successfully!');
})().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
