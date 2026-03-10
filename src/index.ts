import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hello Hono!'))



app.all('/openai/*', async (c) => {
  const method = c.req.method
  const body = method !== 'GET' && method !== 'HEAD' ? await c.req.text() : undefined
  const target = `http://68.64.176.66/v1${c.req.path.replace('/openai', '')}`
  const headers = new Headers(c.req.raw.headers)
  headers.delete('host')
  const res = await fetch(target, { method, headers, body })
  return new Response(res.body, { status: res.status, headers: res.headers })
})
app.all('/*', async (c) => {
  const method = c.req.method
  const body = method !== 'GET' && method !== 'HEAD' ? await c.req.text() : undefined
  const target = `http://68.64.176.66${c.req.path}`
  const headers = new Headers(c.req.raw.headers)
  headers.delete('host')
  const res = await fetch(target, { method, headers, body })
  return new Response(res.body, { status: res.status, headers: res.headers })
})
export default app
