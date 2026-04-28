/**
 * Makes complex intersection types more readable by flattening them.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

/**
 * A stricter version of Omit that only allows keys present in T.
 */
export type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
