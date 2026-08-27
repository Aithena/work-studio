<template>
  <div class="activity" :class="{ embedded }">
    <div class="board">
      <!-- <aside class="overview">
        <div class="overview-title">本月概览</div>
        <div class="metrics">
          <div class="metric">
            <span class="dot green" />
            <div class="num">{{ month.recordDays }}</div>
            <div class="label">记录天数</div>
          </div>
          <div class="metric">
            <span class="dot purple" />
            <div class="num">{{ month.recordCount }}</div>
            <div class="label">总记录数</div>
          </div>
          <div class="metric">
            <span class="dot orange" />
            <div class="num">{{ month.wordCount }}</div>
            <div class="label">总字数</div>
          </div>
        </div>
      </aside> -->

      <div class="heatmap">
        <div class="months" :style="{ gridTemplateColumns: monthGrid }">
          <span
            v-for="(label, index) in monthLabels"
            :key="`${label.text}-${index}`"
            class="month"
            :style="{ gridColumn: label.col }"
          >
            {{ label.text }}
          </span>
        </div>

        <div class="body">
          <div class="weekdays">
            <span>一</span>
            <span />
            <span>三</span>
            <span />
            <span>五</span>
            <span />
            <span>日</span>
          </div>
          <div class="grid" :style="{ gridTemplateColumns: `repeat(${weekCount}, 11px)` }">
            <button
              v-for="cell in cells"
              :key="cell.day"
              type="button"
              class="cell"
              :class="`lv-${cell.level}`"
              :title="cell.title"
              :style="{ gridColumn: cell.week + 1, gridRow: cell.weekday + 1 }"
            />
          </div>
        </div>

        <div class="footer">
          <span class="hint">近一年 · 每天记录情况</span>
          <div class="legend">
            <span>少</span>
            <i class="cell lv-0" />
            <i class="cell lv-1" />
            <i class="cell lv-2" />
            <i class="cell lv-3" />
            <i class="cell lv-4" />
            <span>多</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { fetchActivity, type ActivityDay, type MonthOverview } from '../api/activity'

type Cell = {
  day: string
  count: number
  level: number
  week: number
  weekday: number
  title: string
}

withDefaults(
  defineProps<{
    embedded?: boolean
  }>(),
  { embedded: false },
)

const emit = defineEmits<{
  loaded: []
}>()

const days = ref<ActivityDay[]>([])
const month = ref<MonthOverview>({
  recordDays: 0,
  recordCount: 0,
  wordCount: 0,
})
let timer: ReturnType<typeof setInterval> | null = null

function levelOf(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 10) return 3
  return 4
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday-first: Mon=0 ... Sun=6 */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

const cells = computed<Cell[]>(() => {
  if (days.value.length === 0) return []
  const first = parseDay(days.value[0].day)
  const startWeekday = mondayIndex(first)
  return days.value.map((item, index) => {
    const offset = startWeekday + index
    return {
      day: item.day,
      count: item.count,
      level: levelOf(item.count),
      week: Math.floor(offset / 7),
      weekday: offset % 7,
      title: `${item.day} · ${item.count} 次记录`,
    }
  })
})

const weekCount = computed(() => {
  if (cells.value.length === 0) return 53
  return Math.max(...cells.value.map((cell) => cell.week)) + 1
})

const monthLabels = computed(() => {
  const labels: { text: string; col: number }[] = []
  let lastMonth = -1
  for (const cell of cells.value) {
    const date = parseDay(cell.day)
    const m = date.getMonth()
    if (m === lastMonth) continue
    lastMonth = m
    labels.push({
      text: `${m + 1}月`,
      col: cell.week + 1,
    })
  }
  return labels
})

const monthGrid = computed(() => `repeat(${weekCount.value}, 11px)`)

async function load() {
  try {
    const data = await fetchActivity(371)
    days.value = data.days
    month.value = data.month
    emit('loaded')
  } catch {
    // keep previous
  }
}

onMounted(() => {
  void load()
  timer = setInterval(() => void load(), 30_000)
  window.addEventListener('focus', load)
  window.addEventListener('workbench:activity', load)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('focus', load)
  window.removeEventListener('workbench:activity', load)
})

defineExpose({ reload: load })
</script>

<style scoped lang="less">
.activity {
  flex-shrink: 0;
  padding: 14px 24px 16px;
  background: var(--color-surface);
  overflow-x: auto;

  &.embedded {
    padding: 4px 0 8px;
    background: transparent;
  }
}

.board {
  position: relative;
  display: flex;
  padding-left: 0px;
  min-width: max-content;
  box-sizing: border-box;
}

.overview {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 152px;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f4f4f2;
  display: flex;
  flex-direction: column;
}

.overview-title {
  flex-shrink: 0;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.metrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  min-height: 0;
  gap: 4px;
}

.metric {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.green {
    background: #34c759;
  }

  &.purple {
    background: #7c6cff;
  }

  &.orange {
    background: #f5a623;
  }
}

.num {
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  color: var(--color-text);
  min-width: 1.2em;
}

.label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.heatmap {
  flex: 1;
  min-width: 0;
}

.months {
  display: grid;
  gap: 3px;
  margin: 0 0 6px 18px;
  height: 14px;
  min-width: max-content;
}

.month {
  font-size: 10px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

.body {
  display: flex;
  gap: 6px;
  min-width: max-content;
}

.weekdays {
  display: grid;
  grid-template-rows: repeat(7, 11px);
  gap: 3px;
  width: 12px;
  font-size: 10px;
  line-height: 11px;
  color: var(--color-text-tertiary);
}

.grid {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 11px);
  gap: 3px;
}

.cell {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 0;
  padding: 0;
  display: block;
  background: #ebedf0;
}

.lv-1 {
  background: #9be9a8;
}

.lv-2 {
  background: #40c463;
}

.lv-3 {
  background: #30a14e;
}

.lv-4 {
  background: #216e39;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  margin-left: 18px;
  min-width: max-content;
  gap: 16px;
}

.hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--color-text-tertiary);

  .cell {
    width: 11px;
    height: 11px;
  }
}
</style>
