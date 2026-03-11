import OpenAI from 'openai'
import { OPENAI_API_KEY } from './constants'

const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: 'https://sub2api.wpz.me/v1',
})

const response = await client.responses.create({
    model: 'glm-4.7',
    input: 'hi',
})

console.log(response)
