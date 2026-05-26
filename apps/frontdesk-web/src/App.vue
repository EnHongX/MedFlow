<template>
  <div class="page-container">
    <div class="page-header">
      <h1>MedFlow 前台</h1>
    </div>

    <el-row :gutter="20">
      <el-col :span="13">
        <el-card>
          <template #header>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-weight:600">当天预约列表</span>
              <el-form inline style="margin:0">
                <el-form-item style="margin:0">
                  <el-date-picker v-model="queryDate" type="date" value-format="YYYY-MM-DD" @change="refresh" size="small" style="width:150px" />
                </el-form-item>
                <el-form-item style="margin:0 0 0 8px">
                  <el-button size="small" @click="refresh">刷新</el-button>
                </el-form-item>
              </el-form>
            </div>
          </template>
          <el-table :data="appointments" border stripe size="small">
            <el-table-column label="患者" min-width="130">
              <template #default="{ row }">
                <div>{{ row.patient?.name }}</div>
                <div class="form-desc">{{ row.patient?.phone }}</div>
              </template>
            </el-table-column>
            <el-table-column label="医生" min-width="70">
              <template #default="{ row }">{{ row.schedule?.doctor?.user?.name }}</template>
            </el-table-column>
            <el-table-column label="时段" width="100">
              <template #default="{ row }">{{ row.schedule?.startTime }}-{{ row.schedule?.endTime }}</template>
            </el-table-column>
            <el-table-column label="状态" width="85">
              <template #default="{ row }">
                <el-tag v-if="row.status === 'BOOKED'" size="small">已预约</el-tag>
                <el-tag v-else-if="row.status === 'CHECKED_IN'" type="warning" size="small">已签到</el-tag>
                <el-tag v-else-if="row.status === 'CALLED'" type="primary" size="small">已叫号</el-tag>
                <el-tag v-else-if="row.status === 'IN_PROGRESS'" type="warning" size="small">接诊中</el-tag>
                <el-tag v-else-if="row.status === 'COMPLETED'" type="success" size="small">已完成</el-tag>
                <el-tag v-else-if="row.status === 'CANCELLED'" type="info" size="small">已取消</el-tag>
                <el-tag v-else type="info" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="75">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'BOOKED'"
                  type="success" size="small"
                  @click="checkin(row.id)"
                >签到</el-button>
                <span v-else style="color:#9ca3af">-</span>
              </template>
            </el-table-column>
          </el-table>
          <p v-if="!appointments.length" class="empty-state">当天暂无预约</p>
        </el-card>
      </el-col>

      <el-col :span="11">
        <el-card>
          <template #header>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-weight:600">当前候诊队列</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="header-badge" v-if="waitingQueue.length">{{ waitingQueue.length }}人</span>
                <el-button size="small" @click="fetchQueue">刷新</el-button>
              </div>
            </div>
          </template>
          <div class="queue-list" v-if="waitingQueue.length">
            <div v-for="item in waitingQueue" :key="item.id" class="queue-item" :class="'queue-item--' + item.status.toLowerCase()">
              <div class="queue-item__number">{{ item.queueNumber }}</div>
              <div class="queue-item__info">
                <div class="queue-item__name">{{ item.appointment?.patient?.name }}</div>
                <div class="queue-item__meta">
                  {{ item.appointment?.schedule?.doctor?.user?.name }}
                  <el-tag
                    v-if="item.status === 'WAITING'" type="warning" size="small"
                    style="margin-left:6px"
                  >候诊</el-tag>
                  <el-tag
                    v-else-if="item.status === 'CALLED'" type="primary" size="small"
                    style="margin-left:6px"
                  >已叫号</el-tag>
                  <el-tag
                    v-else-if="item.status === 'SKIPPED'" type="danger" size="small"
                    style="margin-left:6px"
                  >过号</el-tag>
                  <el-tag
                    v-else-if="item.status === 'IN_PROGRESS'" type="primary" size="small"
                    style="margin-left:6px"
                  >就诊中</el-tag>
                  <el-tag v-else type="success" size="small" style="margin-left:6px">完成</el-tag>
                  <span v-if="item.skipLogs?.length" style="margin-left:6px;color:#f56c6c;font-size:11px">过号{{ item.skipLogs.length }}次</span>
                </div>
              </div>
              <div class="queue-item__action">
                <el-button v-if="item.status === 'WAITING'" type="primary" size="small" @click="callPatient(item.id)">叫号</el-button>
                <el-button v-else-if="item.status === 'CALLED'" type="danger" size="small" @click="skipPatient(item.id)">过号</el-button>
                <el-button v-else-if="item.status === 'SKIPPED'" type="warning" size="small" @click="requeuePatient(item.id)">重排</el-button>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">暂无候诊患者</p>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top:20px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:600;color:#e6a23c">候补队列</span>
          <el-button size="small" @click="fetchWaitlistQueue">刷新</el-button>
        </div>
      </template>
      <el-table :data="waitlistQueue" border stripe size="small" v-if="waitlistQueue.length">
        <el-table-column label="患者" min-width="120">
          <template #default="{ row }">
            <div>{{ row.patient?.name }}</div>
            <div class="form-desc">{{ row.patient?.phone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="医生" min-width="80">
          <template #default="{ row }">{{ row.schedule?.doctor?.user?.name }}</template>
        </el-table-column>
        <el-table-column label="时段" width="105">
          <template #default="{ row }">{{ row.schedule?.startTime }}-{{ row.schedule?.endTime }}</template>
        </el-table-column>
        <el-table-column label="位置" width="65">
          <template #default="{ row }">#{{ row.position }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning" size="small">候补中</el-tag>
            <el-tag v-else-if="row.status === 'PROMOTED'" type="success" size="small">已转正</el-tag>
            <el-tag v-else-if="row.status === 'CANCELLED'" type="info" size="small">已取消</el-tag>
            <el-tag v-else-if="row.status === 'CLOSED'" type="danger" size="small">已关闭</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="145">
          <template #default="{ row }">{{ row.createdAt?.slice(0,16).replace('T',' ') }}</template>
        </el-table-column>
      </el-table>
      <p v-else class="empty-state">暂无候补患者</p>
    </el-card>

    <el-card style="margin-top:20px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:600;color:#f56c6c">待处理患者（停诊/替诊）</span>
          <el-button size="small" @click="fetchPendingFrontdesk">刷新</el-button>
        </div>
      </template>
      <el-table :data="pendingFrontdesk" border stripe size="small" v-if="pendingFrontdesk.length">
        <el-table-column label="患者" min-width="140">
          <template #default="{ row }">
            <div>{{ row.patient?.name }}</div>
            <div class="form-desc">{{ row.patient?.phone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="医生" min-width="80">
          <template #default="{ row }">{{ row.schedule?.doctor?.user?.name }}</template>
        </el-table-column>
        <el-table-column label="时段" width="110">
          <template #default="{ row }">{{ row.schedule?.startTime }}-{{ row.schedule?.endTime }}</template>
        </el-table-column>
        <el-table-column label="停诊原因" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.cancelReason }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button type="warning" size="small" @click="handlePending(row.id)">已处理</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="empty-state">暂无待处理患者</p>
    </el-card>

    <el-card style="margin-top:20px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:600;color:#e6a23c">变更审批（取消/改期）</span>
          <el-button size="small" @click="fetchChangeRequests">刷新</el-button>
        </div>
      </template>
      <el-table :data="changeRequests" border stripe size="small" v-if="changeRequests.length">
        <el-table-column label="患者" min-width="120">
          <template #default="{ row }">
            <div>{{ row.appointment?.patient?.name }}</div>
            <div class="form-desc">{{ row.appointment?.patient?.phone }}</div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'CANCEL'" type="danger" size="small">取消</el-tag>
            <el-tag v-else type="warning" size="small">改期</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前预约" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.appointment?.schedule?.doctor?.user?.name }} {{ row.appointment?.schedule?.date?.slice(0,10) }} {{ row.appointment?.schedule?.startTime }}-{{ row.appointment?.schedule?.endTime }}</template>
        </el-table-column>
        <el-table-column label="目标时段" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.targetSchedule">{{ row.targetSchedule?.doctor?.user?.name }} {{ row.targetSchedule?.date?.slice(0,10) }} {{ row.targetSchedule?.startTime }}-{{ row.targetSchedule?.endTime }}</span>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="145">
          <template #default="{ row }">{{ row.createdAt?.slice(0,16).replace('T',' ') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button type="success" size="small" @click="approveRequest(row.id)">批准</el-button>
            <el-button type="danger" size="small" @click="rejectRequest(row.id)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="empty-state">暂无待审批的变更请求</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const API = '/api';
const queryDate = ref(new Date().toLocaleDateString('sv-SE'));
const appointments = ref<any[]>([]);
const waitingQueue = ref<any[]>([]);
const pendingFrontdesk = ref<any[]>([]);
const changeRequests = ref<any[]>([]);
const waitlistQueue = ref<any[]>([]);

async function fetchAppointments() {
  try {
    const res = await fetch(`${API}/appointments?date=${queryDate.value}`);
    if (!res.ok) throw new Error((await res.json()).message || '获取预约列表失败');
    appointments.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法连接后端服务');
  }
}

async function fetchQueue() {
  try {
    const res = await fetch(`${API}/queue`);
    if (!res.ok) throw new Error((await res.json()).message || '获取队列失败');
    const all = await res.json() as any[];
    waitingQueue.value = all.filter(q => q.status !== 'COMPLETED');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取队列');
  }
}

async function refresh() {
  await Promise.all([fetchAppointments(), fetchQueue(), fetchPendingFrontdesk(), fetchChangeRequests(), fetchWaitlistQueue()]);
}

async function fetchPendingFrontdesk() {
  try {
    const res = await fetch(`${API}/appointments?status=PENDING_FRONTDESK`);
    if (!res.ok) throw new Error('获取待处理列表失败');
    pendingFrontdesk.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function handlePending(appointmentId: string) {
  try {
    const res = await fetch(`${API}/appointments/${appointmentId}/cancel`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true, reason: '停诊处理' }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '操作失败');
      return;
    }
    ElMessage.success('已处理');
    await fetchPendingFrontdesk();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function checkin(appointmentId: string) {
  try {
    const res = await fetch(`${API}/queue/checkin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '签到失败');
      return;
    }
    ElMessage.success('签到成功');
    await refresh();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function callPatient(entryId: string) {
  try {
    const res = await fetch(`${API}/queue/${entryId}/call`, { method: 'PATCH' });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '叫号失败');
      return;
    }
    ElMessage.success('叫号成功');
    await refresh();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function skipPatient(entryId: string) {
  try {
    const res = await fetch(`${API}/queue/${entryId}/skip`, { method: 'PATCH' });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '过号失败');
      return;
    }
    ElMessage.success('已过号');
    await refresh();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function requeuePatient(entryId: string) {
  try {
    const res = await fetch(`${API}/queue/${entryId}/requeue`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '重新排队失败');
      return;
    }
    ElMessage.success('已重新排队');
    await refresh();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

onMounted(refresh);

async function fetchChangeRequests() {
  try {
    const res = await fetch(`${API}/change-requests?status=PENDING`);
    if (!res.ok) throw new Error('获取变更请求失败');
    changeRequests.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function fetchWaitlistQueue() {
  try {
    const res = await fetch(`${API}/waitlist?status=PENDING`);
    if (!res.ok) throw new Error('获取候补队列失败');
    waitlistQueue.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function approveRequest(id: string) {
  try {
    const res = await fetch(`${API}/change-requests/${id}/approve`, { method: 'PATCH' });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '批准失败');
      return;
    }
    ElMessage.success('已批准');
    await refresh();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function rejectRequest(id: string) {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入驳回原因', '驳回变更请求', {
      confirmButtonText: '驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '可选',
    });
    const res = await fetch(`${API}/change-requests/${id}/reject`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || undefined }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '驳回失败');
      return;
    }
    ElMessage.success('已驳回');
    await fetchChangeRequests();
  } catch { /* user cancelled prompt */ }
}
</script>
