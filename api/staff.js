// ════════════════════════════════════════════════════════════════
// api/staff.js — Vercel Serverless Function
// GET /api/staff             → returns array of all staff (id + name)
// GET /api/staff?staffId=X   → returns single staff record or null
// ════════════════════════════════════════════════════════════════

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the environment variable is configured
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error('[api/staff] No database connection string found.');
    return res.status(500).json({ error: 'Database not configured.' });
  }

  try {
    const sql = neon(connStr);
    const { staffId } = req.query;

    if (staffId) {
      // Look up a single staff member by their staff_id
      const rows = await sql`
        SELECT id, name, staff_id, credential_id, registered_at
        FROM staff
        WHERE staff_id = ${staffId}
        LIMIT 1
      `;
      // Return the first row or null (same behaviour as Supabase maybeSingle)
      return res.status(200).json(rows[0] ?? null);
    } else {
      // Return all staff (used for the auto-suggest datalist)
      const rows = await sql`
        SELECT staff_id, name
        FROM staff
        ORDER BY name ASC
      `;
      return res.status(200).json(rows);
    }
  } catch (err) {
    console.error('[api/staff] Query error:', err);
    return res.status(500).json({ error: 'Database query failed.' });
  }
};
