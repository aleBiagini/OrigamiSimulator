import prisma from '../lib/prisma.js';

const ADMIN_PASSWORD = 'SimoAle2026';

export default async function handler(req, res) {
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
        const { password, name } = req.body;

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Password non valida' });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Il nome e obbligatorio' });
        }

        const guest = await prisma.guest.create({
            data: {
                name: name.trim()
            }
        });

        return res.status(200).json({ success: true, guest });

    } catch (error) {
        console.error('Error adding guest:', error);
        return res.status(500).json({ error: 'Errore durante l\'aggiunta dell\'ospite' });
    }
}
