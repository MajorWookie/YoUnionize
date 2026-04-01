/**
 * Static nickname → formal first name mapping for SEC filing name deduplication.
 *
 * Used in the enrichment layer (not in normalizeName()) because nickname
 * matching is too fuzzy for unique DB indexes — false positives could block
 * legitimate inserts. The enrichment layer provides last-name + position
 * overlap as a safety net against false merges.
 */

const NICKNAME_TO_FORMAL: Record<string, string> = {
  // A
  al: 'albert',
  alex: 'alexander',
  andy: 'andrew',
  art: 'arthur',

  // B
  barb: 'barbara',
  ben: 'benjamin',
  beth: 'elizabeth',
  bill: 'william',
  bob: 'robert',

  // C
  charlie: 'charles',
  chris: 'christopher',
  chuck: 'charles',

  // D
  dan: 'daniel',
  dave: 'david',
  dick: 'richard',
  don: 'donald',
  doug: 'douglas',

  // E
  ed: 'edward',

  // F
  fred: 'frederick',
  frank: 'francis',

  // G
  gene: 'eugene',
  greg: 'gregory',

  // H
  hank: 'henry',
  harry: 'henry',

  // J
  jack: 'john',
  jake: 'jacob',
  jeff: 'jeffrey',
  jen: 'jennifer',
  jenny: 'jennifer',
  jerry: 'gerald',
  jim: 'james',
  jimmy: 'james',
  joe: 'joseph',
  jon: 'jonathan',
  josh: 'joshua',

  // K
  kate: 'katherine',
  ken: 'kenneth',
  kim: 'kimberly',

  // L
  larry: 'lawrence',
  liz: 'elizabeth',

  // M
  matt: 'matthew',
  meg: 'margaret',
  mike: 'michael',

  // N
  nate: 'nathaniel',
  nick: 'nicholas',

  // P
  pat: 'patrick',
  pete: 'peter',
  phil: 'philip',

  // R
  ray: 'raymond',
  rich: 'richard',
  rick: 'richard',
  rob: 'robert',
  ron: 'ronald',

  // S
  sam: 'samuel',
  sandy: 'sandra',
  steve: 'steven',
  stu: 'stuart',
  sue: 'susan',

  // T
  ted: 'theodore',
  terry: 'terrence',
  tim: 'timothy',
  tom: 'thomas',
  tony: 'anthony',

  // W
  wes: 'wesley',
  will: 'william',
  woody: 'woodrow',
}

/**
 * Resolve a first name to its formal equivalent using the nickname map.
 * Returns the formal version if found, otherwise returns the input lowercased.
 *
 * Examples:
 *   getCanonicalFirstName("Tim")   → "timothy"
 *   getCanonicalFirstName("Timothy") → "timothy"  (not in map, returned as-is lowered)
 *   getCanonicalFirstName("Satya")   → "satya"    (not in map, returned as-is lowered)
 */
export function getCanonicalFirstName(firstName: string): string {
  const lower = firstName.toLowerCase()
  return NICKNAME_TO_FORMAL[lower] ?? lower
}
