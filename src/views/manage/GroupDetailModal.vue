<script setup lang="ts">
import { modalJelly } from "@/composables/useGsapTransition";
import { ref, computed, onMounted, watch } from 'vue'
import {
    Info,
    ToggleRight,
    Shield,
    Puzzle,
    Zap,
    Users,
    Coins,
    Heart,
    Search
} from 'lucide-vue-next'
import { ZXNotification } from '@/services/ui'
import { manageApi } from '@/utils/api-next'
import { useBotStore } from '@/store/bot'
import type { GroupDetailNew, GroupPlugin, GroupMember, MemberDetail, AnyMember } from '@/types/manage.types'
import MemberCard from '@/views/manage/components/MemberCard/MemberCard.vue'
import ZXInput from '@/components/zxcomponent/ZXInput.vue'
import ZxEmptyState from '@/components/zxcomponent/ZxEmptyState.vue'

const props = defineProps<{
    groupId: string
}>()

const emit = defineEmits<{
    close: []
    updated: []
}>()

const botStore = useBotStore()
const loading = ref(false)
const pluginsLoading = ref(false)
const membersLoading = ref(false)
const groupDetail = ref<GroupDetailNew | null>(null)
const plugins = ref<GroupPlugin[]>([])
const members = ref<AnyMember[]>([])
const memberSearchQuery = ref('')

const memberDetailDialogOpen = ref(false)
const currentMember = ref<GroupMember | null>(null)
const currentMemberDetail = ref<MemberDetail | null>(null)
const memberForm = ref({
    gold: 0,
    favorability: 0
})

const roleMap: Record<string, string> = {
    owner: '群主',
    admin: '管理员',
    member: '成员'
}

const pluginCount = computed(() => plugins.value.filter(p => !p.is_task).length)
const taskCount = computed(() => plugins.value.filter(p => p.is_task).length)

const filteredMembers = computed(() => {
    if (!memberSearchQuery.value) return members.value
    const query = memberSearchQuery.value.toLowerCase()
    return members.value.filter(
        m =>
            m.nickname.toLowerCase().includes(query) ||
            m.user_id.toLowerCase().includes(query) ||
            (m.remark && m.remark.toLowerCase().includes(query))
    )
})

const loadGroupDetail = async () => {
    loading.value = true
    try {
        const botId = botStore.getSelectedBotId() || undefined
        const res = await manageApi.getGroupDetail(props.groupId, botId)
        if (res.success && res.data) {
            groupDetail.value = res.data
        } else {
            ZXNotification({
                title: '呜呼~',
                message: '加载群组详情失败了 (っ °Д °;) っ',
                type: 'error',
                position: 'top-right'
            })
        }
    } catch (error) {
        console.error('加载群组详情失败:', error)
        ZXNotification({
            title: '呜呼~',
            message: '加载群组详情失败了 (っ °Д °;) っ',
            type: 'error',
            position: 'top-right'
        })
    } finally {
        loading.value = false
    }
}

const loadPlugins = async () => {
    pluginsLoading.value = true
    try {
        const res = await manageApi.getGroupPlugins(props.groupId)
        if (res.success && res.data) {
            plugins.value = res.data
        }
    } catch (error) {
        console.error('加载插件列表失败:', error)
        ZXNotification({
            title: '呜呼~',
            message: '加载插件列表失败了 (っ °Д °;) っ',
            type: 'error',
            position: 'top-right'
        })
    } finally {
        pluginsLoading.value = false
    }
}

const loadMembers = async () => {
    membersLoading.value = true
    try {
        const botId = botStore.getSelectedBotId() || undefined
        const res = await manageApi.getGroupMembers(props.groupId, botId)
        if (res.success && res.data) {
            members.value = res.data
        }
    } catch (error) {
        console.error('加载成员列表失败:', error)
        ZXNotification({
            title: '呜呼~',
            message: '加载成员列表失败了 (っ °Д °;) っ',
            type: 'error',
            position: 'top-right'
        })
    } finally {
        membersLoading.value = false
    }
}

const updateGroupStatus = async () => {
    if (!groupDetail.value) return
    try {
        await manageApi.updateGroup({
            group_id: groupDetail.value.group_id,
            status: groupDetail.value.status,
            is_super: groupDetail.value.is_super,
            block_task: groupDetail.value.block_task,
            block_plugin: groupDetail.value.block_plugin
        })
        ZXNotification({
            title: '成功啦~',
            message: '群组设置更新成功 ♪(´▽｀)',
            type: 'success',
            position: 'top-right'
        })
        emit('updated')
    } catch (error) {
        console.error('更新群组设置失败:', error)
        ZXNotification({
            title: '对不起',
            message: '群组设置更新失败了 (´；ω；`)',
            type: 'error',
            position: 'top-right'
        })
        loadGroupDetail()
    }
}

const togglePlugin = async (plugin: GroupPlugin) => {
    try {
        await manageApi.toggleGroupPlugin({
            group_id: props.groupId,
            module: plugin.module,
            action: plugin.is_blocked ? 'block' : 'unblock',
            is_task: plugin.is_task
        })
        ZXNotification({
            title: '成功啦~',
            message: '插件状态更新成功 ♪(´▽｀)',
            type: 'success',
            position: 'top-right'
        })
        emit('updated')
    } catch (error) {
        console.error('切换插件状态失败:', error)
        ZXNotification({
            title: '对不起',
            message: '插件状态更新失败了 (´；ω；`)',
            type: 'error',
            position: 'top-right'
        })
        plugin.is_blocked = !plugin.is_blocked
    }
}

const viewMemberDetail = async (member: GroupMember | MemberDetail) => {
    currentMember.value = member as GroupMember
    memberDetailDialogOpen.value = true

    try {
        const res = await manageApi.getMemberDetail(member.user_id, props.groupId)
        if (res.success && res.data) {
            currentMemberDetail.value = res.data
            memberForm.value.gold = res.data.gold
            memberForm.value.favorability = res.data.favorability
        }
    } catch (error) {
        console.error('加载成员详情失败:', error)
        ZXNotification({
            title: '呜呼~',
            message: '加载成员详情失败了 (っ °Д °;) っ',
            type: 'error',
            position: 'top-right'
        })
    }
}

const saveMemberData = async () => {
    if (!currentMember.value) return
    try {
        await manageApi.updateMember({
            user_id: currentMember.value.user_id,
            group_id: props.groupId,
            gold: memberForm.value.gold,
            favorability: memberForm.value.favorability
        })
        ZXNotification({
            title: '成功啦~',
            message: '成员数据更新成功 ♪(´▽｀)',
            type: 'success',
            position: 'top-right'
        })
    } catch (error) {
        console.error('更新成员数据失败:', error)
        ZXNotification({
            title: '对不起',
            message: '成员数据更新失败了 (´；ω；`)',
            type: 'error',
            position: 'top-right'
        })
    }
}

watch(() => props.groupId, () => {
    loadGroupDetail()
    loadPlugins()
    loadMembers()
})

onMounted(() => {
    loadGroupDetail()
    loadPlugins()
    loadMembers()
})
</script>

<template>
    <div class="group-detail space-y-4">
        <div v-if="groupDetail" class="space-y-4">
            <!-- 基本信息卡片 -->
            <div>
                <h3 class="text-base font-bold text-zx-text-strong mb-3 flex items-center gap-2">
                    <Info class="w-5 h-5 text-zx-primary" />
                    基本信息
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div class="bg-slate-50 rounded-2xl p-3">
                        <p class="text-xs text-zx-text-muted mb-1">群组名称</p>
                        <p class="font-semibold text-zx-text-strong truncate text-sm" :title="groupDetail.group_name">
                            {{ groupDetail.group_name }}
                        </p>
                    </div>
                    <div class="bg-slate-50 rounded-2xl p-3">
                        <p class="text-xs text-zx-text-muted mb-1">群组 ID</p>
                        <p class="font-semibold text-zx-text-strong font-mono text-xs">{{ groupDetail.group_id }}</p>
                    </div>
                    <div class="bg-slate-50 rounded-2xl p-3">
                        <p class="text-xs text-zx-text-muted mb-1">成员数量</p>
                        <p class="font-semibold text-zx-text-strong text-sm">
                            {{ groupDetail.member_count }} / {{ groupDetail.max_member_count }}
                        </p>
                    </div>
                    <div class="bg-slate-50 rounded-2xl p-3">
                        <p class="text-xs text-zx-text-muted mb-1">群权限等级</p>
                        <p class="font-semibold text-zx-text-strong flex items-center justify-center gap-1 text-sm">
                            <Shield class="w-4 h-4 text-zx-primary" />
                            {{ groupDetail.level }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- 群开关设置 -->
            <div>
                <h3 class="text-base font-bold text-zx-text-strong mb-3 flex items-center gap-2">
                    <ToggleRight class="w-5 h-5 text-zx-primary" />
                    群开关设置
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div
                        class="switch-card rounded-2xl p-3 border-2 transition-all"
                        :class="groupDetail.status
                            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'"
                    >
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-zx-text-muted">群状态</span>
                            <ZxSwitch v-model="groupDetail.status" @change="updateGroupStatus" />
                        </div>
                        <p class="text-xs" :class="groupDetail.status ? 'text-green-600' : 'text-zx-text-subtle'">
                            {{ groupDetail.status ? '已启用' : '已禁用' }}
                        </p>
                    </div>

                    <div
                        class="switch-card rounded-2xl p-3 border-2 transition-all"
                        :class="groupDetail.is_super
                            ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'"
                    >
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-zx-text-muted">超级用户指定</span>
                            <ZxSwitch v-model="groupDetail.is_super" @change="updateGroupStatus" />
                        </div>
                        <p class="text-xs" :class="groupDetail.is_super ? 'text-purple-600' : 'text-zx-text-subtle'">
                            {{ groupDetail.is_super ? '已开启' : '已关闭' }}
                        </p>
                    </div>

                    <div
                        class="switch-card rounded-2xl p-3 border-2 transition-all"
                        :class="!groupDetail.block_task
                            ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200'
                            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'"
                    >
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-zx-text-muted">被动任务</span>
                            <ZxSwitch v-model="groupDetail.block_task" @change="updateGroupStatus" />
                        </div>
                        <p class="text-xs" :class="groupDetail.block_task ? 'text-zx-text-subtle' : 'text-blue-600'">
                            {{ groupDetail.block_task ? '已禁用' : '已启用' }}
                        </p>
                    </div>

                    <div
                        class="switch-card rounded-2xl p-3 border-2 transition-all"
                        :class="!groupDetail.block_plugin
                            ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                            : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'"
                    >
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-xs font-medium text-zx-text-muted">插件功能</span>
                            <ZxSwitch v-model="groupDetail.block_plugin" @change="updateGroupStatus" />
                        </div>
                        <p class="text-xs" :class="groupDetail.block_plugin ? 'text-zx-text-subtle' : 'text-orange-600'">
                            {{ groupDetail.block_plugin ? '已禁用' : '已启用' }}
                        </p>
                    </div>
                </div>
            </div>

            <!-- 功能开关列表 -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-base font-bold text-zx-text-strong flex items-center gap-2">
                        <Puzzle class="w-5 h-5 text-zx-primary" />
                        功能开关
                    </h3>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-zx-text-muted">插件：<span class="font-medium text-zx-text-muted">{{ pluginCount }}</span></span>
                        <span class="text-xs text-zx-text-muted">|</span>
                        <span class="text-xs text-zx-text-muted">被动：<span class="font-medium text-zx-text-muted">{{ taskCount }}</span></span>
                    </div>
                </div>
                <div class="plugin-list relative min-h-[120px] max-h-80 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-2">
                    <div v-if="pluginsLoading" class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60">
                        <span class="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-zx-primary"></span>
                    </div>
                    <template v-if="plugins.length > 0">
                        <div
                            v-for="plugin in plugins"
                            :key="plugin.module"
                            class="plugin-item flex items-center justify-between p-3 rounded-2xl transition-colors"
                            :class="plugin.is_blocked
                                ? 'bg-red-50 outline-1 outline-red-200'
                                : 'bg-white border border-slate-200'"
                        >
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                <div
                                    class="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                                    :class="plugin.is_task ? 'bg-slate-100' : 'bg-slate-100'"
                                >
                                    <component
                                        :is="plugin.is_task ? Zap : Puzzle"
                                        class="w-4 h-4"
                                        :class="plugin.is_task ? 'text-zx-primary' : 'text-zx-primary'"
                                    />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium text-zx-text-strong text-sm truncate">
                                            {{ plugin.plugin_name }}
                                        </span>
                                        <span
                                            v-if="plugin.is_task"
                                            class="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zx-primary-soft text-zx-primary flex-shrink-0"
                                        >
                                            被动
                                        </span>
                                    </div>
                                    <span class="text-xs text-zx-text-subtle font-mono">{{ plugin.module }}</span>
                                </div>
                            </div>
                            <ZxSwitch
                                v-model="plugin.is_blocked"
                                :disabled="!plugin.module"
                                @change="() => togglePlugin(plugin)"
                            />
                        </div>
                    </template>
                    <ZxEmptyState
                        v-else
                        size="sm"
                        text="暂无插件"
                    />
                </div>
            </div>

            <!-- 群成员列表 -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-base font-bold text-zx-text-strong flex items-center gap-2">
                        <Users class="w-5 h-5 text-zx-primary" />
                        群成员管理
                    </h3>
                    <span class="text-xs text-zx-text-muted">共 {{ filteredMembers.length }} 人</span>
                </div>

                <!-- 搜索框 -->
                <div class="mb-3">
                    <ZXInput
                        v-model="memberSearchQuery"
                        type="search"
                        placeholder="搜索成员..."
                        rounded="2xl"
                    />
                </div>

                <div class="member-list relative min-h-[120px] max-h-80 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-2">
                    <div v-if="membersLoading" class="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/60">
                        <span class="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-zx-primary"></span>
                    </div>
                    <template v-if="filteredMembers.length > 0">
                        <div class="space-y-2">
                            <MemberCard
                                v-for="member in filteredMembers"
                                :key="member.user_id"
                                :member="member"
                                @edit="(m) => viewMemberDetail(m)"
                            />
                        </div>
                    </template>
                    <ZxEmptyState
                        v-else
                        size="sm"
                        text="暂无成员"
                    />
                </div>
            </div>
        </div>

        <!-- 成员详情对话框 -->
        <Teleport to="body">
            <Transition :css="false" @enter="modalJelly.onEnter" @leave="modalJelly.onLeave">
                <div v-if="memberDetailDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <!-- 背景遮罩 -->
                    <div class="fixed inset-0 glass-overlay" @click="memberDetailDialogOpen = false"></div>

                    <!-- 对话框 -->
                    <div class="modal-content relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
                    <!-- 头部 -->
                    <div class="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
                        <h3 class="text-lg font-semibold text-zx-text-strong">成员详情</h3>
                        <button @click="memberDetailDialogOpen = false" class="p-1 rounded-2xl hover:bg-white/50 transition-colors">
                            <svg class="w-5 h-5 text-zx-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>

                    <!-- 内容区 -->
                    <div class="flex-1 overflow-y-auto p-6">
                        <div v-if="currentMember" class="member-detail">
                            <div class="member-detail-header bg-slate-50 rounded-2xl p-4 mb-4">
                                <ZxAvatar :src="currentMemberDetail?.ava_url || currentMember.ava_url" :name="currentMember.nickname" size="xl" class="member-avatar-large" />
                                <div class="member-detail-info flex-1 min-w-0">
                                    <h4 class="member-detail-name truncate">{{ currentMember.nickname }}</h4>
                                    <p class="member-detail-remark truncate">{{ currentMember.remark || currentMember.nickname }}</p>
                                    <p class="member-detail-id font-mono">{{ currentMember.user_id }}</p>
                                </div>
                            </div>

                            <div class="space-y-3">
                                <!-- 金币 -->
                                <div class="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-2">
                                            <Coins class="w-4 h-4 text-zx-primary" />
                                            <span class="text-xs font-medium text-zx-text-muted">金币数量</span>
                                        </div>
                                        <ZxInputNumber
                                            v-model="memberForm.gold"
                                            :min="0"
                                            :step="100"
                                            class="bg-white"
                                        />
                                    </div>
                                </div>

                                <!-- 好感度 -->
                                <div class="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <Heart class="w-4 h-4 text-zx-primary" />
                                            <span class="text-xs font-medium text-zx-text-muted">好感度/权限等级</span>
                                        </div>
                                        <ZxInputNumber
                                            v-model="memberForm.favorability"
                                            :min="0"
                                            :step="10"
                                            class="bg-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 底部操作栏 -->
                    <div class="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
                        <ZxButton variant="ghost" @click="memberDetailDialogOpen = false">取消</ZxButton>
                        <ZxButton @click="saveMemberData">保存</ZxButton>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.switch-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.member-detail {
    padding: 0;
}

.member-detail-header {
    display: flex;
    align-items: center;
    gap: 12px;
}

.member-avatar-large {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--zx-color-primary) 22%, transparent);
    flex-shrink: 0;
}

.member-detail-name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--zx-color-text-strong);
}

.member-detail-remark {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--zx-color-text-muted);
}

.member-detail-id {
    margin: 2px 0 0;
    font-size: 11px;
    color: #9ca3af;
}
</style>