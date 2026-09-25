<script setup lang="ts">
import { Coins, Heart, Edit2 } from 'lucide-vue-next'
import type { GroupMember, MemberDetail } from '@/types/manage.types'

const props = defineProps<{
    member: GroupMember | MemberDetail
}>()

const emit = defineEmits<{
    (e: 'edit', member: GroupMember | MemberDetail): void
}>()

// 编辑成员数据
const handleEdit = () => {
    emit('edit', props.member)
}
</script>

<template>
    <div
        class="member bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-300 hover:shadow-md"
    >
        <div class="p-4 flex items-center gap-3">
            <!-- 头像 -->
            <ZxAvatar
                :src="(member as any).ava_url"
                :name="(member as any).nickname || (member as any).remark"
                size="md"
                class="flex-shrink-0 border border-slate-200"
            />

            <!-- 信息 -->
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <h4 class="text-sm font-semibold text-zx-text-strong truncate" :title="(member as any).nickname || (member as any).remark">
                        {{ (member as any).nickname || (member as any).remark }}
                    </h4>
                    <ZxTag
                        v-if="(member as GroupMember).role === 'owner'"
                        variant="danger"
                    >
                        群主
                    </ZxTag>
                    <ZxTag
                        v-else-if="(member as GroupMember).role === 'admin'"
                        variant="info"
                    >
                        管理
                    </ZxTag>
                </div>
                <div class="flex items-center gap-3 mt-1">
                    <!-- 金币 -->
                    <span
                        v-if="'gold' in member"
                        class="inline-flex items-center gap-1 text-xs text-amber-600 font-medium"
                    >
                        <Coins class="w-3 h-3" />
                        {{ (member as MemberDetail).gold }}
                    </span>
                    <!-- 好感度 -->
                    <span
                        v-if="'favorability' in member"
                        class="inline-flex items-center gap-1 text-xs text-pink-600 font-medium"
                    >
                        <Heart class="w-3 h-3" />
                        {{ (member as MemberDetail).favorability }}
                    </span>
                    <!-- 群名片 -->
                    <span
                        v-if="'remark' in member && (member as GroupMember).remark"
                        class="text-xs text-zx-text-subtle truncate max-w-[100px]"
                    >
                        {{ (member as GroupMember).remark }}
                    </span>
                </div>
            </div>

            <!-- 编辑按钮 -->
            <button
                @click="handleEdit"
                class="p-2 rounded-2xl hover:bg-gray-100 transition-colors btn-touch flex-shrink-0"
                title="编辑成员数据"
            >
                <Edit2 class="w-4 h-4 text-zx-text-muted" />
            </button>
        </div>
    </div>
</template>
