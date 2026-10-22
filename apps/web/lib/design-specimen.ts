import { EMBLEM_IDS, LAYOUTS, SHAPES } from "@kachizaka/design-system";

/** Invented team names for the specimen plate — never a real club's. */
export const SPECIMEN_TEAMS = [
  "Montréal Mariners", "Nordiques de l'Est", "Granit de Beauce", "Harfangs", "Voyageurs", "Union Saint-Laurent",
  "Orcas", "Rapides", "Titans", "Aigles de Laval", "Loups gris", "Cosmos",
  "Océanic", "Mistral", "Remparts", "La gang du vendredi", "Équipe A", "Lions",
] as const;

/** The sizes the specimen draws (px). */
export const SPECIMEN_SIZES = [16, 24, 32, 48, 64, 96, 128] as const;

/** One team through every silhouette and layout. */
export const MATRIX_TEAM = "Montréal Mariners";
export const MATRIX = SHAPES.flatMap((shape) => LAYOUTS.map((layout) => ({ shape, layout })));
export const EMBLEMS_SHOWN = EMBLEM_IDS;
