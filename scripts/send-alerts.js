/**
 * send-alerts.js
 * ------------------------------------------------------------
 * JSONBin.io-dakı avtomobil datasını oxuyur, index.html-dəki
 * "Poti & Etibarnamə Nəzarəti" panelinin eyni tarix/status
 * hesablama məntiqi ilə YALNIZ bu 2 şərtdən birinə uyğun
 * avtomobilləri süzgəcdən keçirir:
 *   1) Artıq Poti-yə çatmış avtomobillər (gün sayı <= 0)
 *   2) Yaxın 15-20 gün ərzində Poti-yə çatması gözlənilən avtomobillər
 * Uyğun avtomobil yoxdursa, mail ümumiyyətlə göndərilmir.
 *
 * Bu skript Node.js 18+ ilə işləyir (built-in fetch istifadə edir),
 * əlavə npm paketi tələb olunmur.
 * ------------------------------------------------------------
 */

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || 'Carzone Alerts <onboarding@resend.dev>';

// Poti-yə çatmağa neçə gün qalanda "tezliklə" hesab edilsin (tətbiqdəki SOON_20 ilə eyni)
const SOON_DAYS_THRESHOLD = 20;

function requireEnv(name, value) {
    if (!value) {
        console.error(`XƏTA: "${name}" mühit dəyişəni (secret) təyin edilməyib.`);
        process.exit(1);
    }
}

requireEnv('JSONBIN_BIN_ID', JSONBIN_BIN_ID);
requireEnv('JSONBIN_MASTER_KEY', JSONBIN_MASTER_KEY);
requireEnv('RESEND_API_KEY', RESEND_API_KEY);
requireEnv('ALERT_EMAIL_TO', ALERT_EMAIL_TO);

/* ---------- Tətbiqdəki tarix köməkçi funksiyalarının eyni məntiqi ---------- */

function parseAppDate(str) {
    if (!str) return null;
    let m = String(str).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
        const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
        const dt = new Date(y, mo - 1, d);
        return isNaN(dt.getTime()) ? null : dt;
    }
    m = String(str).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
        const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
        const dt = new Date(y, mo - 1, d);
        return isNaN(dt.getTime()) ? null : dt;
    }
    return null;
}

function getDaysToPoti(potiDateStr) {
    const potiDate = parseAppDate(potiDateStr);
    if (!potiDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    potiDate.setHours(0, 0, 0, 0);
    const diffTime = potiDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/* ---------------------------- JSONBin-dən oxu ---------------------------- */

async function fetchCarsFromCloud() {
    const url = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-Master-Key': JSONBIN_MASTER_KEY }
    });

    if (!res.ok) {
        throw new Error(`JSONBin sorğusu uğursuz oldu: ${res.status} ${res.statusText}`);
    }

    const result = await res.json();
    const cars = result && result.record ? result.record : result;

    if (!Array.isArray(cars)) {
        throw new Error('JSONBin-dən gələn data massiv formatında deyil.');
    }
    return cars;
}

/* ------------------------------ Analiz məntiqi ---------------------------- */
/* index.html-dəki "Poti & Etibarnamə Nəzarəti" panelinin eyni məntiqi:
   - c.poti tarixi olmalıdır
   - c.status "Bakıdadır" olmamalıdır (artıq Bakıya çatıbsa, bildirişə ehtiyac yoxdur)
   - Ya artıq Poti-yə çatıb (days <= 0), ya da 15-20 gün ərzində çatacaq (0 < days <= 20) */

function getPotiAlerts(cars) {
    const potiCars = cars.filter(c => c.poti && c.status !== 'Bakıdadır');

    const alerts = potiCars
        .map(c => ({ car: c, days: getDaysToPoti(c.poti) }))
        .filter(({ days }) => days !== null && days <= SOON_DAYS_THRESHOLD);

    alerts.sort((a, b) => a.days - b.days);
    return alerts;
}

/* ------------------------------- HTML şablonu ------------------------------ */

function carLabel(c) {
    const parts = [c.brand, c.model].filter(Boolean).join(' ');
    return parts || 'Naməlum avtomobil';
}

function daysLabel(days) {
    if (days < 0) return `${Math.abs(days)} gün öncə Poti-yə çatıb`;
    if (days === 0) return 'Bu gün Poti-yə çatır';
    return `${days} gün sonra Poti-yə çatacaq`;
}

function renderCarRow({ car, days }) {
    const urgency = days <= 0 ? '#dc2626' : (days <= 7 ? '#d97706' : '#4f46e5');
    return `
        <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${carLabel(car)}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#475569;font-family:monospace;">${car.vin || '-'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">${car.poti || '-'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:${urgency};font-weight:700;">${daysLabel(days)}</td>
        </tr>`;
}

function buildEmailHtml(alerts) {
    const todayStr = new Date().toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const rows = alerts.map(renderCarRow).join('');

    return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
            <div style="background:#dc2626;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:800;">🚢 CARZON — Poti Bildiriş Hesabatı</span>
                <div style="color:#fecaca;font-size:12px;margin-top:4px;">${todayStr}</div>
            </div>
            <div style="padding:24px 28px;">
                <div style="margin-bottom:16px;">
                    <span style="font-size:15px;font-weight:800;color:#4f46e5;">🚢 Poti-yə Çatmış / Çatmaq Üzrə Olan Avtomobillər (${alerts.length})</span>
                </div>
                <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="text-align:left;padding:10px 14px;color:#64748b;font-size:11px;text-transform:uppercase;">Avtomobil</th>
                            <th style="text-align:left;padding:10px 14px;color:#64748b;font-size:11px;text-transform:uppercase;">VIN</th>
                            <th style="text-align:left;padding:10px 14px;color:#64748b;font-size:11px;text-transform:uppercase;">Poti Tarixi</th>
                            <th style="text-align:left;padding:10px 14px;color:#64748b;font-size:11px;text-transform:uppercase;">Vəziyyət</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <p style="color:#94a3b8;font-size:11px;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:14px;">
                    Bu bildiriş avtomatik olaraq GitHub Actions vasitəsilə göndərilib. Tam siyahını görmək üçün tətbiqə daxil olun.
                </p>
            </div>
        </div>
    </div>`;
}

/* --------------------------------- Resend --------------------------------- */

async function sendEmail(html, subject) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: ALERT_EMAIL_FROM,
            to: [ALERT_EMAIL_TO],
            subject,
            html
        })
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(`Resend e-poçt göndərilmədi: ${res.status} ${JSON.stringify(body)}`);
    }

    return body;
}

/* ---------------------------------- Əsas ---------------------------------- */

async function main() {
    console.log('JSONBin-dən data çəkilir...');
    const cars = await fetchCarsFromCloud();
    console.log(`${cars.length} avtomobil oxundu.`);

    const alerts = getPotiAlerts(cars);
    console.log(`Poti bildirişi tələb edən avtomobil sayı: ${alerts.length}`);

    if (alerts.length === 0) {
        console.log('Heç bir aktiv Poti bildirişi yoxdur — e-poçt göndərilmir.');
        return;
    }

    const html = buildEmailHtml(alerts);
    const subject = `⚠️ Poti Bildirişi: ${alerts.length} avtomobil diqqət tələb edir`;

    console.log('E-poçt göndərilir...');
    await sendEmail(html, subject);
    console.log('E-poçt uğurla göndərildi!');
}

main().catch(err => {
    console.error('Skript xəta ilə dayandı:', err.message);
    process.exit(1);
});
