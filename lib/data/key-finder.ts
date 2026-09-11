/**
 * Shared by the server page and the client batch form, so it lives outside
 * both. Exporting it from KeyFinderBatch made it a client reference, and the
 * server page rendered the "cannot call a client function" error in place of
 * the number.
 */
export const MAX_BATCH_FILES = 20;