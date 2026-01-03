import prisma from '../lib/prisma.js';

const ADMIN_PASSWORD = 'SimoAle2026';

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
        const { password } = req.body;

        // Check password
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Password non valida' });
        }

        // Get all guests with their registration data and family members
        const guests = await prisma.guest.findMany({
            include: {
                registration: {
                    include: {
                        familyMembers: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Calculate statistics
        const totalGuests = guests.length;
        const registeredGuests = guests.filter(g => g.registration !== null);
        const totalRegistered = registeredGuests.length;
        const pendingGuests = totalGuests - totalRegistered;
        
        // Filter by attending status
        const attendingGuests = registeredGuests.filter(g => g.registration?.attending === true);
        const notAttendingGuests = registeredGuests.filter(g => g.registration?.attending === false);
        const totalConfirmedAttending = attendingGuests.length;
        const totalNotAttending = notAttendingGuests.length;
        
        // Count +1s (only from attending guests)
        const plusOnes = attendingGuests.filter(g => g.registration?.plusOneName).length;
        
        // Count family members (only from attending guests)
        const familyMembersCount = attendingGuests.reduce((sum, g) => {
            return sum + (g.registration?.familyMembers?.length || 0);
        }, 0);
        
        const totalAttending = totalConfirmedAttending + plusOnes + familyMembersCount;

        // Dietary stats (only from attending guests)
        const dietaryStats = {
            nessuna: 0,
            vegetariano: 0,
            vegano: 0,
            allergie: 0
        };

        attendingGuests.forEach(g => {
            const pref = g.registration?.dietaryPreference || 'nessuna';
            if (dietaryStats[pref] !== undefined) {
                dietaryStats[pref]++;
            }
            // Count plus one dietary
            if (g.registration?.plusOneName && g.registration?.plusOneDietaryPreference) {
                const plusPref = g.registration.plusOneDietaryPreference;
                if (dietaryStats[plusPref] !== undefined) {
                    dietaryStats[plusPref]++;
                }
            }
            // Count family members dietary
            if (g.registration?.familyMembers) {
                g.registration.familyMembers.forEach(fm => {
                    const fmPref = fm.dietaryPreference || 'nessuna';
                    if (dietaryStats[fmPref] !== undefined) {
                        dietaryStats[fmPref]++;
                    }
                });
            }
        });

        return res.status(200).json({
            guests,
            stats: {
                totalGuests,
                totalRegistered,
                pendingGuests,
                totalConfirmedAttending,
                totalNotAttending,
                plusOnes,
                familyMembersCount,
                totalAttending,
                dietaryStats
            }
        });

    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Errore nel recupero dei dati' });
    }
}
