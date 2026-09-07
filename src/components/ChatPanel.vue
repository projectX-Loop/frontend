<script setup lang="ts">
/**
 * 채팅 패널 — KAN-24. plan당 대화 스레드 하나(세션 목록·CRUD 없음) — ERD `plan_explanation`과
 * 맞춘 범위 축소(9/5 도윤·성종현 확정: 세션 테이블 없이 plan_id로 바로 그룹핑).
 *
 * 스레드는 plan.public_id로 스코프(로그인 없음). 지금은 localStorage(chat/store.ts)뿐이라
 * 새로고침해도 남지만 다른 브라우저·기기에선 안 보인다 — 백엔드 붙으면 store.ts 내부만 교체 예정.
 *
 * 멀티턴 — 이전 대화 맥락은 서버가 plan_explanation에 저장된 최근 질문·답변에서 직접 재구성한다
 * (9/6 결정, docs/plan-rag-design.md). 프론트는 history를 안 만들고 질문만 보낸다 — 새로고침해도
 * (이 localStorage 표시용 사본이 날아가도) 서버가 기억하는 대화 맥락 자체는 그대로 유지된다.
 */
import { onMounted, ref, watch } from 'vue'
import { api } from '../api/client'
import { chatStore, type ChatMessage } from '../chat/store'

const props = defineProps<{ publicId: string }>()

const messages = ref<ChatMessage[]>([])
const question = ref('')
const sending = ref(false)

function refresh() {
  messages.value = chatStore.list(props.publicId)
}

async function send() {
  const q = question.value.trim()
  if (!q || sending.value) return
  const msgId = `${Date.now()}`
  chatStore.appendMessage(props.publicId, {
    id: msgId, question: q, answer: null, status: 'loading', message: null, createdAt: new Date().toISOString(),
  })
  question.value = ''
  sending.value = true
  refresh()
  try {
    const r = await api.ask(props.publicId, q)
    if (r.status === 'OK' && r.answer) {
      chatStore.updateMessage(props.publicId, msgId, { status: 'done', answer: r.answer.text })
    } else {
      chatStore.updateMessage(props.publicId, msgId, { status: 'failed', message: r.message ?? '답변을 생성하지 못했습니다.' })
    }
  } catch {
    chatStore.updateMessage(props.publicId, msgId, { status: 'failed', message: '서버에 연결할 수 없습니다.' })
  } finally {
    sending.value = false
    refresh()
  }
}

onMounted(refresh)
watch(() => props.publicId, refresh)
</script>

<template>
  <div class="card chat-thread">
    <h2 style="margin-top:0">AI에게 물어보기</h2>
    <div v-for="m in messages" :key="m.id" class="chat-msg">
      <p class="chat-q">{{ m.question }}</p>
      <p v-if="m.status === 'loading'" class="muted small">생성 중…</p>
      <p v-else-if="m.status === 'done'" class="chat-a">{{ m.answer }}</p>
      <div v-else class="banner warn">{{ m.message }}</div>
    </div>
    <p v-if="!messages.length" class="muted small">이 plan의 계산 결과·AI 설명만 근거로 답합니다. 궁금한 점을 물어보세요.</p>

    <div style="display:flex;gap:8px;margin-top:12px">
      <input v-model="question" :disabled="sending" @keydown.enter="send" placeholder="예: 분기별로 하면 얼마나 모여?" style="flex:1" />
      <button @click="send" :disabled="sending || !question.trim()">{{ sending ? '생성 중…' : '질문' }}</button>
    </div>
  </div>
</template>
