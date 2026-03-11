import { Hono, Context } from 'hono'

const app = new Hono()
const API_URL = 'https://sub2api.wpz.me'

async function proxyRequest(c: Context, pathPrefix: string, targetPrefix: string) {
  const url = new URL(c.req.url)
  // 替换路径前缀并保留 query 参数
  const newPath = url.pathname.replace(pathPrefix, targetPrefix)
  const targetUrl = `${API_URL}${newPath}${url.search}`

  // 构建新请求，复制原始请求的方法、Header 和 Body
  // 注意：必须移除 Host Header，否则 fetch 会使用原始请求的 Host 导致上游无法识别
  const headers = new Headers(c.req.raw.headers)
  headers.delete('Host')

  const newReq = new Request(targetUrl, {
    method: c.req.method,
    headers: headers,
    body: c.req.raw.body,
    redirect: 'manual', // 让 Worker 处理重定向（如果有）
  })

  return fetch(newReq)
}

app.all('/openai/*', (c) => proxyRequest(c, '/openai', '/v1'))
app.all('/anthropic/*', (c) => proxyRequest(c, '/anthropic', ''))
export default app
