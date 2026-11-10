import { InsigniaType } from '../types';

/**
 * Normalizes text for name matching: lowercase, trimmed, accents removed.
 */
export function cleanNameToken(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Connector words and articles in Spanish names that should not be classified
const CONNECTOR_WORDS = new Set([
  'de', 'del', 'la', 'las', 'los', 'san', 'santa', 'el', 'y'
]);

// Common female first names in Spanish / Latin America, including variants
const FEMALE_NAMES = new Set([
  // Nombres solicitados específicamente y sus variantes
  'jocelyn', 'yocelyn', 'joselyn', 'jocelyne', 'jocelin', 'yocelin', 'josselyn',
  'maricruz', 'marycruz',
  'edith', 'edit',
  'jaqueline', 'jacqueline', 'jaquelin', 'jackeline', 'jacquelin', 'jakeline',
  'lizeth', 'lizette', 'lizet', 'lisset', 'lissette', 'lizbeth', 'lisbeth',
  'irene',
  'berenice', 'berenis', 'verenice',
  'nohemi', 'noemi',
  'leslie', 'lesly', 'lesley', 'lesli',
  'emilia',
  'citlali', 'citlalli', 'xitlali', 'xitlalli', 'citlaly',
  'meribeth', 'maribeth', 'marybeth',
  'estefani', 'estefany', 'stefany', 'stephanie', 'stephany', 'stefani', 'estefania',
  'vianey', 'vianney',
  'geraldine', 'geraldin',
  'matilde',
  'anahi', 'anay',
  'areli', 'arely', 'arelis',
  'ivette', 'yvette', 'ivett', 'yvet', 'ivon', 'ivonne',
  'eunice',
  'flor',
  'esther', 'ester',
  'abigail', 'abygail', 'abigaill',
  'gisel', 'giselle', 'gisele', 'gissell', 'gisell', 'jisel', 'jiselle',

  // Catálogo existente de nombres femeninos comunes
  'maria', 'ma', 'ana', 'ilse', 'claudia', 'martha', 'marta', 'rosa', 'adriana',
  'patricia', 'laura', 'gabriela', 'leticia', 'silvia', 'elizabeth', 'veronica',
  'gloria', 'sandra', 'alma', 'irma', 'brenda', 'teresa', 'angelica', 'beatriz',
  'monica', 'erika', 'carmen', 'alejandra', 'diana', 'blanca', 'nancy', 'cecilia',
  'sonia', 'jessica', 'jesica', 'karina', 'daniela', 'maricela', 'araceli',
  'fabiola', 'cristina', 'andrea', 'lucia', 'elena', 'paula', 'valeria', 'karen',
  'miriam', 'wendy', 'guadalupe', 'lupita', 'rocio', 'socorro', 'consuelo',
  'amparo', 'pilar', 'lourdes', 'mercedes', 'dolores', 'montserrat', 'itzel',
  'ximena', 'jimena', 'sofia', 'vanessa', 'vanesa', 'fernanda', 'yolanda',
  'juana', 'estela', 'margarita', 'susana', 'norma', 'sara', 'lucero', 'mayra',
  'rebeca', 'lorena', 'natalia', 'paulina', 'clara', 'luz', 'carolina', 'karla',
  'mirna', 'janeth', 'perla', 'jazmin', 'yazmin', 'abril', 'alicia', 'aurora',
  'catalina', 'dulce', 'esperanza', 'evelyn', 'fatima', 'graciela', 'guillermina',
  'haydee', 'hortensia', 'isabel', 'josefina', 'judith', 'juliana', 'lidia',
  'liliana', 'maribel', 'marisol', 'mariana', 'marina', 'maritza', 'merari',
  'nayeli', 'ofelia', 'olga', 'paloma', 'raquel', 'rosario', 'rubi', 'ruth',
  'tamara', 'tania', 'vanya', 'yamilet', 'zulema'
]);

// Common male first names in Spanish / Latin America, including variants
const MALE_NAMES = new Set([
  // Nombres solicitados específicamente y sus variantes
  'agustin',
  'giovanny', 'giovanni', 'geovany', 'geovanni', 'giovani', 'geovanny', 'jovany', 'jovanny',
  'edgardo',
  'isaac', 'isac',
  'cristopher', 'christopher', 'cristofer', 'cristofher', 'kristopher',
  'aaron',
  'clemente',

  // Catálogo existente de nombres masculinos comunes
  'victor', 'carlos', 'juan', 'jose', 'luis', 'jorge', 'miguel', 'pedro', 'jesus',
  'francisco', 'manuel', 'roberto', 'alejandro', 'fernando', 'ricardo', 'eduardo',
  'javier', 'raul', 'daniel', 'mario', 'david', 'sergio', 'antonio', 'hector',
  'oscar', 'arturo', 'marco', 'marcos', 'cesar', 'ruben', 'julio', 'gabriel',
  'ivan', 'rafael', 'gerardo', 'edgar', 'angel', 'andres', 'rodrigo', 'enrique',
  'salvador', 'guillermo', 'martin', 'adrian', 'hugo', 'ignacio', 'gustavo',
  'christian', 'cristian', 'diego', 'pablo', 'felipe', 'jaime', 'ramon', 'alfredo',
  'alonso', 'alfonso', 'armando', 'bernardo', 'emilio', 'ernesto', 'esteban',
  'fidel', 'gonzalo', 'gregorio', 'leonardo', 'lorenzo', 'lucas', 'mateo',
  'nicolas', 'omar', 'orlando', 'patricio', 'rene', 'rogelio', 'sebastian',
  'tomas', 'vicente', 'abel', 'abraham', 'adolfo', 'alan', 'alberto', 'aldo',
  'alexis', 'ariel', 'axel', 'benjamin', 'boris', 'brayan', 'bruno', 'camilo',
  'claudio', 'cristobal', 'damian', 'dario', 'edwin', 'elias', 'eloy', 'emanuel',
  'emmanuel', 'eric', 'erick', 'fabian', 'federico', 'felix', 'gaspar', 'german',
  'gilberto', 'humberto', 'isaias', 'ismael', 'israel', 'joaquin', 'jonathan',
  'julian', 'kevin', 'leopoldo', 'luciano', 'mauricio', 'maximiliano', 'noel',
  'octavio', 'oliver', 'osvaldo', 'pascual', 'rodolfo', 'rolando', 'samuel',
  'saul', 'ulises', 'valentin', 'walter', 'xavier'
]);

// Excepciones masculinas que terminan en -a
const MALE_EXCEPTIONS_A = new Set([
  'josua', 'garcia', 'mata', 'borja', 'bautista', 'luca', 'sasha'
]);

// Excepciones femeninas que terminan en -o o consonante
const FEMALE_EXCEPTIONS_O = new Set([
  'rosario', 'consuelo', 'amparo', 'socorro', 'rocio'
]);

/**
 * Infers INSIGNIA classification from the given name (field «Nombre» from Excel).
 * Rules:
 * 1. Analyzes strictly the «Nombre» field, without using surnames.
 * 2. Recognizes compound names (e.g. "Ana Jocelyn" -> MUJER, "José Edgardo" -> HOMBRE).
 * 3. Case-insensitive and accent/diacritic-insensitive matching.
 * 4. Recognizes common spelling variants (e.g. Citlalli, Jacqueline, Lizette, etc.).
 * 5. Strict word token matching to prevent false partial matches (e.g., does not classify "Maricruz" based on "Mari").
 * 6. Contradiction rule: if a compound name contains conflicting female and male tokens
 *    (outside of classic idioms like "María José" / "José María"), suggests REVISIÓN ●.
 * 7. When information is insufficient or unrecognized, preserves REVISIÓN ●.
 * 8. Manual modifications by the tutor always take precedence over automatic suggestions.
 */
export function inferInsignia(nombre: string, nombreCompleto?: string): InsigniaType {
  // Regla 2: Analizar únicamente el campo «Nombre» del Excel, sin utilizar los apellidos
  let candidate = (nombre || '').trim();

  // En caso de que «nombre» esté vacío, extraer únicamente la porción del nombre de «nombreCompleto»
  if (!candidate && nombreCompleto) {
    const full = nombreCompleto.trim();
    if (full.includes(',')) {
      // Formato "Apellidos, Nombre" -> tomar la porción de nombre después de la coma
      const parts = full.split(',');
      candidate = (parts[1] || '').trim();
    } else {
      // Tomar las primeras dos palabras para evitar apellidos
      const words = full.split(/\s+/).filter(Boolean);
      candidate = words.slice(0, 2).join(' ');
    }
  }

  if (!candidate) return 'REVISION';

  // Separar en palabras/tokens ignorando signos de puntuación
  const rawTokens = candidate.split(/[\s,./\-_+;:()]+/g).filter(Boolean);
  if (rawTokens.length === 0) return 'REVISION';

  const cleanTokens = rawTokens.map(cleanNameToken).filter(Boolean);
  if (cleanTokens.length === 0) return 'REVISION';

  const first = cleanTokens[0];
  const second = cleanTokens.length > 1 ? cleanTokens[1] : '';

  // Casos especiales idiomáticos compuestos de tradición hispana:
  // "María José" / "Ma. José" -> MUJER
  if ((first === 'maria' || first === 'ma') && second === 'jose') {
    return 'MUJER';
  }
  // "José María" -> HOMBRE
  if (first === 'jose' && second === 'maria') {
    return 'HOMBRE';
  }

  // Filtrar tokens sustantivos (excluyendo conectores como 'de', 'del', 'la' y letras solas de iniciales)
  const substantiveTokens = cleanTokens.filter(
    (t) => !CONNECTOR_WORDS.has(t) && t.length > 1
  );

  if (substantiveTokens.length === 0) {
    // Si solo hay iniciales o conectores, información insuficiente
    return 'REVISION';
  }

  let femaleCount = 0;
  let maleCount = 0;

  for (const token of substantiveTokens) {
    const isFemale = FEMALE_NAMES.has(token);
    const isMale = MALE_NAMES.has(token);

    if (isFemale && !isMale) {
      femaleCount++;
    } else if (isMale && !isFemale) {
      maleCount++;
    }
  }

  // Regla de contradicción: si contiene tokens masculinos y femeninos simultáneamente
  if (femaleCount > 0 && maleCount > 0) {
    return 'REVISION';
  }

  // Coincidencia con catálogo
  if (femaleCount > 0 && maleCount === 0) {
    return 'MUJER';
  }
  if (maleCount > 0 && femaleCount === 0) {
    return 'HOMBRE';
  }

  // Si ningún token estuvo en el catálogo explícito, aplicar reglas morfológicas del español
  // únicamente sobre el primer token sustantivo, si tiene al menos 4 caracteres y no es ambiguo
  const primaryToken = substantiveTokens[0];
  if (primaryToken && primaryToken.length >= 4) {
    if (primaryToken.endsWith('a') && !MALE_EXCEPTIONS_A.has(primaryToken)) {
      return 'MUJER';
    }
    if (primaryToken.endsWith('o') && !FEMALE_EXCEPTIONS_O.has(primaryToken)) {
      return 'HOMBRE';
    }
  }

  // Ante información insuficiente o nombres no identificados, sugerir REVISIÓN
  return 'REVISION';
}
