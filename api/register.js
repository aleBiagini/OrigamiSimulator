import prisma from '../lib/prisma.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            guestIds,
            attending,
            dietaryPreference,
            dietaryNotes
        } = req.body;

        // Validate required fields
        if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0 || attending === undefined) {
            return res.status(400).json({ error: 'Campi obbligatori mancanti' });
        }

        // Get all guests
        const guests = await prisma.guest.findMany({
            where: { id: { in: guestIds } },
            include: { registration: true }
        });

        if (guests.length === 0) {
            return res.status(404).json({ error: 'Ospiti non trovati' });
        }

        // Register each guest
        const guestNames = [];
        for (const guest of guests) {
            guestNames.push(guest.name);
            
            if (guest.registration) {
                // Update existing registration
                await prisma.registration.update({
                    where: { id: guest.registration.id },
                    data: {
                        attending: attending,
                        dietaryPreference: attending ? (dietaryPreference || 'nessuna') : 'nessuna',
                        dietaryNotes: attending ? (dietaryNotes || null) : null
                    }
                });
            } else {
                // Create new registration
                await prisma.registration.create({
                    data: {
                        guestId: guest.id,
                        attending: attending,
                        dietaryPreference: attending ? (dietaryPreference || 'nessuna') : 'nessuna',
                        dietaryNotes: attending ? (dietaryNotes || null) : null
                    }
                });
            }

            // Send confirmation email to guest (if they have email)
            if (guest.email) {
                await sendEmail({
                    to: [{ email: guest.email, name: guest.name }],
                    subject: attending 
                        ? 'Conferma Partecipazione - Matrimonio Alessandro e Simona'
                        : 'Risposta Ricevuta - Matrimonio Alessandro e Simona',
                    htmlContent: buildConfirmationEmail(guest.name, attending)
                });
            }
        }

        // Send notification email to the couple
        await sendEmail({
            to: [
                { email: 'a.biagini15@gmail.com', name: 'Alessandro' },
                { email: 'simona.fiorucci92@gmail.com', name: 'Simona' }
            ],
            subject: attending 
                ? `Nuova Conferma: ${guestNames.join(', ')}`
                : `Non Partecipa: ${guestNames.join(', ')}`,
            htmlContent: buildNotificationEmail({
                guestNames,
                attending,
                dietaryPreference,
                dietaryNotes
            })
        });

        return res.status(200).json({ 
            success: true, 
            message: attending 
                ? 'Registrazione completata con successo!' 
                : 'Risposta registrata. Ci dispiace che non potrai essere presente.'
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ error: 'Errore durante la registrazione' });
    }
}

async function sendEmail({ to, subject, htmlContent }) {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    
    if (!BREVO_API_KEY) {
        console.error('BREVO_API_KEY not configured');
        return;
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { email: 'info@abiagini.it', name: 'Alessandro e Simona' },
                to,
                subject,
                htmlContent
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Brevo API error:', error);
        }
    } catch (error) {
        console.error('Email send error:', error);
    }
}

function buildConfirmationEmail(guestName, attending) {
    if (!attending) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Georgia, serif; background: #f9f9f9; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #8b7355; text-align: center; font-size: 28px; }
        p { color: #333; line-height: 1.8; font-size: 16px; }
        .footer { text-align: center; margin-top: 30px; color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Risposta Ricevuta</h1>
        <p>Caro/a ${guestName},</p>
        <p>Abbiamo ricevuto la tua risposta. Ci dispiace molto che non potrai essere presente al nostro matrimonio.</p>
        <p>Ti penseremo comunque in questo giorno speciale!</p>
        <p><strong>Con affetto,<br>Simona e Alessandro</strong></p>
        <div class="footer">
            <p>Per qualsiasi domanda, rispondi a questa email.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Georgia, serif; background: #f9f9f9; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #8b7355; text-align: center; font-size: 28px; }
        p { color: #333; line-height: 1.8; font-size: 16px; }
        .footer { text-align: center; margin-top: 30px; color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Grazie per la conferma!</h1>
        <p>Caro/a ${guestName},</p>
        <p>Abbiamo ricevuto la tua conferma di partecipazione al nostro matrimonio.</p>
        <p>Siamo felicissimi che tu possa essere presente in questo giorno speciale per noi.</p>
        <p>Ti aspettiamo!</p>
        <p><strong>Con affetto,<br>Simona e Alessandro</strong></p>
        <div class="footer">
            <p>Per qualsiasi domanda, rispondi a questa email.</p>
        </div>
    </div>
</body>
</html>
    `;
}

function buildNotificationEmail(data) {
    const guestNamesStr = data.guestNames.join(', ');
    
    if (!data.attending) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        h1 { color: #c0392b; font-size: 22px; border-bottom: 2px solid #c0392b; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td { padding: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Non Partecipa</h1>
        <table>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Ospiti:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${guestNamesStr}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Stato:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; color: #c0392b;">Non parteciperanno</td></tr>
        </table>
        <p style="margin-top: 20px; text-align: center;">
            <a href="https://simonae.abiagini.it/lista-invitati" style="display: inline-block; padding: 12px 24px; background: #8b7355; color: white; text-decoration: none; border-radius: 8px;">Vai alla Dashboard</a>
        </p>
    </div>
</body>
</html>
        `;
    }

    const dietaryLabels = {
        'nessuna': 'Nessuna preferenza',
        'vegetariano': 'Vegetariano',
        'vegano': 'Vegano',
        'allergie': 'Intolleranze/Allergie'
    };

    const totalGuests = data.guestNames.length;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
        h1 { color: #2c5530; font-size: 22px; border-bottom: 2px solid #2c5530; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        td { padding: 8px; }
        .total { background: #f0f7f0; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Nuova Conferma di Partecipazione</h1>
        <table>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Ospiti:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${guestNamesStr}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Dieta:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dietaryLabels[data.dietaryPreference] || 'Nessuna'}</td></tr>
            ${data.dietaryNotes ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Note dieta:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.dietaryNotes}</td></tr>` : ''}
            <tr class="total"><td style="padding: 12px 8px; border-top: 2px solid #2c5530;"><strong>Totale persone:</strong></td><td style="padding: 12px 8px; border-top: 2px solid #2c5530; color: #2c5530; font-size: 18px;"><strong>${totalGuests}</strong></td></tr>
        </table>
        <p style="margin-top: 20px; text-align: center;">
            <a href="https://simonae.abiagini.it/lista-invitati" style="display: inline-block; padding: 12px 24px; background: #8b7355; color: white; text-decoration: none; border-radius: 8px;">Vai alla Dashboard</a>
        </p>
    </div>
</body>
</html>
    `;
}
