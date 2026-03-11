import Anthropic from '@anthropic-ai/sdk'

import { API_KEY } from './constants'

const client = new Anthropic({
    apiKey: API_KEY,
    baseURL: 'https://aiapi.wpz.me/anthropic',
})

const response = await client.messages.create({
    model: 'glm-4.7',
    max_tokens: 1024,
    messages: [
        { role: 'user', content: 'hi' }
    ],
})

console.log(response.content)
