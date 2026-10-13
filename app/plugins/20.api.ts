import type { Pinia } from 'pinia'
import {
  createHttpClient,
  createOpenApiClient,
  isSafeDownloadUrl,
  uploadAttachment,
} from '~/lib/api'
import type { AttachmentDto, AttachmentPurpose, DownloadUrl } from '~/types/api'

/** Provides the API client as `$api` (use the useApi() composable). */
export default defineNuxtPlugin({
  name: 'atrium:api',
  dependsOn: ['atrium:vue-query'],
  setup(nuxtApp) {
    const config = useRuntimeConfig()
    const router = useRouter()
    // Instantiate the store here (inside the Nuxt context); its actions use $api lazily.
    const auth = useAuthStore(nuxtApp.$pinia as Pinia)
    const baseUrl = String(config.public.apiBase)

    const onUnauthorized = () => {
      auth.clearSession()
      const current = router.currentRoute.value
      if (current.meta.public) return
      void nuxtApp.runWithContext(() =>
        navigateTo({ path: '/login', query: { redirect: current.fullPath } }),
      )
    }

    const http = createHttpClient({ baseUrl, getToken: () => auth.token, onUnauthorized })
    const client = createOpenApiClient({ baseUrl, getToken: () => auth.token, onUnauthorized })

    const downloadUrl = (
      attachmentId: string,
      disposition: 'attachment' | 'inline' = 'attachment',
    ) => http.get<DownloadUrl>(`/attachments/${attachmentId}/download-url`, { disposition })

    const api = {
      ...http,
      /** Typed openapi-fetch client for paths in the generated schema (`pnpm api:types`). */
      client,
      /** Staged upload with progress (API.md §1 "Uploads"). */
      upload(
        file: File,
        purpose: AttachmentPurpose,
        options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
      ): Promise<AttachmentDto> {
        return uploadAttachment({ baseUrl, token: auth.token, file, purpose, ...options })
      },
      /** 5-minute signed URL (API.md §1 "Downloads"). */
      downloadUrl,
      /** Open an attachment in a new tab (opened first so popup blockers allow it). */
      async openAttachment(attachmentId: string, disposition: 'attachment' | 'inline' = 'inline') {
        const tab = window.open('about:blank', '_blank')
        try {
          const { url } = await downloadUrl(attachmentId, disposition)
          if (!isSafeDownloadUrl(url, baseUrl, window.location.origin)) {
            throw new Error('Unexpected download location')
          }
          if (tab) {
            tab.opener = null
            tab.location.href = url
          } else {
            window.location.assign(url)
          }
        } catch (error) {
          tab?.close()
          throw error
        }
      },
    }

    return { provide: { api } }
  },
})
