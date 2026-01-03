import prisma from '../lib/prisma.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get all guests with their registration data
        const guests = await prisma.guest.findMany({
            select: {
                id: true,
                name: true,
                registration: {
                    select: {
                        id: true,
                        attending: true,
                        dietaryPreference: true,
                        dietaryNotes: true,
                        familyMembers: {
                            select: {
                                id: true,
                                name: true,
                                dietaryPreference: true,
                                dietaryNotes: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.status(200).json({ guests });
    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Errore nel recupero degli ospiti' });
    }
}
