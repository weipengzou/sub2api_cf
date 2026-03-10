import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Anthropic API proxy
app.all('/anthropic/*', async (c) => {
  const path = c.req.path.replace('/anthropic', '')
  const targetUrl = `https://ai.api.wpz.me${path}`

  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.raw.clone().arrayBuffer() : undefined,
  })

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
})

export default app
