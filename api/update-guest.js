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
        const {
            password,
            guestId,
            registrationId,
            guestName,
            attending,
            dietaryPreference,
            dietaryNotes,
            familyMembers = []
        } = req.body;

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

        // Update guest name if provided and different
        if (guestName && guestName.trim() !== '' && guestName.trim() !== guest.name) {
            // Check if the new name already exists
            const existingGuest = await prisma.guest.findUnique({
                where: { name: guestName.trim() }
            });
            
            if (existingGuest && existingGuest.id !== guestId) {
                return res.status(400).json({ error: 'Esiste gia un ospite con questo nome' });
            }
            
            await prisma.guest.update({
                where: { id: guestId },
                data: { name: guestName.trim() }
            });
        }

        if (attending === null) {
            if (guest.registration) {
                await prisma.familyMember.deleteMany({
                    where: { registrationId: guest.registration.id }
                });
                await prisma.registration.delete({
                    where: { id: guest.registration.id }
                });
            }
            return res.status(200).json({ success: true, message: 'Registrazione rimossa' });
        }

        if (guest.registration) {
            await prisma.familyMember.deleteMany({
                where: { registrationId: guest.registration.id }
            });

            await prisma.registration.update({
                where: { id: guest.registration.id },
                data: {
                    attending: attending,
                    dietaryPreference: attending ? (dietaryPreference || 'nessuna') : 'nessuna',
                    dietaryNotes: attending ? (dietaryNotes || null) : null,
                    familyMembers: {
                        create: attending && familyMembers.length > 0 
                            ? familyMembers.map(fm => ({
                                name: fm.name,
                                dietaryPreference: fm.dietaryPreference || 'nessuna',
                                dietaryNotes: fm.dietaryNotes || null
                            }))
                            : []
                    }
                }
            });
        } else {
            await prisma.registration.create({
                data: {
                    guestId: guestId,
                    attending: attending,
                    dietaryPreference: attending ? (dietaryPreference || 'nessuna') : 'nessuna',
                    dietaryNotes: attending ? (dietaryNotes || null) : null,
                    familyMembers: {
                        create: attending && familyMembers.length > 0 
                            ? familyMembers.map(fm => ({
                                name: fm.name,
                                dietaryPreference: fm.dietaryPreference || 'nessuna',
                                dietaryNotes: fm.dietaryNotes || null
                            }))
                            : []
                    }
                }
            });
        }

        return res.status(200).json({ success: true, message: 'Aggiornato con successo' });

    } catch (error) {
        console.error('Update error:', error);
        return res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
    }
}
