import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prisma = new PrismaClient();

const PHOTO_ORDER = [
    'Isora Poggesi', 'Carla Messini', 'Massimo Giarella', 'Sara Giarella', 'Lorenzo Giarella',
    'Gabriele Giarella', 'Martina Chinello', 'Noemi Cuccoli', 'Alberto Messini', 'Francesca Rose',
    'Giulio Papiani', 'Edoardo Papiani', 'Marta Cheli', 'Andrea Ghelardoni', 'Alice Medda',
    'Alessandra Fugni', 'Gabriele Bindi', 'Simone Di Fresco', 'Valerio Urbani', 'Emanuele Zaccaria',
    'Jacopo Guerini', 'Claudia Merati', 'Claudia Russo', 'Paolo Busco', 'Alessandro Busco',
    'Ludovica Paradisi', 'Alessio Cambiotti', 'Francesco Santani', 'Martina Zampini', "Rina N'Jem",
    'Simone Lucarelli', 'Michela Mastroforti', 'Elisa Brufani',
    'Carlo Messini', 'Anna Nenci', 'Marta Messini', 'Giuseppe Pisano', 'Ilaria Pisano',
    'Francesco Messini', 'Lucrezia Messini', 'Silvia Guerini', 'Paolo Sicignano', 'Marina Bromo',
    'Matteo Sicignano', 'Dario Romboli', 'Diletta Menichetti', 'Elena Grazioli', 'Giulio Tarlati',
    'Barbanera', 'Tasso', 'Francesco Mannino', 'Beatrice Ballibio', 'Fabio Campana',
    'Davide Brignoli', 'Sara Morandini', 'Agostino Donati', 'Camilla Gardini', 'Anna Orioli',
    'Marco Porrozzi', 'Camilla Pantaleoni', 'Federico Massaccesi', 'Benedetta Costanzi',
    'Guido Provvidenza', 'Giovanni Piccoli', 'Chantal Mersi', 'Samuele Ricciardi',
    'Marco Fiorucci', 'Patrizia Bruni', 'Francesco Lattanzi', 'Lorena Fiorucci', 'Enea Biagini',
    'Valeria Ojeda', 'Matteo Fiorucci', 'Sara Rosini', 'Elisa Fiorucci', 'Noemi Fiorucci',
    'Roberta Fiorucci', 'Claudia Sensi', 'Flavia Sensi', 'Michela Bruno', "Nicolo' De Lorenzo",
    'Riccardo De Lorenzo', 'Gianluca De Lorenzo', 'Giacomo Rufini', 'Linda Carbonari',
    'Nicola Gramaccioni', 'Cecilia Crisanti', 'Marta Pero', 'Luisa Tini', 'Giulia Vinicola',
    'Martina Saludini', 'Diego Zahir', 'Pedro Zoahir', "Nicolo' Poltroniere", 'Anna Agostinelli',
    'Alessia Giomboni', 'Lorenzo Moscatelli', 'Amaia Pelucca', 'Linda Bachiorri', 'Matteo Bernardini',
    'Andrea Biagini', 'Alessandra', 'Francesca Orfei', 'Mauro Patiti', 'Carla Castrini',
    'Sergio Malinconici', 'Aaron Malinconici', 'Alessio Malinconici', 'Cristina Salari',
    'Roberto Giaimo', 'Fabio Giaimo', 'Arianna Felicioni', 'Andrea Patiti', "Caterina D'Alessandro",
    'Ambra Gargiulo', "Angelo D'Arondo", 'Daniela Mazzella', 'Riccardo Concia', 'Luca Battistoni',
    'Elisabetta Meschini', 'Lucia Galletti', 'Diletta Bigini', 'Giovanni Buini', 'Cesare Coppe',
    'Elena Mariani', 'Diego Ossola', 'Simone Ossola', 'Lorenzo Casuscelli', 'Bianca Maria Ambrogio',
    'Annachiara Dozzini', 'Lavinia Giguarelli', 'Veronica Benedetti', 'Lorenzo Catanzani', 'Francesco Gauti'
];

function normalize(name) {
    return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[''`]/g, '').replace(/\s+/g, ' ').trim();
}

function slugify(name) {
    return normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function personKey(p) {
    if (p.type === 'guest') return `g-${p.guestId}`;
    if (p.type === 'plusOne') return `p-${p.guestId}`;
    return `f-${p.familyId}`;
}

async function main() {
    const aliases = JSON.parse(fs.readFileSync(path.join(root, 'data', 'tavoli-aliases.json'), 'utf8'));

    const dbGuests = await prisma.guest.findMany({
        orderBy: { name: 'asc' },
        include: { registration: { include: { familyMembers: true } } }
    });

    const allDbPeople = [];
    for (const g of dbGuests) {
        allDbPeople.push({ type: 'guest', guestId: g.id, familyId: null, name: g.name });
        const reg = g.registration;
        if (reg?.plusOneName) {
            allDbPeople.push({ type: 'plusOne', guestId: g.id, familyId: null, name: reg.plusOneName, host: g.name });
        }
        for (const fm of reg?.familyMembers || []) {
            allDbPeople.push({ type: 'family', guestId: g.id, familyId: fm.id, name: fm.name, host: g.name });
        }
    }

    const dbByNorm = new Map();
    for (const p of allDbPeople) {
        const n = normalize(p.name);
        if (!dbByNorm.has(n)) dbByNorm.set(n, []);
        dbByNorm.get(n).push(p);
    }

    const usedKeys = new Set();
    const mapping = [];
    const photoOnly = [];

    for (const photoName of PHOTO_ORDER) {
        const lookupName = aliases[photoName] || photoName;
        const candidates = dbByNorm.get(normalize(lookupName)) || [];
        const available = candidates.filter(c => !usedKeys.has(personKey(c)));
        const match = available[0] || candidates[0];

        if (match) {
            usedKeys.add(personKey(match));
            mapping.push({
                photoName,
                dbName: match.name,
                personId: personKey(match),
                type: match.type,
                guestId: match.guestId,
                familyId: match.familyId,
                host: match.host || null
            });
        } else {
            photoOnly.push({
                photoName,
                personId: `local-${slugify(photoName)}`,
                dbName: null
            });
        }
    }

    const mappedIds = new Set(mapping.map(m => m.personId));
    const dbOnly = allDbPeople
        .filter(p => !usedKeys.has(personKey(p)))
        .map(p => ({
            personId: personKey(p),
            name: p.name,
            type: p.type,
            guestId: p.guestId,
            familyId: p.familyId,
            host: p.host || null
        }));

    const ids = mapping.map(m => m.personId).concat(photoOnly.map(p => p.personId));
    const defaultLayout = {
        t1a: ids.slice(0, 33),
        t1b: ids.slice(33, 66),
        t2a: ids.slice(66, 100),
        t2b: ids.slice(100, 134),
        pool: []
    };

    const out = {
        generatedAt: new Date().toISOString(),
        mapping,
        photoOnly,
        dbOnly,
        defaultLayout
    };

    fs.writeFileSync(path.join(root, 'data', 'tavoli-guest-mapping.json'), JSON.stringify(out, null, 2));
    console.log('Match DB:', mapping.length, '| Solo foto:', photoOnly.length, '| Solo DB:', dbOnly.length);
    if (photoOnly.length) console.log('Solo foto:', photoOnly.map(p => p.photoName).join(', '));
    if (dbOnly.length) console.log('Solo DB:', dbOnly.map(p => p.name).join(', '));

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
