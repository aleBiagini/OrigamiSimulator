import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

function loadJson(filename, fallback) {
    try {
        return JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
    } catch {
        return fallback;
    }
}

function personKey(type, guestId, familyId) {
    if (type === 'guest') return `g-${guestId}`;
    if (type === 'plusOne') return `p-${guestId}`;
    return `f-${familyId}`;
}

function flattenDbGuests(dbGuests) {
    const persons = [];
    for (const g of dbGuests) {
        persons.push({
            id: personKey('guest', g.id, null),
            name: g.name,
            type: 'guest',
            guestId: g.id,
            familyId: null,
            host: null,
            inDatabase: true
        });
        const reg = g.registration;
        if (reg?.plusOneName) {
            persons.push({
                id: personKey('plusOne', g.id, null),
                name: reg.plusOneName,
                type: 'plusOne',
                guestId: g.id,
                familyId: null,
                host: g.name,
                inDatabase: true
            });
        }
        for (const fm of reg?.familyMembers || []) {
            persons.push({
                id: personKey('family', g.id, fm.id),
                name: fm.name,
                type: 'family',
                guestId: g.id,
                familyId: fm.id,
                host: g.name,
                inDatabase: true
            });
        }
    }
    return persons;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const tagsByName = loadJson('tavoli-tags.json', {});
        const mappingData = loadJson('tavoli-guest-mapping.json', {
            mapping: [],
            photoOnly: [],
            dbOnly: [],
            defaultLayout: { t1a: [], t1b: [], t2a: [], t2b: [], pool: [] }
        });

        const dbGuests = await prisma.guest.findMany({
            orderBy: { name: 'asc' },
            include: { registration: { include: { familyMembers: true } } }
        });

        const dbPersons = flattenDbGuests(dbGuests);
        const personById = new Map(dbPersons.map(p => [p.id, p]));

        for (const local of mappingData.photoOnly || []) {
            personById.set(local.personId, {
                id: local.personId,
                name: local.photoName,
                type: 'local',
                guestId: null,
                familyId: null,
                host: null,
                inDatabase: false
            });
        }

        for (const p of dbPersons) {
            const tags = tagsByName[p.name];
            if (tags) p.tags = tags;
        }
        for (const local of mappingData.photoOnly || []) {
            const p = personById.get(local.personId);
            const tags = tagsByName[p.name];
            if (tags) p.tags = tags;
        }

        const defaultLayout = JSON.parse(JSON.stringify(mappingData.defaultLayout || {
            t1a: [], t1b: [], t2a: [], t2b: [], pool: []
        }));

        const layoutIds = new Set([
            ...defaultLayout.t1a,
            ...defaultLayout.t1b,
            ...defaultLayout.t2a,
            ...defaultLayout.t2b,
            ...defaultLayout.pool
        ]);

        for (const extra of mappingData.dbOnly || []) {
            if (!layoutIds.has(extra.personId)) {
                defaultLayout.pool.push(extra.personId);
                layoutIds.add(extra.personId);
            }
        }

        const dbOnlyWithIds = (mappingData.dbOnly || []).map(p => ({
            personId: p.personId,
            name: p.name
        }));

        const photoOnlyWithIds = (mappingData.photoOnly || []).map(p => ({
            personId: p.personId,
            name: p.photoName
        }));

        const persons = [...personById.values()].sort((a, b) =>
            a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })
        );

        return res.status(200).json({
            persons,
            defaultLayout,
            sync: {
                matchedFromPhotos: (mappingData.mapping || []).length,
                photoOnly: photoOnlyWithIds,
                dbOnly: dbOnlyWithIds,
                aliasesFile: 'data/tavoli-aliases.json',
                lastSync: mappingData.generatedAt || null
            }
        });
    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Errore nel recupero dei dati tavoli' });
    }
}
