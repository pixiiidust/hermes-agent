import { afterEach, describe, expect, it, vi } from 'vitest'

import { $connection } from '@/store/session'

import { localPreviewTarget, normalizeOrLocalPreviewTarget } from './local-preview'

const api = vi.fn(async ({ path }: { path: string }) => {
  if (path.startsWith('/api/fs/read-text?')) {
    return {
      byteSize: 34,
      mimeType: 'text/html',
      path: '/tmp/out.html',
      text: '<!doctype html><h1>Hello remote</h1>'
    }
  }

  throw new Error(`unexpected path ${path}`)
})

describe('local preview targets', () => {
  afterEach(() => {
    $connection.set(null)
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('keeps local HTML previews as file URLs in local mode', () => {
    $connection.set({ mode: 'local' } as never)

    expect(localPreviewTarget('/tmp/demo.html')).toMatchObject({
      kind: 'file',
      path: '/tmp/demo.html',
      previewKind: 'html',
      url: 'file:///tmp/demo.html'
    })
  })

  it('renders remote HTML previews from authenticated backend reads instead of file URLs', async () => {
    $connection.set({ baseUrl: 'https://gw.example', mode: 'remote' } as never)
    vi.stubGlobal('window', {
      hermesDesktop: {
        api,
        normalizePreviewTarget: vi.fn(async () => null)
      }
    })

    await expect(normalizeOrLocalPreviewTarget('file:///tmp/out.html')).resolves.toMatchObject({
      kind: 'file',
      path: '/tmp/out.html',
      previewKind: 'html',
      url: 'data:text/html;charset=utf-8,%3C!doctype%20html%3E%3Ch1%3EHello%20remote%3C%2Fh1%3E'
    })
    expect(api).toHaveBeenCalledWith({ path: '/api/fs/read-text?path=%2Ftmp%2Fout.html' })
  })

  it('uses authenticated backend reads when Electron cannot normalize a gateway-local file', async () => {
    $connection.set({ baseUrl: 'https://gw.example', mode: 'remote' } as never)
    vi.stubGlobal('window', {
      hermesDesktop: {
        api,
        normalizePreviewTarget: vi.fn(async () => null)
      }
    })

    await expect(normalizeOrLocalPreviewTarget('/tmp/out.html')).resolves.toMatchObject({
      path: '/tmp/out.html',
      previewKind: 'html',
      url: 'data:text/html;charset=utf-8,%3C!doctype%20html%3E%3Ch1%3EHello%20remote%3C%2Fh1%3E'
    })
  })
})
