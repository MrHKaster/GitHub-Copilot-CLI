import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

export interface GameFilters {
    categoryIds?: number | string | Array<number | string>;
    publisherIds?: number | string | Array<number | string>;
    categories?: number | string | Array<number | string>;
    publishers?: number | string | Array<number | string>;
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function normalizeFilterValues(values?: Array<number | string> | number | string | null): number[] {
    if (values === undefined || values === null) {
        return [];
    }

    const list = Array.isArray(values) ? values : [values];
    const normalized = list
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);

    return [...new Set(normalized)];
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

function addFilterConditions(query: ReturnType<typeof baseGamesQuery>, filters: GameFilters) {
    const categoryIds = normalizeFilterValues(filters.categoryIds ?? filters.categories);
    const publisherIds = normalizeFilterValues(filters.publisherIds ?? filters.publishers);
    const conditions = [];

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    if (conditions.length === 0) {
        return query;
    }

    return query.where(and(...conditions));
}

/** Returns all categories ordered by name for filter controls and page state. */
export async function getAllCategories(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows;
}

/** Returns all publishers ordered by name for filter controls and page state. */
export async function getAllPublishers(db: Database): Promise<Array<{ id: number; name: string }>> {
    const rows = await db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows;
}

/** All games ordered by title, optionally narrowed by category and publisher constraints. */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const rows = await addFilterConditions(baseGamesQuery(db), filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title, optionally narrowed by category and publisher constraints. */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const categoryIds = normalizeFilterValues(filters.categoryIds ?? filters.categories);
    const publisherIds = normalizeFilterValues(filters.publisherIds ?? filters.publishers);
    const query = db.select({ id: games.id }).from(games).leftJoin(categories, eq(games.categoryId, categories.id)).leftJoin(publishers, eq(games.publisherId, publishers.id));
    const conditions = [];

    if (categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    const rows = conditions.length > 0 ? await query.where(and(...conditions)).orderBy(asc(games.title)) : await query.orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** Returns every game in a single category, ordered by title for stable listings. */
export async function getGamesByCategory(db: Database, categoryId: number | string | Array<number | string>): Promise<Game[]> {
    return getAllGames(db, { categories: categoryId });
}

/** Returns every game from a single publisher, ordered by title for stable listings. */
export async function getGamesByPublisher(db: Database, publisherId: number | string | Array<number | string>): Promise<Game[]> {
    return getAllGames(db, { publishers: publisherId });
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
