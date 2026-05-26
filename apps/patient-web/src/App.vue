<template>
  <div class="page-container">
    <div class="page-header">
      <h1>MedFlow 患者预约</h1>
    </div>

    <div class="section-card">
      <el-steps :active="step" finish-status="success" style="margin-bottom:24px">
        <el-step title="选择科室" />
        <el-step title="选择医生" />
        <el-step title="选择时段" />
        <el-step title="确认预约" />
      </el-steps>

      <div v-if="step === 0">
        <el-form-item label="您的手机号（模拟患者身份）" style="margin-bottom:20px">
          <el-input v-model="patientPhone" placeholder="输入手机号" style="max-width:280px" />
        </el-form-item>
        <p style="font-size:13px;color:#606266;margin:0 0 8px">选择科室</p>
        <div class="dept-grid" v-if="departments.length">
          <div
            v-for="d in departments"
            :key="d.id"
            class="dept-card"
            :class="{ 'dept-card--active': selectedDeptId === d.id }"
            @click="selectedDeptId = d.id"
          >
            <div class="dept-card__name">{{ d.name }}</div>
            <div class="dept-card__check" v-if="selectedDeptId === d.id">✓</div>
          </div>
        </div>
        <div v-else class="empty-state" style="border:1px dashed #d1d5db;border-radius:8px">
          <p style="margin:0 0 4px;font-size:14px;color:#6b7280">暂无科室数据</p>
          <p style="margin:0;font-size:12px;color:#9ca3af">请先在管理后台添加科室</p>
        </div>
        <el-button type="primary" :disabled="!selectedDeptId || !patientPhone" @click="step=1; fetchDoctors()" style="margin-top:20px">下一步</el-button>
      </div>

      <div v-if="step === 1">
        <el-radio-group v-model="selectedDoctorId" style="display:flex;flex-direction:column;gap:10px">
          <el-radio v-for="d in doctors" :key="d.id" :value="d.id">{{ d.user?.name }} - {{ d.title }}</el-radio>
        </el-radio-group>
        <p v-if="!doctors.length" class="empty-state">该科室暂无医生</p>
        <div style="margin-top:16px;display:flex;gap:10px">
          <el-button @click="step=0">上一步</el-button>
          <el-button type="primary" :disabled="!selectedDoctorId" @click="step=2; fetchSchedules()">下一步</el-button>
        </div>
      </div>

      <div v-if="step === 2">
        <el-table :data="schedules" border stripe highlight-current-row>
          <el-table-column label="日期" min-width="120">
            <template #default="{ row }">{{ row.date?.slice(0,10) }}</template>
          </el-table-column>
          <el-table-column prop="startTime" label="开始" width="80" />
          <el-table-column prop="endTime" label="结束" width="80" />
          <el-table-column label="剩余号源" width="100">
            <template #default="{ row }">
              <span v-if="row.remaining > 0">{{ row.remaining }}</span>
              <el-tag v-else type="danger" size="small">已满</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button v-if="row.remaining > 0" type="primary" size="small" @click="selectSchedule(row)">选择</el-button>
              <el-button v-else type="warning" size="small" @click="joinWaitlist(row)">候补</el-button>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="!schedules.length" class="empty-state">该医生暂无可预约时段</p>
        <div style="margin-top:16px;display:flex;gap:10px">
          <el-button @click="step=1">上一步</el-button>
          <el-button type="primary" :disabled="!selectedScheduleId" @click="step=3">下一步</el-button>
        </div>
      </div>

      <div v-if="step === 3">
        <div style="background:#f9fafb;border-radius:6px;padding:16px 20px;margin-bottom:16px">
          <p style="margin:0 0 8px;font-weight:600">确认预约信息</p>
          <ul style="margin:0;padding-left:20px;line-height:2">
            <li>患者手机：{{ patientPhone }}</li>
            <li>科室：{{ departments.find(d => d.id === selectedDeptId)?.name }}</li>
            <li>医生：{{ doctors.find(d => d.id === selectedDoctorId)?.user?.name }}</li>
            <li>时段：{{ selectedScheduleInfo }}</li>
          </ul>
        </div>
        <div style="display:flex;gap:10px">
          <el-button @click="step=2">上一步</el-button>
          <el-button type="primary" @click="submitAppointment">提交预约</el-button>
        </div>
      </div>

      <div v-if="step === 4">
        <el-result icon="success" title="预约成功" sub-title="请按时到前台签到">
          <template #extra>
            <el-button @click="reset">返回首页</el-button>
          </template>
        </el-result>
      </div>
    </div>

    <el-card style="margin-top:24px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:600">我的预约</span>
        </div>
      </template>
      <div class="form-area">
        <el-form inline>
          <el-form-item label="手机号">
            <el-input v-model="myPhone" placeholder="输入手机号查询" style="width:200px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchMyAppointments">查询</el-button>
          </el-form-item>
        </el-form>
      </div>
      <el-table :data="myAppointments" border stripe size="small" v-if="myAppointments.length">
        <el-table-column label="日期" width="105">
          <template #default="{ row }">{{ row.schedule?.date?.slice(0,10) }}</template>
        </el-table-column>
        <el-table-column label="医生" min-width="80">
          <template #default="{ row }">{{ row.schedule?.doctor?.user?.name }}</template>
        </el-table-column>
        <el-table-column label="科室" min-width="80">
          <template #default="{ row }">{{ row.schedule?.doctor?.department?.name }}</template>
        </el-table-column>
        <el-table-column label="时段" width="105">
          <template #default="{ row }">{{ row.schedule?.startTime }}-{{ row.schedule?.endTime }}</template>
        </el-table-column>
        <el-table-column label="排队号" width="70">
          <template #default="{ row }">
            <span v-if="row.queueEntry">{{ row.queueEntry.queueNumber }}</span>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'BOOKED'" size="small">已预约</el-tag>
            <el-tag v-else-if="row.status === 'CANCELLED'" type="info" size="small">已取消</el-tag>
            <el-tag v-else-if="row.status === 'CALLED'" type="primary" size="small">已叫号</el-tag>
            <el-tag v-else-if="row.status === 'IN_PROGRESS'" type="warning" size="small">接诊中</el-tag>
            <el-tag v-else-if="row.status === 'CHECKED_IN' && row.queueEntry?.status === 'SKIPPED'" type="danger" size="small">已过号</el-tag>
            <el-tag v-else-if="row.status === 'CHECKED_IN' && row.queueEntry?.skipLogs?.length" size="small" style="background:#f0e6ff;color:#7b2d8b;border-color:#d9b3e6">重排中</el-tag>
            <el-tag v-else-if="row.status === 'CHECKED_IN'" type="warning" size="small">候诊中</el-tag>
            <el-tag v-else-if="row.status === 'COMPLETED'" type="success" size="small">已完成</el-tag>
            <el-tag v-else-if="row.status === 'PENDING_FRONTDESK'" type="danger" size="small">待处理</el-tag>
            <el-tag v-else size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="原因" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.transferReason" style="color:#e6a23c">{{ row.transferReason }}</span>
            <span v-else-if="row.cancelReason">{{ row.cancelReason }}</span>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
        <el-table-column label="申请进度" min-width="130">
          <template #default="{ row }">
            <template v-if="row._changeRequests?.length">
              <div v-for="cr in row._changeRequests" :key="cr.id" style="margin-bottom:4px">
                <el-tag v-if="cr.status === 'PENDING'" type="warning" size="small">{{ cr.type === 'CANCEL' ? '取消' : '改期' }}审批中</el-tag>
                <el-tag v-else-if="cr.status === 'APPROVED'" type="success" size="small">{{ cr.type === 'CANCEL' ? '取消' : '改期' }}已通过</el-tag>
                <el-tag v-else-if="cr.status === 'REJECTED'" type="danger" size="small">{{ cr.type === 'CANCEL' ? '取消' : '改期' }}已驳回</el-tag>
                <span v-if="cr.status === 'REJECTED' && cr.reason" class="form-desc">{{ cr.reason }}</span>
              </div>
            </template>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <template v-if="row.status === 'BOOKED'">
              <el-button type="danger" size="small" @click="cancelAppointment(row)">取消</el-button>
              <el-button type="warning" size="small" @click="openReschedule(row)">改期</el-button>
            </template>
            <template v-else-if="row.status === 'COMPLETED'">
              <el-button size="small" @click="viewVisitRecord(row)">就诊记录</el-button>
              <el-button v-if="row.visitRecord?.followUpRecommended" type="primary" size="small" @click="openFollowUp(row)">复诊预约</el-button>
            </template>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
      </el-table>
      <p v-else-if="myAppointmentsSearched" class="empty-state">暂无预约记录</p>
    </el-card>

    <el-card style="margin-top:24px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-weight:600">我的候补</span>
        </div>
      </template>
      <div class="form-area">
        <el-form inline>
          <el-form-item label="手机号">
            <el-input v-model="waitlistPhone" placeholder="输入手机号查询" style="width:200px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="fetchMyWaitlist">查询</el-button>
          </el-form-item>
        </el-form>
      </div>
      <el-table :data="myWaitlist" border stripe size="small" v-if="myWaitlist.length">
        <el-table-column label="日期" width="105">
          <template #default="{ row }">{{ row.schedule?.date?.slice(0,10) }}</template>
        </el-table-column>
        <el-table-column label="医生" min-width="80">
          <template #default="{ row }">{{ row.schedule?.doctor?.user?.name }}</template>
        </el-table-column>
        <el-table-column label="科室" min-width="80">
          <template #default="{ row }">{{ row.schedule?.doctor?.department?.name }}</template>
        </el-table-column>
        <el-table-column label="时段" width="105">
          <template #default="{ row }">{{ row.schedule?.startTime }}-{{ row.schedule?.endTime }}</template>
        </el-table-column>
        <el-table-column label="位置" width="65">
          <template #default="{ row }">
            <span v-if="row.status === 'PENDING'" style="font-weight:600;color:#e6a23c">#{{ row.position }}</span>
            <span v-else style="color:#9ca3af">#{{ row.position }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'PENDING'" type="warning" size="small">候补中</el-tag>
            <el-tag v-else-if="row.status === 'PROMOTED'" type="success" size="small">已转正</el-tag>
            <el-tag v-else-if="row.status === 'CANCELLED'" type="info" size="small">已取消</el-tag>
            <el-tag v-else-if="row.status === 'CLOSED'" type="danger" size="small">已关闭</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.closeReason">{{ row.closeReason }}</span>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button v-if="row.status === 'PENDING'" type="danger" size="small" @click="cancelWaitlist(row.id)">取消</el-button>
            <span v-else style="color:#9ca3af">-</span>
          </template>
        </el-table-column>
      </el-table>
      <p v-else-if="waitlistSearched" class="empty-state">暂无候补记录</p>
    </el-card>

    <el-dialog v-model="rescheduleDialogVisible" title="改期预约" width="600px">
      <p>当前预约：<strong>{{ rescheduleTarget?.schedule?.doctor?.user?.name }}</strong> — {{ rescheduleTarget?.schedule?.date?.slice(0,10) }} {{ rescheduleTarget?.schedule?.startTime }}-{{ rescheduleTarget?.schedule?.endTime }}</p>
      <p style="margin:12px 0 8px;font-weight:500">请选择新的时段：</p>
      <el-table :data="rescheduleSchedules" border stripe size="small" highlight-current-row @row-click="(row: any) => selectedNewScheduleId = row.id">
        <el-table-column label="日期" min-width="120">
          <template #default="{ row }">{{ row.date?.slice(0,10) }}</template>
        </el-table-column>
        <el-table-column prop="startTime" label="开始" width="80" />
        <el-table-column prop="endTime" label="结束" width="80" />
        <el-table-column prop="remaining" label="剩余号源" width="100" />
        <el-table-column label="选择" width="60">
          <template #default="{ row }">
            <el-radio :value="row.id" :model-value="selectedNewScheduleId" @change="selectedNewScheduleId = row.id">&nbsp;</el-radio>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="rescheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!selectedNewScheduleId" @click="submitReschedule">确认改期</el-button>
      </template>
    </el-dialog>

    <!-- 就诊记录查看对话框 -->
    <el-dialog v-model="visitRecordDialogVisible" title="就诊记录" width="520px">
      <template v-if="currentVisitRecord">
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;color:#909399;font-size:12px">就诊日期</p>
          <p style="margin:0;font-size:14px">{{ currentVisitRecord._date }}</p>
        </div>
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;color:#909399;font-size:12px">主诉</p>
          <p style="margin:0;font-size:14px">{{ currentVisitRecord.chiefComplaint }}</p>
        </div>
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;color:#909399;font-size:12px">诊断结论</p>
          <p style="margin:0;font-size:14px">{{ currentVisitRecord.diagnosis }}</p>
        </div>
        <div style="margin-bottom:16px">
          <p style="margin:0 0 4px;color:#909399;font-size:12px">处理意见</p>
          <p style="margin:0;font-size:14px">{{ currentVisitRecord.treatmentPlan }}</p>
        </div>
        <div v-if="currentVisitRecord.followUpRecommended" style="background:#f0f9ff;border-radius:6px;padding:12px 16px">
          <p style="margin:0 0 8px;font-weight:600;color:#0369a1">医生建议复诊</p>
          <p v-if="currentVisitRecord._followUpDept" style="margin:0 0 4px;font-size:13px">科室：{{ currentVisitRecord._followUpDept }}</p>
          <p v-if="currentVisitRecord._followUpDoctor" style="margin:0 0 4px;font-size:13px">医生：{{ currentVisitRecord._followUpDoctor }}</p>
          <p v-if="currentVisitRecord.followUpDateStart" style="margin:0;font-size:13px">
            时间：{{ currentVisitRecord.followUpDateStart?.slice(0,10) }}
            <template v-if="currentVisitRecord.followUpDateEnd"> 至 {{ currentVisitRecord.followUpDateEnd?.slice(0,10) }}</template>
          </p>
        </div>
      </template>
      <template #footer>
        <el-button @click="visitRecordDialogVisible = false">关闭</el-button>
        <el-button v-if="currentVisitRecord?.followUpRecommended" type="primary" @click="visitRecordDialogVisible = false; openFollowUp(currentVisitAppointment)">复诊预约</el-button>
      </template>
    </el-dialog>

    <!-- 复诊预约对话框 -->
    <el-dialog v-model="followUpDialogVisible" title="复诊预约" width="650px">
      <p style="margin:0 0 12px;color:#606266;font-size:13px">根据医生建议为您筛选可用排班：</p>
      <el-table :data="followUpSchedules" border stripe size="small" highlight-current-row>
        <el-table-column label="日期" min-width="110">
          <template #default="{ row }">{{ row.date?.slice(0,10) }}</template>
        </el-table-column>
        <el-table-column label="医生" min-width="90">
          <template #default="{ row }">{{ row.doctor?.user?.name }}</template>
        </el-table-column>
        <el-table-column label="科室" min-width="90">
          <template #default="{ row }">{{ row.doctor?.department?.name }}</template>
        </el-table-column>
        <el-table-column label="时段" width="110">
          <template #default="{ row }">{{ row.startTime }}-{{ row.endTime }}</template>
        </el-table-column>
        <el-table-column label="剩余" width="70">
          <template #default="{ row }">
            <span v-if="row.remaining > 0">{{ row.remaining }}</span>
            <el-tag v-else type="danger" size="small">已满</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button v-if="row.remaining > 0" type="primary" size="small" @click="submitFollowUp(row.id)">预约</el-button>
            <el-button v-else type="warning" size="small" @click="joinFollowUpWaitlist(row.id)">候补</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!followUpSchedules.length" class="empty-state">暂无符合条件的可用排班</p>
      <template #footer>
        <el-button @click="followUpDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const API = '/api';
const step = ref(0);
const patientPhone = ref('');

const departments = ref<any[]>([]);
const doctors = ref<any[]>([]);
const schedules = ref<any[]>([]);

const selectedDeptId = ref('');
const selectedDoctorId = ref('');
const selectedScheduleId = ref('');
const selectedScheduleInfo = ref('');
const myPhone = ref('');
const myAppointments = ref<any[]>([]);
const myAppointmentsSearched = ref(false);
const rescheduleDialogVisible = ref(false);
const rescheduleTarget = ref<any>(null);
const rescheduleSchedules = ref<any[]>([]);
const selectedNewScheduleId = ref('');
const waitlistPhone = ref('');
const myWaitlist = ref<any[]>([]);
const waitlistSearched = ref(false);
const visitRecordDialogVisible = ref(false);
const currentVisitRecord = ref<any>(null);
const currentVisitAppointment = ref<any>(null);
const followUpDialogVisible = ref(false);
const followUpSchedules = ref<any[]>([]);
const followUpPatientId = ref('');

async function fetchDepartments() {
  try {
    const res = await fetch(`${API}/departments`);
    if (!res.ok) throw new Error((await res.json()).message || '获取科室列表失败');
    departments.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法连接后端服务');
  }
}
async function fetchDoctors() {
  try {
    const res = await fetch(`${API}/doctors?departmentId=${selectedDeptId.value}`);
    if (!res.ok) throw new Error((await res.json()).message || '获取医生列表失败');
    doctors.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法连接后端服务');
  }
}
async function fetchSchedules() {
  try {
    const res = await fetch(`${API}/schedules?doctorId=${selectedDoctorId.value}`);
    if (!res.ok) throw new Error((await res.json()).message || '获取排班列表失败');
    const all = await res.json();
    schedules.value = all.filter((s: any) => !s.suspended && !s.substituted);
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法连接后端服务');
  }
}

function selectSchedule(row: any) {
  selectedScheduleId.value = row.id;
  selectedScheduleInfo.value = `${row.date?.slice(0,10)} ${row.startTime}-${row.endTime} (剩余${row.remaining})`;
}

async function submitAppointment() {
  try {
    let patients = await fetch(`${API}/patients?phone=${patientPhone.value}`).then(r => r.json()).catch(() => []);
    let patientId: string;
    if (Array.isArray(patients) && patients.length > 0) {
      patientId = patients[0].id;
    } else {
      const res = await fetch(`${API}/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: patientPhone.value, name: `患者_${patientPhone.value.slice(-4)}`, password: '123456' }),
      });
      if (!res.ok) {
        const err = await res.json();
        ElMessage.error(err.message || '创建患者失败');
        return;
      }
      const created = await res.json();
      patientId = created.id;
    }

    const res = await fetch(`${API}/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, scheduleId: selectedScheduleId.value }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '预约失败');
      return;
    }
    step.value = 4;
    ElMessage.success('预约成功');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

function reset() {
  step.value = 0;
  selectedDeptId.value = '';
  selectedDoctorId.value = '';
  selectedScheduleId.value = '';
}

onMounted(fetchDepartments);

async function fetchMyAppointments() {
  if (!myPhone.value.trim()) { ElMessage.warning('请输入手机号'); return; }
  try {
    const patients = await fetch(`${API}/patients?phone=${myPhone.value.trim()}`).then(r => r.json()).catch(() => []);
    myAppointmentsSearched.value = true;
    if (!Array.isArray(patients) || patients.length === 0) {
      myAppointments.value = [];
      return;
    }
    const res = await fetch(`${API}/appointments?patientId=${patients[0].id}`);
    if (!res.ok) throw new Error('获取预约列表失败');
    const appointments = await res.json();
    const crPromises = appointments.map((apt: any) =>
      fetch(`${API}/change-requests?appointmentId=${apt.id}`).then(r => r.json()).catch(() => [])
    );
    const allCrs = await Promise.all(crPromises);
    myAppointments.value = appointments.map((apt: any, i: number) => ({ ...apt, _changeRequests: allCrs[i] }));
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function cancelAppointment(row: any) {
  try {
    const res = await fetch(`${API}/appointments/${row.id}/cancel`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.blocked) {
      ElMessage.warning(data.message || '已提交取消申请，等待前台审批');
    } else if (!res.ok) {
      ElMessage.error(data.message || '取消失败');
    } else {
      ElMessage.success('预约已取消');
    }
    await fetchMyAppointments();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function openReschedule(row: any) {
  rescheduleTarget.value = row;
  selectedNewScheduleId.value = '';
  try {
    const res = await fetch(`${API}/schedules?doctorId=${row.schedule?.doctor?.id}`);
    if (!res.ok) throw new Error('获取排班失败');
    const all = await res.json();
    rescheduleSchedules.value = all.filter((s: any) => !s.suspended && !s.substituted && s.remaining > 0 && s.id !== row.scheduleId);
    rescheduleDialogVisible.value = true;
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function submitReschedule() {
  if (!rescheduleTarget.value || !selectedNewScheduleId.value) return;
  try {
    const res = await fetch(`${API}/appointments/${rescheduleTarget.value.id}/reschedule`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetScheduleId: selectedNewScheduleId.value }),
    });
    const data = await res.json();
    if (data.blocked) {
      ElMessage.warning(data.message || '已提交改期申请，等待前台审批');
      rescheduleDialogVisible.value = false;
    } else if (!res.ok) {
      ElMessage.error(data.message || '改期失败');
    } else {
      ElMessage.success('改期成功');
      rescheduleDialogVisible.value = false;
    }
    await fetchMyAppointments();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function joinWaitlist(row: any) {
  if (!patientPhone.value.trim()) { ElMessage.warning('请先输入手机号'); return; }
  try {
    let patients = await fetch(`${API}/patients?phone=${patientPhone.value.trim()}`).then(r => r.json()).catch(() => []);
    let patientId: string;
    if (Array.isArray(patients) && patients.length > 0) {
      patientId = patients[0].id;
    } else {
      const res = await fetch(`${API}/patients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: patientPhone.value.trim(), name: `患者_${patientPhone.value.slice(-4)}`, password: '123456' }),
      });
      if (!res.ok) { ElMessage.error('创建患者失败'); return; }
      const created = await res.json();
      patientId = created.id;
    }
    const res = await fetch(`${API}/waitlist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, scheduleId: row.id }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '候补失败');
      return;
    }
    ElMessage.success('候补成功');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function fetchMyWaitlist() {
  if (!waitlistPhone.value.trim()) { ElMessage.warning('请输入手机号'); return; }
  try {
    const patients = await fetch(`${API}/patients?phone=${waitlistPhone.value.trim()}`).then(r => r.json()).catch(() => []);
    waitlistSearched.value = true;
    if (!Array.isArray(patients) || patients.length === 0) {
      myWaitlist.value = [];
      return;
    }
    const res = await fetch(`${API}/waitlist?patientId=${patients[0].id}`);
    if (!res.ok) throw new Error('获取候补列表失败');
    myWaitlist.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function cancelWaitlist(entryId: string) {
  try {
    const res = await fetch(`${API}/waitlist/${entryId}/cancel`, { method: 'PATCH' });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '取消候补失败');
      return;
    }
    ElMessage.success('候补已取消');
    await fetchMyWaitlist();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

function viewVisitRecord(row: any) {
  const vr = row.visitRecord;
  if (!vr) { ElMessage.warning('暂无就诊记录'); return; }
  currentVisitAppointment.value = row;
  currentVisitRecord.value = {
    ...vr,
    _date: row.schedule?.date?.slice(0, 10),
    _followUpDept: row.schedule?.doctor?.department?.name,
    _followUpDoctor: null as string | null,
  };
  if (vr.followUpDoctorId) {
    const doc = doctors.value.find((d: any) => d.id === vr.followUpDoctorId);
    currentVisitRecord.value._followUpDoctor = doc?.user?.name || null;
  }
  if (vr.followUpDeptId) {
    const dept = departments.value.find((d: any) => d.id === vr.followUpDeptId);
    if (dept) currentVisitRecord.value._followUpDept = dept.name;
  }
  visitRecordDialogVisible.value = true;
}

async function openFollowUp(row: any) {
  const vr = row.visitRecord;
  if (!vr?.followUpRecommended) return;

  followUpPatientId.value = row.patientId;
  followUpSchedules.value = [];
  followUpDialogVisible.value = true;

  const params = new URLSearchParams();
  if (vr.followUpDoctorId) params.set('doctorId', vr.followUpDoctorId);
  else if (vr.followUpDeptId) params.set('departmentId', vr.followUpDeptId);
  if (vr.followUpDateStart) params.set('dateStart', vr.followUpDateStart.slice(0, 10));
  if (vr.followUpDateEnd) params.set('dateEnd', vr.followUpDateEnd.slice(0, 10));

  try {
    const res = await fetch(`${API}/schedules?${params}`);
    if (!res.ok) throw new Error('获取排班失败');
    const all = await res.json();
    followUpSchedules.value = all.filter((s: any) => !s.suspended && !s.substituted);
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function submitFollowUp(scheduleId: string) {
  try {
    const res = await fetch(`${API}/appointments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: followUpPatientId.value, scheduleId }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '预约失败');
      return;
    }
    ElMessage.success('复诊预约成功');
    followUpDialogVisible.value = false;
    await fetchMyAppointments();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function joinFollowUpWaitlist(scheduleId: string) {
  try {
    const res = await fetch(`${API}/waitlist`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: followUpPatientId.value, scheduleId }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '候补失败');
      return;
    }
    ElMessage.success('已加入候补');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}
</script>
