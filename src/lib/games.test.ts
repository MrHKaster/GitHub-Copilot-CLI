import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [strategyCategory] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [puzzleCategory] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id });

    for (let i = count; i >= 1; i--) {
        const category = i % 2 === 0 ? puzzleCategory : strategyCategory;
        const publisher = i % 3 === 0 ? pubTwo : pubOne;

        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by category', async () => {
        await seedGames(db, 6);
        const [strategyCategory] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.name, 'Strategy'));
        const filtered = await getAllGames(db, { categoryIds: [strategyCategory.id] });

        expect(filtered.map((game) => game.title)).toEqual(['Game 01', 'Game 03', 'Game 05']);
        expect(filtered.every((game) => game.category?.name === 'Strategy')).toBe(true);
    });

    it('filters games by publisher', async () => {
        await seedGames(db, 6);
        const [pubTwo] = await db
            .select({ id: publishers.id })
            .from(publishers)
            .where(eq(publishers.name, 'Pub Two'));
        const filtered = await getAllGames(db, { publisherIds: [pubTwo.id] });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((game) => game.publisher?.name === 'Pub Two')).toBe(true);
    });

    it('combines category and publisher filters', async () => {
        await seedGames(db, 6);
        const [strategyCategory] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.name, 'Strategy'));
        const [pubTwo] = await db
            .select({ id: publishers.id })
            .from(publishers)
            .where(eq(publishers.name, 'Pub Two'));
        const filtered = await getAllGames(db, {
            categoryIds: [strategyCategory.id],
            publisherIds: [pubTwo.id],
        });

        expect(filtered.length).toBeGreaterThan(0);
        expect(filtered.every((game) => game.category?.name === 'Strategy')).toBe(true);
        expect(filtered.every((game) => game.publisher?.name === 'Pub Two')).toBe(true);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
