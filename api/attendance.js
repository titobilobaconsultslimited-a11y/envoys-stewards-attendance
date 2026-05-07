// ════════════════════════════════════════════════════════════════
// api/attendance.js — Vercel Serverless Function
// POST /api/attendance
// Body (JSON): { staffId, staffName, action }
// Inserts a check-in or check-out record.
// The timestamp is set server-side (NOW()) for accuracy.
// ════════════════════════════════════════════════════════════════

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error('[api/attendance] No database connection string found.');
    return res.status(500).json({ error: 'Database not configured.' });
  }

  // Destructure and validate
  const { staffId, staffName, action } = req.body ?? {};

  if (!staffId || typeof staffId !== 'string' || staffId.trim() === '') {
    return res.status(400).json({ error: 'staffId is required.' });
  }
  if (!staffName || typeof staffName !== 'string' || staffName.trim() === '') {
    return res.status(400).json({ error: 'staffName is required.' });
  }
  if (action !== 'check-in' && action !== 'check-out') {
    return res.status(400).json({ error: 'action must be "check-in" or "check-out".' });
  }

  try {
    const sql = neon(connStr);

    // Insert the attendance record.
    // timestamp and date are set by the database server for accuracy.
    const rows = await sql`
      INSERT INTO attendance (staff_id, staff_name, action, timestamp, date)
      VALUES (
        ${staffId.trim().toUpperCase()},
        ${staffName.trim()},
        ${action},
        NOW(),
        CURRENT_DATE
      )
      RETURNING id, staff_id, staff_name, action, timestamp, date
    `;

    return res.status(200).json({ success: true, record: rows[0] });
  } catch (err) {
    console.error('[api/attendance] Query error:', err);
    // Foreign key violation — staff_id not in staff table
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Staff ID not found. Please register first.' });
    }
    return res.status(500).json({ error: 'Database query failed.' });
  }
};
