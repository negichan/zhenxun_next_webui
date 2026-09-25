<template>
    <!-- canvas-confetti 自动按需在 document.body 渲染全屏高性能 Canvas 并在结束时自动释放 -->
</template>

<script setup lang="ts">
import { ZXConfetti } from './index'
import type { ZXConfettiExposed, ZXConfettiOptions } from './types'

function launch(x: number, y: number, options?: ZXConfettiOptions): void {
    ZXConfetti({ x, y, ...options })
}

function clear(): void {
    ZXConfetti.clear()
}

defineExpose<ZXConfettiExposed>({
    launch,
    clear,
})
</script>
