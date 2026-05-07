// ════════════════════════════════════════════════════════════════
// api/register.js — Vercel Serverless Function
// POST /api/register
// Body (JSON): { name, staffId, credentialId, publicKey }
// Creates or updates a staff member's biometric credential.
// ════════════════════════════════════════════════════════════════

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connStr) {
    console.error('[api/register] No database connection string found.');
    return res.status(500).json({ error: 'Database not configured.' });
  }

  // Destructure and validate the request body
  const { name, staffId, credentialId, publicKey } = req.body ?? {};

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name is required.' });
  }
  if (!staffId || typeof staffId !== 'string' || staffId.trim() === '') {
    return res.status(400).json({ error: 'staffId is required.' });
  }
  if (!credentialId || typeof credentialId !== 'string') {
    return res.status(400).json({ error: 'credentialId is required.' });
  }

  try {
    const sql = neon(connStr);

    // Upsert: insert new row or update credential if staff_id already exists.
    // This allows re-registration (e.g. new device) without creating duplicates.
    const rows = await sql`
      INSERT INTO staff (name, staff_id, credential_id, public_key)
      VALUES (
        ${name.trim()},
        ${staffId.trim().toUpperCase()},
        ${credentialId},
        ${publicKey ?? null}
      )
      ON CONFLICT (staff_id)
      DO UPDATE SET
        name          = EXCLUDED.name,
        credential_id = EXCLUDED.credential_id,
        public_key    = EXCLUDED.public_key,
        registered_at = now()
      RETURNING id, name, staff_id, registered_at
    `;

    return res.status(200).json({ success: true, staff: rows[0] });
  } catch (err) {
    console.error('[api/register] Query error:', err);
    // Check for unique constraint violation on credential_id
    if (err.code === '23505') {
      return res.status(409).json({ error: 'This biometric credential is already registered to another staff member.' });
    }
    return res.status(500).json({ error: 'Database query failed.' });
  }
};
