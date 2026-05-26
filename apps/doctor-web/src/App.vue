<template>
  <div class="page-container">
    <div class="page-header">
      <h1>MedFlow 医生工作站</h1>
    </div>

    <div class="section-card">
      <div class="form-area">
        <el-form inline>
          <el-form-item label="选择医生（模拟）">
            <el-select v-model="selectedDoctorId" placeholder="选择医生" @change="fetchQueue">
              <el-option v-for="d in doctors" :key="d.id" :label="d.user?.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="fetchQueue">刷新队列</el-button>
          </el-form-item>
        </el-form>
      </div>

      <p v-if="!doctors.length" class="empty-state">无法获取医生列表，请确认后端服务已启动</p>
      <p v-else-if="!selectedDoctorId" class="empty-state">请先选择医生以查看待接诊队列</p>

      <template v-if="selectedDoctorId">
        <h3 class="card-title" style="margin-top:8px">待接诊患者</h3>
        <el-table :data="queue" border stripe>
          <el-table-column prop="queueNumber" label="队列号" width="80" />
          <el-table-column label="患者" min-width="120">
            <template #default="{ row }">{{ row.appointment?.patient?.name }}</template>
          </el-table-column>
          <el-table-column label="时段" min-width="130">
            <template #default="{ row }">{{ row.appointment?.schedule?.startTime }}-{{ row.appointment?.schedule?.endTime }}</template>
          </el-table-column>
          <el-table-column label="过号记录" width="90">
            <template #default="{ row }">
              <span v-if="row.skipLogs?.length">{{ row.skipLogs.length }}次</span>
              <span v-else style="color:#9ca3af">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'CALLED'" type="primary">已叫号</el-tag>
              <el-tag v-else-if="row.status === 'IN_PROGRESS'" type="warning">接诊中</el-tag>
              <el-tag v-else-if="row.status === 'COMPLETED'" type="success">已完成</el-tag>
              <el-tag v-else>{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130">
            <template #default="{ row }">
              <el-button
                v-if="row.status === 'CALLED'"
                type="primary" size="small"
                @click="startConsultation(row.appointment?.id)"
              >开始接诊</el-button>
              <el-button
                v-else-if="row.status === 'IN_PROGRESS'"
                type="success" size="small"
                @click="openVisitRecordDialog(row.appointment?.id)"
              >完成接诊</el-button>
              <span v-else-if="row.status === 'COMPLETED'" style="color:#9ca3af">已完成</span>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="!queue.length" class="empty-state">暂无待接诊患者</p>
      </template>
    </div>

    <!-- 就诊记录填写对话框 -->
    <el-dialog v-model="visitDialogVisible" title="填写就诊记录" width="560px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="主诉" required>
          <el-input v-model="visitForm.chiefComplaint" type="textarea" :rows="2" placeholder="请输入患者主诉" />
        </el-form-item>
        <el-form-item label="诊断结论" required>
          <el-input v-model="visitForm.diagnosis" type="textarea" :rows="2" placeholder="请输入诊断结论" />
        </el-form-item>
        <el-form-item label="处理意见" required>
          <el-input v-model="visitForm.treatmentPlan" type="textarea" :rows="2" placeholder="请输入处理意见" />
        </el-form-item>
        <el-form-item label="建议复诊">
          <el-switch v-model="visitForm.followUpRecommended" />
        </el-form-item>
        <template v-if="visitForm.followUpRecommended">
          <el-form-item label="推荐复诊科室">
            <el-select v-model="visitForm.followUpDeptId" clearable placeholder="选择科室" @change="onFollowUpDeptChange">
              <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="推荐复诊医生">
            <el-select v-model="visitForm.followUpDoctorId" clearable placeholder="选择医生">
              <el-option v-for="d in followUpDoctors" :key="d.id" :label="d.user?.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="建议复诊时间范围">
            <el-date-picker v-model="visitForm.followUpDateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="visitDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitVisitRecord">提交并完成接诊</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const API = '/api';
const doctors = ref<any[]>([]);
const selectedDoctorId = ref('');
const queue = ref<any[]>([]);

const visitDialogVisible = ref(false);
const submitting = ref(false);
const currentAppointmentId = ref('');
const departments = ref<any[]>([]);
const followUpDoctors = ref<any[]>([]);
const visitForm = ref({
  chiefComplaint: '',
  diagnosis: '',
  treatmentPlan: '',
  followUpRecommended: false,
  followUpDeptId: '',
  followUpDoctorId: '',
  followUpDateRange: null as string[] | null,
});

async function fetchDoctors() {
  try {
    const res = await fetch(`${API}/doctors`);
    if (!res.ok) throw new Error((await res.json()).message || '获取医生列表失败');
    doctors.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法连接后端服务');
  }
}

async function fetchDepartments() {
  try {
    const res = await fetch(`${API}/departments`);
    if (res.ok) departments.value = await res.json();
  } catch {}
}

async function fetchQueue() {
  if (!selectedDoctorId.value) return;
  try {
    const [calledRes, inProgressRes] = await Promise.all([
      fetch(`${API}/queue?doctorId=${selectedDoctorId.value}&status=CALLED`),
      fetch(`${API}/queue?doctorId=${selectedDoctorId.value}&status=IN_PROGRESS`),
    ]);
    if (!calledRes.ok || !inProgressRes.ok) throw new Error('获取队列失败');
    const called = await calledRes.json() as any[];
    const inProgress = await inProgressRes.json() as any[];
    queue.value = [...inProgress, ...called];
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取队列');
  }
}

async function startConsultation(appointmentId: string) {
  try {
    const res = await fetch(`${API}/appointments/${appointmentId}/start`, { method: 'PATCH' });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '操作失败');
      return;
    }
    ElMessage.success('开始接诊');
    await fetchQueue();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

function openVisitRecordDialog(appointmentId: string) {
  currentAppointmentId.value = appointmentId;
  visitForm.value = {
    chiefComplaint: '',
    diagnosis: '',
    treatmentPlan: '',
    followUpRecommended: false,
    followUpDeptId: '',
    followUpDoctorId: '',
    followUpDateRange: null,
  };
  visitDialogVisible.value = true;
}

async function onFollowUpDeptChange(deptId: string) {
  visitForm.value.followUpDoctorId = '';
  followUpDoctors.value = [];
  if (!deptId) return;
  try {
    const res = await fetch(`${API}/doctors?departmentId=${deptId}`);
    if (res.ok) followUpDoctors.value = await res.json();
  } catch {}
}

async function submitVisitRecord() {
  const f = visitForm.value;
  if (!f.chiefComplaint.trim() || !f.diagnosis.trim() || !f.treatmentPlan.trim()) {
    ElMessage.warning('请填写主诉、诊断结论和处理意见');
    return;
  }
  if (f.followUpRecommended && !f.followUpDeptId && !f.followUpDoctorId) {
    ElMessage.warning('建议复诊时须指定推荐科室或医生');
    return;
  }

  submitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      doctorId: selectedDoctorId.value,
      chiefComplaint: f.chiefComplaint.trim(),
      diagnosis: f.diagnosis.trim(),
      treatmentPlan: f.treatmentPlan.trim(),
      followUpRecommended: f.followUpRecommended,
    };
    if (f.followUpRecommended) {
      if (f.followUpDeptId) payload.followUpDeptId = f.followUpDeptId;
      if (f.followUpDoctorId) payload.followUpDoctorId = f.followUpDoctorId;
      if (f.followUpDateRange?.[0]) payload.followUpDateStart = f.followUpDateRange[0];
      if (f.followUpDateRange?.[1]) payload.followUpDateEnd = f.followUpDateRange[1];
    }

    const res = await fetch(`${API}/appointments/${currentAppointmentId.value}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '提交失败');
      return;
    }
    ElMessage.success('就诊记录已保存，接诊完成');
    visitDialogVisible.value = false;
    await fetchQueue();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  fetchDoctors();
  fetchDepartments();
});
</script>
