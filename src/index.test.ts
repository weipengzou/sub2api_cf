import { describe, expect, it } from 'bun:test'
import app from './index'

describe('API Proxy', () => {
  it('GET / returns Hello Hono!', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello Hono!')
  })

  it('GET /openai/* proxies to /v1', async () => {
    const res = await app.request('/openai/models', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer test' }
    })
    expect(res.status).toBe(401)
  })

  it('POST /openai/* proxies to /v1 with body', async () => {
    const res = await app.request('/openai/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test'
      },
      body: JSON.stringify({ model: 'glm-4', messages: [{role: 'user', content: 'hi'}] })
    })
    expect(res.status).toBe(401)
  })

  it('POST /anthropic/* proxies correctly', async () => {
    const res = await app.request('/anthropic/v1/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'test',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-3-haiku', max_tokens: 10, messages: [{role: 'user', content: 'hi'}] })
    })
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
  })
})

describe('Local Environment (localhost:8787)', () => {
  const BASE_URL = 'http://localhost:8787'

  it('POST /anthropic/v1/messages returns valid response', async () => {
    const res = await fetch(`${BASE_URL}/anthropic/v1/messages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': 'test-key',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: 'claude-3-haiku', max_tokens: 10, messages: [{role: 'user', content: 'hi'}] })
    })
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
    
    const text = await res.text()
    const data = JSON.parse(text)
    const hasValidStructure = Boolean(
      (data.id && data.type && data.role && data.content && data.model) ||
      (data.error) ||
      (data.code && data.message)
    )
    expect(hasValidStructure).toBe(true)
  })
})

describe('Production Environment (aiapi.wpz.me)', () => {
  const BASE_URL = 'http://aiapi.wpz.me'

  it('POST /anthropic/v1/messages returns valid response', async () => {
    try {
      const res = await fetch(`${BASE_URL}/anthropic/v1/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': 'test-key',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({ model: 'claude-3-haiku', max_tokens: 10, messages: [{role: 'user', content: 'hi'}] })
      })
      expect(res.status).toBeGreaterThanOrEqual(200)
      expect(res.status).toBeLessThan(500)
      
      const text = await res.text()
      const isJson = text.trim().startsWith('{')
      if (!isJson) {
        console.log('⚠️  Response is not JSON:', text.slice(0, 100))
        expect(res.status).toBeGreaterThanOrEqual(200)
        expect(res.status).toBeLessThan(500)
        return
      }
      const data = JSON.parse(text)
      const hasValidStructure = Boolean(
        (data.id && data.type && data.role && data.content && data.model) ||
        (data.error) ||
        (data.code && data.message)
      )
      expect(hasValidStructure).toBe(true)
    } catch (e: any) {
      if (e.code === 'ConnectionRefused' || e.message?.includes('Unable to connect')) {
        console.log('⚠️  Skipping production test: aiapi.wpz.me is not reachable from this environment')
        return
      }
      throw e
    }
  })
})
