# 1. 问题

当前 `src/index.ts` 中 `/openai/*` 与 `/anthropic/*` 两个路由处理器实现了几乎相同的代理请求构造与转发逻辑：构建目标 URL、复制并清理 Header、创建新的 `Request` 并 `fetch`。这种重复导致维护成本增加，未来若修改公共处理需要多处同步，容易产生遗漏与不一致。

## 1.1. **重复的代理构造逻辑**
- 位置：`src/index.ts` 第 6-25 行与第 26-42 行。
- 症状：两处代码都在做：解析 URL、按各自前缀改写路径、拼接上游地址、复制 header 并删除 `Host`、用原方法与 body 构造新 `Request`、`fetch` 转发。
- 影响：同类改动（例如统一追加/过滤 Header、重定向策略或错误处理）需要在两个处理器分别修改，增加出错概率。

示例（现状片段）：

```ts
// /openai/*
app.all('/openai/*', async (c) => {
  const url = new URL(c.req.url)
  const newPath = url.pathname.replace('/openai', '/v1')
  const targetUrl = `${API_URL}${newPath}${url.search}`

  const headers = new Headers(c.req.raw.headers)
  headers.delete('Host')

  const newReq = new Request(targetUrl, {
    method: c.req.method,
    headers: headers,
    body: c.req.raw.body,
    redirect: 'manual',
  })

  return fetch(newReq)
})

// /anthropic/*
app.all('/anthropic/*', async (c) => {
  const url = new URL(c.req.url)
  const newPath = url.pathname.replace('/anthropic', '')
  const targetUrl = `${API_URL}${newPath}${url.search}`

  const headers = new Headers(c.req.raw.headers)
  headers.delete('Host')

  const newReq = new Request(targetUrl, {
    method: c.req.method,
    headers: headers,
    body: c.req.raw.body,
    redirect: 'manual',
  })

  return fetch(newReq)
})
```

## 1.2. **路径映射规则分散且写死**
- 位置：同上，两处分别写死 `'/openai' -> '/v1'` 与 `'/anthropic' -> ''`。
- 问题：路径改写规则分散在多个处理器中，未来增加新 Provider 或调整规则时需要到处改动，难以在一处校验与测试。

## 1.3. **错误处理与策略难以复用**
- 位置：同上，均设置 `redirect: 'manual'`，未统一错误/日志策略。
- 问题：如果后续希望加入统一的错误捕获、重试或额外 Header 过滤策略，需要在多处植入，难以保持一致。

# 2. 收益

将通用的“目标 URL 构造 + Header 清理 + Request 生成与转发”收敛为单一辅助函数后，变更只需改一处，显著降低认知负担与改动风险。

## 2.1. **减少重复代码**
- 核心代理构造逻辑的实现点由两处收敛到一处，重复行数预计减少约 **10-12** 行（随具体抽取方式略有差异）。

## 2.2. **提升一致性与可测试性**
- 通用函数可单元测试（例如保留 query、删除 `Host`、保留方法与 body），避免在每个路由做集成级验证。

## 2.3. **更易扩展 Provider**
- 新增 Provider 仅需配置它的前缀改写规则与上游前缀，无需复制粘贴整段代理构造代码。

# 3. 方案

整体思路：抽取统一的代理辅助函数与路由处理器工厂，通过参数化“去除的路由前缀”和“上游前缀”来生成相同的代理流程。

## 3.1. **抽取通用辅助与处理器工厂：解决“重复的代理构造逻辑”和“路径映射写死且分散”**

### 方案概述
- 提供 `toTargetUrl(reqUrl, stripPrefix, upstreamPrefix)`：统一做路径前缀改写与 query 保留。
- 提供 `makeProxyRequest(originalReq, targetUrl)`：统一复制/清理 Header、保留方法与 body、设置 `redirect: 'manual'`。
- 提供 `makeProxyHandler({ stripPrefix, upstreamPrefix })`：路由处理器工厂，拼合上述两步并 `fetch`。

### 实施步骤
- 抽取辅助函数（可就地放在 `src/index.ts` 顶部或迁移到 `src/utils/proxy.ts`，保守变更可选择就地）。
- 用处理器工厂替换现有两条 `app.all` 定义。
- 保持现有行为（保留 query、删除 `Host`、保留方法与 body、`redirect: 'manual'`），暂不引入新的策略性变更。

### 修改前示例
见“问题”章节中的现状片段。

### 修改后示例（建议实现）

```ts
const API_URL = 'https://sub2api.wpz.me'

function toTargetUrl(reqUrl: string, stripPrefix: string, upstreamPrefix: string) {
  const url = new URL(reqUrl)
  const newPath = url.pathname.replace(stripPrefix, upstreamPrefix)
  return `${API_URL}${newPath}${url.search}`
}

function makeProxyRequest(originalReq: Request, targetUrl: string) {
  const headers = new Headers(originalReq.headers)
  headers.delete('Host')
  return new Request(targetUrl, {
    method: originalReq.method,
    headers,
    body: originalReq.body,
    redirect: 'manual',
  })
}

function makeProxyHandler(opts: { stripPrefix: string; upstreamPrefix: string }) {
  return async (c: any) => {
    const targetUrl = toTargetUrl(c.req.url, opts.stripPrefix, opts.upstreamPrefix)
    const newReq = makeProxyRequest(c.req.raw, targetUrl)
    return fetch(newReq)
  }
}

app.all('/openai/*', makeProxyHandler({ stripPrefix: '/openai', upstreamPrefix: '/v1' }))
app.all('/anthropic/*', makeProxyHandler({ stripPrefix: '/anthropic', upstreamPrefix: '' }))
```

### 说明
- 行为对齐：仍然保留原始方法与 body，保留 query，删除 `Host`，保持 `redirect: 'manual'`。
- 未来扩展：如需统一追加/过滤更多 Header、注入错误/日志策略或重试，可在 `makeProxyRequest` 或 `makeProxyHandler` 内集中实现，无需修改各路由。

# 4. 回归范围

本次为保守的结构性收敛，核心关注“行为不变”的回归：路径改写、Header 处理、方法与 body 保留、重定向策略与上游响应透传。按端到端业务流进行验证即可。

## 4.1. 主链路
- `/openai/*`：
  - 用 GET 携带 query（例如 `/openai/models?limit=10`）→ 确认改写为 `/v1/models?limit=10`，并成功转发。
  - 用 POST（JSON 或流式 body）→ 方法、`Content-Type`、body 原样保留；上游响应内容透传。
- `/anthropic/*`：
  - 用 GET 携带 query（例如 `/anthropic/messages?xx=yy`）→ 改写为 `/messages?xx=yy` 并成功转发。
  - 用 POST（JSON 或流式 body）→ 方法与 body 保留；响应透传。

## 4.2. 边界情况
- 重定向：上游返回 302/307 时，因 `redirect: 'manual'`，验证行为与现状一致（不由运行环境自动跟随）。
- 404/非存在路径：确保上游的 404、错误信息与 Header 透传，无额外包裹。
- 大体量请求体/流：确认在新实现下 body 未被提前读取或丢失。
- Header 处理：
  - `Host` 被删除；其它必要 Header（如 `Authorization`、`Content-Type`、`Accept`）保留。
  - 多值 Header（如 `Set-Cookie` 在响应侧）透传不变。
- 异常传播：网络错误/上游超时的行为与现状一致（可在后续迭代集中化错误捕获与日志）。
