import { apiClient } from './apiClient'
import type { CopilotChatRequest, CopilotChatResponse } from '@/types/copilot'

export const copilotService = {
  async sendMessage(payload: CopilotChatRequest): Promise<CopilotChatResponse> {
    return apiClient<CopilotChatResponse>('/api/v1/ai/copilot', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
}
