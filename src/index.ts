import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Anthropic API proxy (root path)
app.all('/*', async (c) => {
  const path = c.req.path
  const targetUrl = `http://68.64.176.66${path}`

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

// OpenAI API proxy
app.all('/openai/*', async (c) => {
  const path = c.req.path.replace('/openai', '/v1')
  const targetUrl = `http://68.64.176.66${path}`

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
