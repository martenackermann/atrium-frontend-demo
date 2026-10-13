import type { AccessRule } from '~/lib/access'

/**
 * definePageMeta({ access: ['training_office', 'it_admin'] }) → only users matching ANY rule get in
 * (others see the 403 view). definePageMeta({ public: true }) → no sign-in required.
 * `title` names the page in breadcrumbs, the document title and the mobile top bar.
 */
interface AtriumPageMeta {
  access?: AccessRule[]
  public?: boolean
  title?: string
  /** Hide the page title in the mobile top bar (pages with their own serif h1, DESIGN R1). */
  hideMobileTitle?: boolean
}

/* eslint-disable @typescript-eslint/no-empty-object-type -- module augmentation by extension */
declare module '#app' {
  interface PageMeta extends AtriumPageMeta {}
}

declare module 'vue-router' {
  interface RouteMeta extends AtriumPageMeta {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

export {}
