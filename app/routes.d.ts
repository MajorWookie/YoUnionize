// deno-lint-ignore-file
/* eslint-disable */
// biome-ignore: needed import
import type { OneRouter } from 'one'

declare module 'one' {
  export namespace OneRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: 
        | `/`
        | `/(app)`
        | `/(app)/(tabs)`
        | `/(app)/(tabs)/discover`
        | `/(app)/(tabs)/my-company`
        | `/(app)/(tabs)/my-pay`
        | `/(app)/(tabs)/profile`
        | `/(app)/discover`
        | `/(app)/my-company`
        | `/(app)/my-pay`
        | `/(app)/onboarding`
        | `/(app)/profile`
        | `/(tabs)`
        | `/(tabs)/discover`
        | `/(tabs)/my-company`
        | `/(tabs)/my-pay`
        | `/(tabs)/profile`
        | `/_sitemap`
        | `/discover`
        | `/my-company`
        | `/my-pay`
        | `/onboarding`
        | `/profile`
        | `/sign-in`
        | `/sign-up`
      DynamicRoutes: 
        | `/(app)/company/${OneRouter.SingleRoutePart<T>}`
        | `/company/${OneRouter.SingleRoutePart<T>}`
      DynamicRouteTemplate: 
        | `/(app)/company/[ticker]`
        | `/company/[ticker]`
      IsTyped: true
      RouteTypes: {
        '/(app)/company/[ticker]': RouteInfo<{ ticker: string }>
        '/company/[ticker]': RouteInfo<{ ticker: string }>
      }
    }
  }
}

/**
 * Helper type for route information
 */
type RouteInfo<Params = Record<string, never>> = {
  Params: Params
  LoaderProps: { path: string; params: Params; request?: Request }
}