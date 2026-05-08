/* ════════════════════════════════════════════════════════════════
   Envoys Stewards Attendance — app.js
   Main application logic.

   Sections:
   1. Constants
   2. API Client Helpers (fetch → /api/*)
   3. Utility Helpers
   4. Toast Notifications
   5. Loading Overlay
   6. Navigation / Tab Switching
   7. WebAuthn Helpers
   8. Register Flow
   9. Attendance Flow (Check-in / Check-out)
  10. Admin Dashboard
  11. Activity Feed
  12. Init
════════════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   1. CONSTANTS & CONFIG
────────────────────────────────────────────────────────────── */

// Hardcoded admin PIN for MVP.
// To change: update this constant and re-deploy.
const ADMIN_PIN = 'admin123';

// Relying Party info for WebAuthn.
const RP_NAME = 'Envoys Stewards Attendance';

/* ──────────────────────────────────────────────────────────────
   2. API CLIENT HELPERS
   Thin wrappers around fetch() for each /api/* Vercel Function.
   All calls are same-origin so no CORS config is needed.
────────────────────────────────────────────────────────────── */

/** GET /api/staff?staffId=X → single staff record or null */
async function apiGetStaff(staffId) {
  const res = await fetch(`/api/staff?staffId=${encodeURIComponent(staffId)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Database error looking up staff.');
  }
  return res.json();
}

/** GET /api/staff → array of all { staff_id, name } */
async function apiGetAllStaff() {
  const res = await fetch('/api/staff');
  if (!res.ok) return [];
  return res.json();
}

/** POST /api/register → upsert staff member with credential */
async function apiRegister(name, staffId, credentialId, publicKey) {
  const res = await fetch('/api/register', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, staffId, credentialId, publicKey }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Registration failed.');
  return body;
}

/** POST /api/attendance → insert check-in/out record */
async function apiRecordAttendance(staffId, staffName, action) {
  const res = await fetch('/api/attendance', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ staffId, staffName, action }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to record attendance.');
  return body; // { success: true, record: { timestamp, ... } }
}

/** GET /api/records?date=X&staffId=Y → filtered attendance rows */
async function apiGetRecords(date, staffId) {
  const params = new URLSearchParams();
  if (date)    params.set('date',    date);
  if (staffId) params.set('staffId', staffId);
  const url = `/api/records${params.toString() ? `?${params}` : ''}`;
  const res  = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to fetch records.');
  return body;
}

/* ──────────────────────────────────────────────────────────────
   3. UTILITY HELPERS
────────────────────────────────────────────────────────────── */

/**
 * Converts an ArrayBuffer (or TypedArray) to a base64url string.
 * Used to store WebAuthn credential IDs and keys in Supabase.
 */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Convert to base64, then to base64url (URL-safe characters)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Converts a base64 or base64url string back to a Uint8Array.
 * Used when building the allowCredentials list for WebAuthn get().
 */
function base64ToBuffer(base64) {
  // Restore base64url → base64
  const b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Formats an ISO timestamp to "09:32 AM".
 */
function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats an ISO timestamp to "Mon, 7 May 2026".
 */
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns today's date as a YYYY-MM-DD string (local timezone).
 */
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates and triggers a CSV download from an array of row objects.
 * @param {object[]} rows   — array of plain objects
 * @param {string}   filename — e.g. 'attendance_2026-05-07.csv'
 */
function exportToCSV(rows, filename) {
  if (!rows || rows.length === 0) {
    showToast('⚠️ No records to export.', 'warn');
    return;
  }

  // Build header row from the first object's keys
  const headers = ['Staff Name', 'Stewards ID', 'Action', 'Date', 'Time'];

  const csvLines = [
    headers.join(','),
    ...rows.map(r => {
      const time = formatTime(r.timestamp);
      const date = new Date(r.timestamp).toLocaleDateString('en-GB');
      // Escape any commas or quotes in text fields
      const escape = val => `"${String(val ?? '').replace(/"/g, '""')}"`;
      return [
        escape(r.staff_name),
        escape(r.staff_id),
        escape(r.action),
        escape(date),
        escape(time),
      ].join(',');
    }),
  ];

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ──────────────────────────────────────────────────────────────
   4. TOAST NOTIFICATIONS
────────────────────────────────────────────────────────────── */
const toastContainer = document.getElementById('toast-container');

/**
 * Shows a slide-in toast notification.
 * @param {string} message  — message text (may contain emoji)
 * @param {'success'|'error'|'warn'} type
 * @param {number} duration — ms before auto-dismiss (default 4500)
 */
function showToast(message, type = 'success', duration = 4500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.setAttribute('role', 'alert');

  // Dismiss on click
  toast.addEventListener('click', () => dismissToast(toast));

  toastContainer.prepend(toast);

  // Auto-dismiss
  const timer = setTimeout(() => dismissToast(toast), duration);
  toast._dismissTimer = timer;
}

function dismissToast(toast) {
  clearTimeout(toast._dismissTimer);
  toast.classList.add('toast-hide');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/* ──────────────────────────────────────────────────────────────
   5. LOADING OVERLAY
────────────────────────────────────────────────────────────── */
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText    = document.getElementById('loading-text');

function showLoading(text = 'Please wait…') {
  loadingText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

/* ──────────────────────────────────────────────────────────────
   6. NAVIGATION / TAB SWITCHING
────────────────────────────────────────────────────────────── */
const navBtns   = document.querySelectorAll('.nav-btn');
const allViews  = document.querySelectorAll('.view');

// Track admin auth state in memory (not persisted — refreshing locks it again)
let adminAuthenticated = false;

// Attendance lock — when true, check-in and check-out are disabled until admin unlocks
let attendanceLocked = false;

/**
 * Switches the visible view.
 * @param {'attendance'|'register'|'admin'} viewName
 */
function switchView(viewName) {
  // Hide all views
  allViews.forEach(v => v.classList.remove('active'));
  // Show target view
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  // Update nav active state
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // If switching to admin, load data if already authenticated
  if (viewName === 'admin' && adminAuthenticated) {
    loadAdminData();
  }

  // If switching to attendance, refresh activity feed
  if (viewName === 'attendance') {
    loadActivityFeed();
    populateStaffSuggestions();
  }
}

// Wire up nav buttons
navBtns.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ──────────────────────────────────────────────────────────────
   7. WEBAUTHN HELPERS
────────────────────────────────────────────────────────────── */

/**
 * Checks if WebAuthn is available in the current browser.
 */
function isWebAuthnSupported() {
  return !!(window.PublicKeyCredential &&
            navigator.credentials &&
            navigator.credentials.create &&
            navigator.credentials.get);
}

/**
 * Translates DOMException names from WebAuthn into user-friendly messages.
 */
function webAuthnErrorMessage(err) {
  if (!err) return '❌ An unknown error occurred.';

  switch (err.name) {
    case 'NotSupportedError':
      return '❌ Your device or browser does not support biometric authentication. Try Chrome on Android or Safari on iPhone.';
    case 'NotAllowedError':
      return '❌ Fingerprint scan cancelled or denied. Please try again.';
    case 'InvalidStateError':
      return '⚠️ This device is already registered for this staff member.';
    case 'SecurityError':
      return '❌ Security error — make sure the app is served over HTTPS.';
    case 'AbortError':
      return '❌ The biometric prompt was aborted. Please try again.';
    default:
      return `❌ Biometric error: ${err.message || err.name}`;
  }
}

/**
 * Registers a new WebAuthn credential (biometric).
 * Returns the credential object on success, or throws on failure.
 *
 * @param {string} staffId      — unique staff identifier
 * @param {string} displayName  — staff member's full name
 */
async function webAuthnRegister(staffId, displayName) {
  // Encode staffId as Uint8Array for the userId field
  const encoder = new TextEncoder();
  const userIdBytes = encoder.encode(staffId);

  // Generate a cryptographically random challenge
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyOptions = {
    // ── Relying Party ──
    rp: {
      id:   window.location.hostname,
      name: RP_NAME,
    },
    // ── User ──
    user: {
      id:          userIdBytes,
      name:        staffId,
      displayName: displayName,
    },
    // ── Challenge ──
    challenge: challenge,
    // ── Supported key algorithm: ES256 (ECDSA with SHA-256) ──
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },   // ES256
      { type: 'public-key', alg: -257 }, // RS256 (fallback for Windows Hello)
    ],
    // ── Timeout: 60 seconds ──
    timeout: 60000,
    // ── Attestation: none (no server-side verification needed) ──
    attestation: 'none',
    // ── Force platform (device) authenticator = fingerprint / Face ID ──
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification:        'required',
      residentKey:             'preferred',
    },
  };

  // Trigger the browser's biometric prompt
  const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
  return credential;
}

/**
 * Verifies a WebAuthn credential (biometric check-in/out).
 * Returns the assertion object on success, or throws on failure.
 *
 * @param {string} credentialIdBase64 — stored base64url credential ID
 */
async function webAuthnVerify(credentialIdBase64) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyOptions = {
    challenge: challenge,
    // Restrict to the specific credential registered for this staff member
    allowCredentials: [
      {
        type: 'public-key',
        id:   base64ToBuffer(credentialIdBase64),
        transports: ['internal'], // 'internal' = platform authenticator
      },
    ],
    userVerification: 'required',
    timeout:          60000,
    rpId:             window.location.hostname,
  };

  const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });
  return assertion;
}

/* ──────────────────────────────────────────────────────────────
   8. REGISTER FLOW
────────────────────────────────────────────────────────────── */
const regNameInput    = document.getElementById('reg-name');
const regStaffIdInput = document.getElementById('reg-staff-id');
const btnRegister     = document.getElementById('btn-register');

btnRegister.addEventListener('click', handleRegister);

async function handleRegister() {
  const name    = regNameInput.value.trim();
  const staffId = regStaffIdInput.value.trim().toUpperCase();

  // ── Validate inputs ──
  if (!name) {
    showToast('⚠️ Please enter the staff member\'s full name.', 'warn');
    regNameInput.focus();
    return;
  }
  if (!staffId) {
    showToast('⚠️ Please enter a Stewards ID.', 'warn');
    regStaffIdInput.focus();
    return;
  }

  // ── Check WebAuthn support ──
  if (!isWebAuthnSupported()) {
    showToast(
      '❌ Your device or browser does not support biometric authentication. Try Chrome on Android or Safari on iPhone.',
      'error',
      7000
    );
    return;
  }

  // ── Check if staff ID is already registered ──
  showLoading('Checking database…');
  try {
    const existing = await apiGetStaff(staffId);
    if (existing && existing.credential_id) {
      hideLoading();
      showToast(`⚠️ Stewards ID "${staffId}" is already registered with a biometric.`, 'warn', 6000);
      return;
    }
  } catch (err) {
    hideLoading();
    console.error('[Register] Staff lookup failed:', err);
    showToast('❌ Could not connect to the database. Check your internet connection.', 'error');
    return;
  }

  // ── Trigger biometric registration ──
  showLoading('Waiting for biometric scan…');
  let credential;
  try {
    credential = await webAuthnRegister(staffId, name);
  } catch (err) {
    hideLoading();
    console.error('[Register] WebAuthn error:', err);
    showToast(webAuthnErrorMessage(err), 'error', 7000);
    return;
  }

  // ── Save credential via /api/register ──
  showLoading('Saving registration…');
  try {
    const credentialIdBase64 = bufferToBase64(credential.rawId);
    const publicKeyBase64    = bufferToBase64(credential.response.attestationObject);

    await apiRegister(name, staffId, credentialIdBase64, publicKeyBase64);

    hideLoading();
    showToast(`✅ ${name} registered successfully!`, 'success', 5000);

    // Clear form
    regNameInput.value    = '';
    regStaffIdInput.value = '';

  } catch (err) {
    hideLoading();
    console.error('[Register] API error:', err);
    showToast(`❌ ${err.message || 'Could not save registration.'}`, 'error');
  }
}

/* ──────────────────────────────────────────────────────────────
   ATTENDANCE LOCK BANNER (referenced by both attendance & admin)
────────────────────────────────────────────────────────────── */
const attendanceLockBanner = document.getElementById('attendance-lock-banner');
const attendanceLockIcon   = document.getElementById('attendance-lock-icon');
const attendanceLockText   = document.getElementById('attendance-lock-text');

/* ──────────────────────────────────────────────────────────────
   9. ATTENDANCE FLOW (Check-in / Check-out)
────────────────────────────────────────────────────────────── */
const attendanceStaffIdInput = document.getElementById('attendance-staff-id');
const btnCheckIn             = document.getElementById('btn-check-in');
const btnCheckOut            = document.getElementById('btn-check-out');

// Wire up buttons — pass the action type
btnCheckIn.addEventListener('click',  () => handleAttendance('check-in'));
btnCheckOut.addEventListener('click', () => handleAttendance('check-out'));

// Allow Enter key on Staff ID field to trigger Check In
attendanceStaffIdInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAttendance('check-in');
});

/**
 * Main attendance handler.
 * @param {'check-in'|'check-out'} action
 */
async function handleAttendance(action) {
  const staffId = attendanceStaffIdInput.value.trim().toUpperCase();

  if (!staffId) {
    showToast('⚠️ Please enter your Stewards ID.', 'warn');
    attendanceStaffIdInput.focus();
    return;
  }

  // ── Check attendance lock ──
  if (attendanceLocked) {
    showToast('🔒 Attendance is currently locked by the admin.', 'warn', 5000);
    return;
  }

  if (!isWebAuthnSupported()) {
    showToast(
      '❌ Your device or browser does not support biometric authentication. Try Chrome on Android or Safari on iPhone.',
      'error',
      7000
    );
    return;
  }

  // ── Look up staff record ──
  showLoading('Looking up staff record…');
  let staffRecord;
  try {
    staffRecord = await apiGetStaff(staffId);

    if (!staffRecord) {
      hideLoading();
      showToast('❌ Stewards ID not found. Please register first.', 'error', 6000);
      return;
    }

    if (!staffRecord.credential_id) {
      hideLoading();
      showToast('❌ No biometric registered for this Stewards ID. Please register first.', 'error', 6000);
      return;
    }
  } catch (err) {
    hideLoading();
    console.error('[Attendance] Staff lookup error:', err);
    showToast('❌ Could not connect to the database. Check your internet connection.', 'error');
    return;
  }

  // ── Trigger biometric verification ──
  showLoading('Waiting for biometric scan…');
  try {
    await webAuthnVerify(staffRecord.credential_id);
  } catch (err) {
    hideLoading();
    console.error('[Attendance] WebAuthn error:', err);
    showToast(webAuthnErrorMessage(err), 'error', 7000);
    return;
  }

  // ── Biometric passed — record attendance via /api/attendance ──
  showLoading('Recording attendance…');
  try {
    const result = await apiRecordAttendance(staffRecord.staff_id, staffRecord.name, action);

    hideLoading();

    const timeStr = formatTime(result.record.timestamp);
    const verb    = action === 'check-in' ? 'checked in' : 'checked out';
    showToast(`✅ ${staffRecord.name} ${verb} at ${timeStr}`, 'success', 5000);

    attendanceStaffIdInput.value = '';
    loadActivityFeed();

  } catch (err) {
    hideLoading();
    console.error('[Attendance] API error:', err);
    showToast(`❌ ${err.message || 'Could not record attendance.'}`, 'error');
  }
}

/* ──────────────────────────────────────────────────────────────
   10. ADMIN DASHBOARD
────────────────────────────────────────────────────────────── */
const adminGate       = document.getElementById('admin-gate');
const adminDashboard  = document.getElementById('admin-dashboard');
const adminPinInput   = document.getElementById('admin-pin');
const btnAdminLogin   = document.getElementById('btn-admin-login');
const btnAdminLogout  = document.getElementById('btn-admin-logout');
const btnFilter       = document.getElementById('btn-filter');
const btnRefresh      = document.getElementById('btn-refresh');
const btnExportCSV          = document.getElementById('btn-export-csv');
const btnToggleAttendance   = document.getElementById('btn-toggle-attendance');
const filterDate            = document.getElementById('filter-date');
const filterStaff           = document.getElementById('filter-staff');
const attendanceTbody = document.getElementById('attendance-tbody');
const statCheckins    = document.getElementById('stat-checkins');
const statCheckouts   = document.getElementById('stat-checkouts');
const statUnique      = document.getElementById('stat-unique');

// Keep the last-loaded records in memory for CSV export
let lastLoadedRecords = [];

// ── PIN Login ──
btnAdminLogin.addEventListener('click', handleAdminLogin);
adminPinInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleAdminLogin();
});

function handleAdminLogin() {
  const pin = adminPinInput.value;
  if (pin === ADMIN_PIN) {
    adminAuthenticated = true;
    adminPinInput.value = '';
    adminGate.classList.add('hidden');
    adminDashboard.classList.remove('hidden');
    // Pre-fill today's date in the filter
    filterDate.value = todayISO();
    loadAdminData();
  } else {
    showToast('❌ Incorrect PIN. Please try again.', 'error');
    adminPinInput.value = '';
    adminPinInput.focus();
  }
}

// ── Logout / Lock ──
btnAdminLogout.addEventListener('click', () => {
  adminAuthenticated = false;
  adminDashboard.classList.add('hidden');
  adminGate.classList.remove('hidden');
  lastLoadedRecords = [];
});

// ── Filter / Refresh / Export ──
btnFilter.addEventListener('click',    loadAdminData);
btnRefresh.addEventListener('click',   loadAdminData);
btnExportCSV.addEventListener('click', () => {
  exportToCSV(lastLoadedRecords, `attendance_${todayISO()}.csv`);
});

// ── Attendance Lock Toggle ──
btnToggleAttendance.addEventListener('click', toggleAttendanceLock);

/**
 * Toggles the attendance lock on/off and updates the UI accordingly.
 */
function toggleAttendanceLock() {
  attendanceLocked = !attendanceLocked;
  updateAttendanceLockUI();
  const msg = attendanceLocked
    ? '🔒 Attendance is now LOCKED. Staff cannot check in or out.'
    : '🔓 Attendance is now OPEN. Staff can check in and out.';
  showToast(msg, attendanceLocked ? 'warn' : 'success', 5000);
}

/**
 * Syncs the attendance banner (attendance view) and the admin toggle button
 * to match the current `attendanceLocked` state.
 */
function updateAttendanceLockUI() {
  if (attendanceLocked) {
    attendanceLockBanner.className = 'attendance-lock-banner attendance-lock-banner--locked';
    attendanceLockIcon.textContent  = '🔴';
    attendanceLockText.innerHTML    = 'Attendance is <strong>Locked</strong> — check-in and check-out are disabled.';
    btnToggleAttendance.className   = 'btn btn-success';
    btnToggleAttendance.textContent = '🔓 Open Attendance';
  } else {
    attendanceLockBanner.className = 'attendance-lock-banner attendance-lock-banner--open';
    attendanceLockIcon.textContent  = '🟢';
    attendanceLockText.innerHTML    = 'Attendance is <strong>Open</strong>';
    btnToggleAttendance.className   = 'btn btn-warning';
    btnToggleAttendance.textContent = '🔒 Lock Attendance';
  }
}

async function loadAdminData() {
  if (!adminAuthenticated) return;

  showLoading('Loading attendance records…');
  try {
    const dateVal  = filterDate.value || null;
    const staffVal = filterStaff.value.trim().toUpperCase() || null;

    const data = await apiGetRecords(dateVal, staffVal);

    lastLoadedRecords = data;
    hideLoading();

    renderAttendanceTable(data);
    updateSummaryCards(data, dateVal);

  } catch (err) {
    hideLoading();
    console.error('[Admin] Load error:', err);
    showToast('❌ Could not connect to the database. Check your internet connection.', 'error');
  }
}

/**
 * Renders attendance rows into the table.
 */
function renderAttendanceTable(records) {
  if (!records.length) {
    attendanceTbody.innerHTML = '<tr><td colspan="5" class="empty-state">No records found.</td></tr>';
    return;
  }

  attendanceTbody.innerHTML = records.map(r => {
    const badgeClass = r.action === 'check-in' ? 'table-badge--in' : 'table-badge--out';
    const label      = r.action === 'check-in' ? 'Check In' : 'Check Out';
    return `
      <tr>
        <td>${escapeHtml(r.staff_name)}</td>
        <td>${escapeHtml(r.staff_id)}</td>
        <td><span class="table-badge ${badgeClass}">${label}</span></td>
        <td>${new Date(r.timestamp).toLocaleDateString('en-GB')}</td>
        <td>${formatTime(r.timestamp)}</td>
      </tr>
    `.trim();
  }).join('');
}

/**
 * Updates the three summary stat cards.
 */
function updateSummaryCards(records, dateFilter) {
  // When a date filter is applied, compute stats for that day;
  // otherwise compute from the loaded records.
  const todayRecords = dateFilter
    ? records.filter(r => (r.date || '').toString().slice(0, 10) === dateFilter)
    : records;

  const checkins  = todayRecords.filter(r => r.action === 'check-in').length;
  const checkouts = todayRecords.filter(r => r.action === 'check-out').length;
  const unique    = new Set(todayRecords.map(r => r.staff_id)).size;

  statCheckins.textContent  = checkins;
  statCheckouts.textContent = checkouts;
  statUnique.textContent    = unique;
}

/**
 * Minimal HTML escaping to prevent XSS when inserting text into innerHTML.
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ──────────────────────────────────────────────────────────────
   11. ACTIVITY FEED (Today's recent records)
────────────────────────────────────────────────────────────── */
const activityFeed = document.getElementById('activity-feed');

async function loadActivityFeed() {
  try {
    const data = await apiGetRecords(todayISO(), null);
    renderActivityFeed((data || []).slice(0, 20));
  } catch (err) {
    console.warn('[ActivityFeed] Could not load feed:', err);
  }
}

/**
 * Renders the activity feed items.
 */
function renderActivityFeed(records) {
  if (!records.length) {
    activityFeed.innerHTML = '<p class="empty-state">No activity yet today.</p>';
    return;
  }

  activityFeed.innerHTML = records.map(r => {
    const badgeClass = r.action === 'check-in' ? 'activity-badge--in' : 'activity-badge--out';
    const label      = r.action === 'check-in' ? 'In' : 'Out';
    return `
      <div class="activity-item">
        <span class="activity-badge ${badgeClass}">${label}</span>
        <div class="activity-info">
          <div class="activity-name">${escapeHtml(r.staff_name)}</div>
          <div class="activity-meta">${escapeHtml(r.staff_id)} · ${formatTime(r.timestamp)}</div>
        </div>
      </div>
    `.trim();
  }).join('');
}

/* ──────────────────────────────────────────────────────────────
   STAFF SUGGESTIONS (datalist auto-complete)
────────────────────────────────────────────────────────────── */
const staffSuggestions = document.getElementById('staff-suggestions');

async function populateStaffSuggestions() {
  try {
    const data = await apiGetAllStaff();
    if (!data || !data.length) return;
    staffSuggestions.innerHTML = data.map(s =>
      `<option value="${escapeHtml(s.staff_id)}">${escapeHtml(s.name)}</option>`
    ).join('');
    attendanceStaffIdInput.setAttribute('list', 'staff-suggestions');
  } catch (err) {
    console.warn('[Suggestions] Could not load staff list:', err);
  }
}

/* ──────────────────────────────────────────────────────────────
   12. INIT
────────────────────────────────────────────────────────────── */

/**
 * Application entry point — called when the DOM is ready.
 */
function init() {
  // Set default active view to Attendance
  switchView('attendance');

  // Load initial data
  loadActivityFeed();
  populateStaffSuggestions();

  // Warn if WebAuthn is not supported
  if (!isWebAuthnSupported()) {
    showToast(
      '⚠️ Biometric authentication is not supported in this browser. Please use Chrome on Android or Safari on iOS 14+.',
      'warn',
      8000
    );
  }

  // Warn if not on HTTPS (WebAuthn requirement)
  if (
    window.location.protocol !== 'https:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    showToast(
      '⚠️ WebAuthn requires HTTPS. Deploy to Vercel for biometric features to work.',
      'warn',
      10000
    );
  }

  console.log('[Envoys Stewards Attendance] App initialised (Neon + Vercel backend).');
}

// Start the app once the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
