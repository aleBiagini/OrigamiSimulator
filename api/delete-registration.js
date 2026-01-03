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
        const { password, guestId } = req.body;

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Non autorizzato' });
        }

        if (!guestId) {
            return res.status(400).json({ error: 'ID ospite mancante' });
        }

        const guest = await prisma.guest.findUnique({
            where: { id: guestId },
            include: { 
                registration: {
                    include: { familyMembers: true }
                }
            }
        });

        if (!guest) {
            return res.status(404).json({ error: 'Ospite non trovato' });
        }

        if (!guest.registration) {
            return res.status(400).json({ error: 'Nessuna registrazione da eliminare' });
        }

        await prisma.familyMember.deleteMany({
            where: { registrationId: guest.registration.id }
        });

        await prisma.registration.delete({
            where: { id: guest.registration.id }
        });

        return res.status(200).json({ success: true, message: 'Registrazione eliminata' });

    } catch (error) {
        console.error('Delete error:', error);
        return res.status(500).json({ error: 'Errore durante l\'eliminazione' });
    }
}
