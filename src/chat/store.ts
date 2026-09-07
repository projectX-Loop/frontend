/**
 * 채팅 스레드 저장소 — plan당 스레드 하나(세션 없음). ERD `plan_explanation`과 맞춘 모양
 * (kind=EXPLANATION/QUESTION, 세션 테이블 없이 plan_id로 직접 그룹핑) — 9/5 도윤·성종현 확정.
 * 지금은 localStorage뿐이지만, 백엔드 붙으면 이 파일 내부만 교체할 수 있게 함수 모양을 유지한다.
 *
 * AI 응답 생성 자체는 여전히 stateless다(ai-service /rag/ask는 매번 독립 호출) — 이 저장소는
 * 순전히 "질문·답변을 보여주는 스레드"이지, 모델에게 넘기는 대화 맥락 자체가 아니다.
 */

export interface ChatMessage {
  id: string
  question: string
  answer: string | null
  status: 'loading' | 'done' | 'failed'
  message: string | null
  createdAt: string
}

const KEY = (publicId: string) => `loop_chat_v2_${publicId}`

function readAll(publicId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(KEY(publicId))
    return raw ? (JSON.parse(raw) as ChatMessage[]) : []
  } catch {
    return []
  }
}

function writeAll(publicId: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(KEY(publicId), JSON.stringify(messages))
  } catch {
    // 저장 실패(프라이빗 모드 등)는 무시 — 화면 동작에는 영향 없음, 새로고침하면 사라질 뿐
  }
}

export const chatStore = {
  list(publicId: string): ChatMessage[] {
    return readAll(publicId)
  },

  appendMessage(publicId: string, message: ChatMessage) {
    const messages = readAll(publicId)
    messages.push(message)
    writeAll(publicId, messages)
  },

  updateMessage(publicId: string, messageId: string, patch: Partial<ChatMessage>) {
    const messages = readAll(publicId)
    const m = messages.find((x) => x.id === messageId)
    if (!m) return
    Object.assign(m, patch)
    writeAll(publicId, messages)
  },
}
