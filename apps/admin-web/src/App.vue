<template>
  <div class="page-container">
    <div class="page-header">
      <h1>MedFlow 管理后台</h1>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="科室管理" name="dept">
        <div class="form-area">
          <el-form inline @submit.prevent="createDept">
            <el-form-item label="科室名称">
              <el-input v-model="newDeptName" placeholder="如：内科" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createDept">添加科室</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table :data="departments" border stripe>
          <el-table-column prop="id" label="ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="name" label="科室名称" min-width="150" />
        </el-table>
        <p v-if="!departments.length" class="empty-state">暂无科室数据</p>
      </el-tab-pane>

      <el-tab-pane label="医生管理" name="doctor">
        <div class="form-area">
          <el-form inline @submit.prevent="createDoctor">
            <el-form-item label="科室">
              <el-select v-model="newDoctor.departmentId" placeholder="选择科室">
                <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="姓名">
              <el-input v-model="newDoctor.name" placeholder="请输入姓名" />
            </el-form-item>
            <el-form-item label="手机">
              <el-input v-model="newDoctor.phone" placeholder="请输入手机号" />
            </el-form-item>
            <el-form-item label="职称">
              <el-input v-model="newDoctor.title" placeholder="主任医师" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createDoctor">添加医生</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table :data="doctors" border stripe>
          <el-table-column prop="id" label="ID" min-width="180" show-overflow-tooltip />
          <el-table-column label="姓名" min-width="100">
            <template #default="{ row }">{{ row.user?.name }}</template>
          </el-table-column>
          <el-table-column prop="title" label="职称" min-width="100" />
          <el-table-column label="科室" min-width="100">
            <template #default="{ row }">{{ row.department?.name }}</template>
          </el-table-column>
        </el-table>
        <p v-if="!doctors.length" class="empty-state">暂无医生数据</p>
      </el-tab-pane>

      <el-tab-pane label="排班/号源" name="schedule">
        <div class="form-area">
          <el-form inline @submit.prevent="createSchedule">
            <el-form-item label="医生">
              <el-select v-model="newSchedule.doctorId" placeholder="选择医生">
                <el-option v-for="d in doctors" :key="d.id" :label="d.user?.name" :value="d.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="日期">
              <el-date-picker v-model="newSchedule.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" />
            </el-form-item>
            <el-form-item label="开始时间">
              <el-input v-model="newSchedule.startTime" placeholder="08:00" style="width:100px" />
            </el-form-item>
            <el-form-item label="结束时间">
              <el-input v-model="newSchedule.endTime" placeholder="12:00" style="width:100px" />
            </el-form-item>
            <el-form-item label="号源数">
              <el-input-number v-model="newSchedule.total" :min="1" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createSchedule">创建排班</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table :data="schedules" border stripe>
          <el-table-column label="医生" min-width="100">
            <template #default="{ row }">{{ row.doctor?.user?.name }}</template>
          </el-table-column>
          <el-table-column label="日期" width="120">
            <template #default="{ row }">{{ row.date?.slice(0,10) }}</template>
          </el-table-column>
          <el-table-column prop="startTime" label="开始" width="70" />
          <el-table-column prop="endTime" label="结束" width="70" />
          <el-table-column prop="total" label="总号源" width="75" />
          <el-table-column prop="remaining" label="剩余" width="65" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.suspended" type="danger">已停诊</el-tag>
              <el-tag v-else-if="row.substituted" type="warning">已替诊</el-tag>
              <el-tag v-else type="success">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <template v-if="!row.suspended && !row.substituted">
                <el-button type="danger" size="small" @click="openSuspend(row)">停诊</el-button>
                <el-button type="warning" size="small" @click="openSubstitute(row)">替诊</el-button>
              </template>
              <span v-else-if="row.suspended" class="form-desc">{{ row.suspendReason }}</span>
              <span v-else class="form-desc">{{ row.substituteReason || '已替诊' }}</span>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="!schedules.length" class="empty-state">暂无排班数据</p>

        <el-dialog v-model="suspendDialogVisible" title="发起停诊" width="440px">
          <p>确定要停诊以下排班吗？</p>
          <p><strong>{{ suspendTarget?.doctor?.user?.name }}</strong> — {{ suspendTarget?.date?.slice(0,10) }} {{ suspendTarget?.startTime }}-{{ suspendTarget?.endTime }}</p>
          <el-input v-model="suspendReason" type="textarea" :rows="3" placeholder="请填写停诊原因" />
          <template #footer>
            <el-button @click="suspendDialogVisible = false">取消</el-button>
            <el-button type="danger" @click="submitSuspend" :disabled="!suspendReason.trim()">确认停诊</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="substituteDialogVisible" title="发起替诊" width="560px">
          <p>将以下排班的所有待就诊预约和候补转移到目标排班：</p>
          <p><strong>{{ substituteSource?.doctor?.user?.name }}</strong> — {{ substituteSource?.date?.slice(0,10) }} {{ substituteSource?.startTime }}-{{ substituteSource?.endTime }} (剩余{{ substituteSource?.remaining }}号源)</p>
          <el-divider />
          <el-form label-width="80px">
            <el-form-item label="替诊医生">
              <el-select v-model="substituteTargetDoctorId" placeholder="选择同科室医生" @change="fetchTargetSchedules" style="width:100%">
                <el-option v-for="d in sameDeptDoctors" :key="d.id" :label="d.user?.name + ' - ' + d.title" :value="d.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标排班">
              <el-select v-model="substituteTargetScheduleId" placeholder="选择目标排班" style="width:100%">
                <el-option v-for="s in targetSchedules" :key="s.id" :label="`${s.date?.slice(0,10)} ${s.startTime}-${s.endTime} (剩余${s.remaining})`" :value="s.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="替诊原因">
              <el-input v-model="substituteReason" type="textarea" :rows="2" placeholder="可选：填写替诊原因" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="substituteDialogVisible = false">取消</el-button>
            <el-button type="warning" @click="submitSubstitute" :disabled="!substituteTargetScheduleId">确认替诊</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane label="规则配置" name="config">
        <div style="margin-top:8px">
          <p style="color:#6b7280;font-size:13px;margin:0 0 20px">配置预约系统的全局业务规则，调整后立即生效。</p>

          <el-row :gutter="20">
            <el-col :span="12">
              <div class="config-card">
                <div class="config-card__icon" style="background:#fef3c7;color:#d97706">⏱</div>
                <div class="config-card__body">
                  <div class="config-card__title">取消/改期截止时间</div>
                  <div class="config-card__desc">就诊前多少小时内，患者不可自助取消或改期（超时需前台审批）</div>
                  <div class="config-card__input">
                    <el-input-number v-model="clinicConfig.cancelDeadlineHours" :min="0" :step="1" />
                    <span class="config-card__unit">小时</span>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="config-card">
                <div class="config-card__icon" style="background:#dbeafe;color:#2563eb">📅</div>
                <div class="config-card__body">
                  <div class="config-card__title">可预约天数范围</div>
                  <div class="config-card__desc">患者只能预约未来N天内的号源，超出范围的排班不可选</div>
                  <div class="config-card__input">
                    <el-input-number v-model="clinicConfig.advanceBookingDays" :min="1" :step="1" />
                    <span class="config-card__unit">天</span>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="config-card">
                <div class="config-card__icon" style="background:#fef3c7;color:#d97706">⏰</div>
                <div class="config-card__body">
                  <div class="config-card__title">迟到阈值</div>
                  <div class="config-card__desc">就诊时间超过此分钟数未签到，前端显示"已迟到"提醒</div>
                  <div class="config-card__input">
                    <el-input-number v-model="clinicConfig.lateThresholdMinutes" :min="1" :step="1" />
                    <span class="config-card__unit">分钟</span>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="config-card">
                <div class="config-card__icon" style="background:#fee2e2;color:#dc2626">🚫</div>
                <div class="config-card__body">
                  <div class="config-card__title">爽约阈值</div>
                  <div class="config-card__desc">就诊时间超过此分钟数未签到，前台可标记为爽约并释放号源</div>
                  <div class="config-card__input">
                    <el-input-number v-model="clinicConfig.noShowThresholdMinutes" :min="1" :step="1" />
                    <span class="config-card__unit">分钟</span>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>

          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f3f4f6;display:flex;align-items:center;gap:12px">
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
            <span style="color:#9ca3af;font-size:12px">保存后对新发起的操作立即生效</span>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="操作记录" name="logs">
        <div class="form-area">
          <el-form inline>
            <el-form-item label="操作类型">
              <el-select v-model="logFilter.type" placeholder="全部类型" clearable>
                <el-option label="新增科室" value="CREATE_DEPARTMENT" />
                <el-option label="新增医生" value="CREATE_DOCTOR" />
                <el-option label="新增排班" value="CREATE_SCHEDULE" />
                <el-option label="停诊" value="SUSPEND_SCHEDULE" />
                <el-option label="替诊" value="SUBSTITUTE_SCHEDULE" />
                <el-option label="预约" value="CREATE_APPOINTMENT" />
                <el-option label="取消预约" value="CANCEL_APPOINTMENT" />
                <el-option label="改期" value="RESCHEDULE_APPOINTMENT" />
                <el-option label="签到" value="CHECKIN" />
                <el-option label="叫号" value="CALL_QUEUE" />
                <el-option label="过号" value="SKIP_QUEUE" />
                <el-option label="重新排队" value="REQUEUE" />
                <el-option label="审批通过" value="APPROVE_CHANGE_REQUEST" />
                <el-option label="审批拒绝" value="REJECT_CHANGE_REQUEST" />
                <el-option label="开始接诊" value="START_APPOINTMENT" />
                <el-option label="完成接诊" value="COMPLETE_APPOINTMENT" />
                <el-option label="加入候补" value="WAITLIST_JOIN" />
                <el-option label="取消候补" value="WAITLIST_CANCEL" />
                <el-option label="候补转正" value="WAITLIST_PROMOTE" />
                <el-option label="候补关闭" value="WAITLIST_CLOSE" />
                <el-option label="创建就诊记录" value="CREATE_VISIT_RECORD" />
                <el-option label="标记爽约" value="MARK_NO_SHOW" />
              </el-select>
            </el-form-item>
            <el-form-item label="时间范围">
              <el-date-picker v-model="logFilter.dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchLogs">查询</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table :data="operationLogs" border stripe>
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ row.createdAt?.replace('T', ' ').slice(0, 19) }}</template>
          </el-table-column>
          <el-table-column label="操作类型" width="130">
            <template #default="{ row }">
              <el-tag :type="logTagType(row.type)" size="small">{{ logTypeLabel(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="target" label="操作对象" min-width="200" show-overflow-tooltip />
          <el-table-column label="操作角色" width="100">
            <template #default="{ row }">{{ roleLabel(row.role) }}</template>
          </el-table-column>
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <el-tag :type="row.result === 'success' ? 'success' : row.result === 'blocked' ? 'warning' : 'danger'" size="small">{{ resultLabel(row.result) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        </el-table>
        <p v-if="!operationLogs.length" class="empty-state">暂无操作记录</p>
      </el-tab-pane>

      <el-tab-pane label="候补管理" name="waitlist">
        <div class="form-area">
          <el-form inline>
            <el-form-item label="状态">
              <el-select v-model="waitlistFilter.status" placeholder="全部状态" clearable>
                <el-option label="候补中" value="PENDING" />
                <el-option label="已转正" value="PROMOTED" />
                <el-option label="已取消" value="CANCELLED" />
                <el-option label="已关闭" value="CLOSED" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchWaitlist">查询</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table :data="waitlistEntries" border stripe>
          <el-table-column label="患者" min-width="120">
            <template #default="{ row }">
              <div>{{ row.patient?.name }}</div>
              <div class="form-desc">{{ row.patient?.phone }}</div>
            </template>
          </el-table-column>
          <el-table-column label="医生" min-width="80">
            <template #default="{ row }">{{ row.schedule?.doctor?.user?.name }}</template>
          </el-table-column>
          <el-table-column label="科室" min-width="80">
            <template #default="{ row }">{{ row.schedule?.doctor?.department?.name }}</template>
          </el-table-column>
          <el-table-column label="日期" width="105">
            <template #default="{ row }">{{ row.schedule?.date?.slice(0,10) }}</template>
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
          <el-table-column label="备注" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.closeReason">{{ row.closeReason }}</span>
              <span v-else-if="row.appointmentId" style="color:#67c23a">预约ID: {{ row.appointmentId.slice(0,8) }}...</span>
              <span v-else style="color:#9ca3af">-</span>
            </template>
          </el-table-column>
          <el-table-column label="申请时间" width="155">
            <template #default="{ row }">{{ row.createdAt?.replace('T', ' ').slice(0, 19) }}</template>
          </el-table-column>
        </el-table>
        <p v-if="!waitlistEntries.length" class="empty-state">暂无候补记录</p>
      </el-tab-pane>

      <el-tab-pane label="就诊记录" name="visitRecords">
        <div class="form-area">
          <el-form inline>
            <el-form-item label="患者手机">
              <el-input v-model="visitRecordFilter.patientPhone" placeholder="输入手机号" style="width:180px" clearable />
            </el-form-item>
            <el-form-item label="医生">
              <el-select v-model="visitRecordFilter.doctorId" placeholder="全部医生" clearable>
                <el-option v-for="d in doctors" :key="d.id" :label="d.user?.name" :value="d.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="时间范围">
              <el-date-picker v-model="visitRecordFilter.dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="fetchVisitRecords">查询</el-button>
            </el-form-item>
          </el-form>
        </div>
        <el-table :data="visitRecords" border stripe>
          <el-table-column label="就诊日期" width="105">
            <template #default="{ row }">{{ row.createdAt?.slice(0,10) }}</template>
          </el-table-column>
          <el-table-column label="患者" min-width="120">
            <template #default="{ row }">
              <div>{{ row.appointment?.patient?.name }}</div>
              <div class="form-desc">{{ row.appointment?.patient?.phone }}</div>
            </template>
          </el-table-column>
          <el-table-column label="医生" min-width="80">
            <template #default="{ row }">{{ row.appointment?.schedule?.doctor?.user?.name }}</template>
          </el-table-column>
          <el-table-column label="科室" min-width="80">
            <template #default="{ row }">{{ row.appointment?.schedule?.doctor?.department?.name }}</template>
          </el-table-column>
          <el-table-column prop="chiefComplaint" label="主诉" min-width="150" show-overflow-tooltip />
          <el-table-column prop="diagnosis" label="诊断结论" min-width="150" show-overflow-tooltip />
          <el-table-column prop="treatmentPlan" label="处理意见" min-width="150" show-overflow-tooltip />
          <el-table-column label="复诊" width="70">
            <template #default="{ row }">
              <el-tag v-if="row.followUpRecommended" type="success" size="small">是</el-tag>
              <span v-else style="color:#9ca3af">否</span>
            </template>
          </el-table-column>
          <el-table-column label="复诊建议" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <template v-if="row.followUpRecommended">
                <span v-if="row.followUpDateStart">{{ row.followUpDateStart?.slice(0,10) }} 至 {{ row.followUpDateEnd?.slice(0,10) }}</span>
              </template>
              <span v-else style="color:#9ca3af">-</span>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="!visitRecords.length" class="empty-state">暂无就诊记录</p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const API = '/api';
const activeTab = ref('dept');

const departments = ref<any[]>([]);
const doctors = ref<any[]>([]);
const schedules = ref<any[]>([]);

const newDeptName = ref('');
const newDoctor = ref({ departmentId: '', name: '', phone: '', title: '' });
const newSchedule = ref({ doctorId: '', date: '', startTime: '08:00', endTime: '12:00', total: 20 });

const suspendDialogVisible = ref(false);
const suspendTarget = ref<any>(null);
const suspendReason = ref('');
const clinicConfig = ref({ cancelDeadlineHours: 2, advanceBookingDays: 7, lateThresholdMinutes: 15, noShowThresholdMinutes: 30 });

const substituteDialogVisible = ref(false);
const substituteSource = ref<any>(null);
const substituteTargetDoctorId = ref('');
const substituteTargetScheduleId = ref('');
const substituteReason = ref('');
const sameDeptDoctors = ref<any[]>([]);
const targetSchedules = ref<any[]>([]);

async function fetchDepartments() {
  try {
    const res = await fetch(`${API}/departments`);
    if (!res.ok) throw new Error((await res.json()).message || '获取科室列表失败');
    departments.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取科室列表');
  }
}
async function fetchDoctors() {
  try {
    const res = await fetch(`${API}/doctors`);
    if (!res.ok) throw new Error((await res.json()).message || '获取医生列表失败');
    doctors.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取医生列表');
  }
}
async function fetchSchedules() {
  try {
    const res = await fetch(`${API}/schedules`);
    if (!res.ok) throw new Error((await res.json()).message || '获取排班列表失败');
    schedules.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取排班列表');
  }
}

async function createDept() {
  if (!newDeptName.value.trim()) { ElMessage.warning('请输入科室名称'); return; }
  try {
    const res = await fetch(`${API}/departments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newDeptName.value.trim() }) });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '添加科室失败');
      return;
    }
    newDeptName.value = '';
    await fetchDepartments();
    ElMessage.success('科室已添加');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function createDoctor() {
  const d = newDoctor.value;
  if (!d.name || !d.phone || !d.departmentId) { ElMessage.warning('请填写完整信息（科室、姓名、手机）'); return; }
  try {
    const res = await fetch(`${API}/doctors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, password: '123456' }) });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '添加医生失败');
      return;
    }
    newDoctor.value = { departmentId: '', name: '', phone: '', title: '' };
    await fetchDoctors();
    ElMessage.success('医生已添加');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function createSchedule() {
  const s = newSchedule.value;
  if (!s.doctorId || !s.date) { ElMessage.warning('请选择医生和日期'); return; }
  try {
    const res = await fetch(`${API}/schedules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '创建排班失败');
      return;
    }
    newSchedule.value = { doctorId: '', date: '', startTime: '08:00', endTime: '12:00', total: 20 };
    await fetchSchedules();
    ElMessage.success('排班已创建');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

onMounted(() => { fetchDepartments(); fetchDoctors(); fetchSchedules(); fetchConfig(); fetchLogs(); fetchWaitlist(); });

function openSuspend(row: any) {
  suspendTarget.value = row;
  suspendReason.value = '';
  suspendDialogVisible.value = true;
}

async function submitSuspend() {
  if (!suspendTarget.value || !suspendReason.value.trim()) return;
  try {
    const res = await fetch(`${API}/schedules/${suspendTarget.value.id}/suspend`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: suspendReason.value.trim() }),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '停诊操作失败');
      return;
    }
    suspendDialogVisible.value = false;
    ElMessage.success('停诊操作已完成');
    await fetchSchedules();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

function openSubstitute(row: any) {
  substituteSource.value = row;
  substituteTargetDoctorId.value = '';
  substituteTargetScheduleId.value = '';
  substituteReason.value = '';
  targetSchedules.value = [];
  const sourceDeptId = row.doctor?.department?.id;
  sameDeptDoctors.value = doctors.value.filter(
    (d: any) => d.department?.id === sourceDeptId && d.id !== row.doctor?.id,
  );
  substituteDialogVisible.value = true;
}

async function fetchTargetSchedules() {
  substituteTargetScheduleId.value = '';
  if (!substituteTargetDoctorId.value) { targetSchedules.value = []; return; }
  try {
    const res = await fetch(`${API}/schedules?doctorId=${substituteTargetDoctorId.value}`);
    if (!res.ok) throw new Error('获取目标排班失败');
    const all = await res.json();
    targetSchedules.value = all.filter((s: any) => !s.suspended && !s.substituted && s.remaining > 0);
  } catch (e: any) {
    ElMessage.error(e.message);
  }
}

async function submitSubstitute() {
  if (!substituteSource.value || !substituteTargetScheduleId.value) return;
  try {
    const res = await fetch(`${API}/schedules/${substituteSource.value.id}/substitute`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetScheduleId: substituteTargetScheduleId.value,
        reason: substituteReason.value.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      ElMessage.error(data.message || '替诊操作失败');
      return;
    }
    substituteDialogVisible.value = false;
    ElMessage.success(`替诊完成：转移${data.transferred}个预约，${data.waitlistMoved}个候补`);
    await fetchSchedules();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

async function fetchConfig() {
  try {
    const res = await fetch(`${API}/config`);
    if (res.ok) {
      const data = await res.json();
      clinicConfig.value = { cancelDeadlineHours: data.cancelDeadlineHours, advanceBookingDays: data.advanceBookingDays, lateThresholdMinutes: data.lateThresholdMinutes ?? 15, noShowThresholdMinutes: data.noShowThresholdMinutes ?? 30 };
    }
  } catch { /* ignore config fetch failure on load */ }
}

async function saveConfig() {
  if (clinicConfig.value.lateThresholdMinutes <= 0) { ElMessage.error('迟到阈值必须大于0'); return; }
  if (clinicConfig.value.noShowThresholdMinutes <= 0) { ElMessage.error('爽约阈值必须大于0'); return; }
  if (clinicConfig.value.lateThresholdMinutes >= clinicConfig.value.noShowThresholdMinutes) { ElMessage.error('迟到阈值必须小于爽约阈值'); return; }
  try {
    const res = await fetch(`${API}/config`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clinicConfig.value),
    });
    if (!res.ok) {
      const err = await res.json();
      ElMessage.error(err.message || '保存失败');
      return;
    }
    ElMessage.success('配置已保存');
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误');
  }
}

const operationLogs = ref<any[]>([]);
const logFilter = ref<{ type: string; dateRange: string[] | null }>({ type: '', dateRange: null });
const waitlistEntries = ref<any[]>([]);
const waitlistFilter = ref({ status: '' });
const visitRecords = ref<any[]>([]);
const visitRecordFilter = ref<{ patientPhone: string; doctorId: string; dateRange: string[] | null }>({ patientPhone: '', doctorId: '', dateRange: null });

async function fetchLogs() {
  try {
    const params = new URLSearchParams();
    if (logFilter.value.type) params.set('type', logFilter.value.type);
    if (logFilter.value.dateRange?.[0]) params.set('startDate', logFilter.value.dateRange[0]);
    if (logFilter.value.dateRange?.[1]) params.set('endDate', logFilter.value.dateRange[1]);
    const res = await fetch(`${API}/operation-logs?${params}`);
    if (!res.ok) throw new Error((await res.json()).message || '获取操作日志失败');
    operationLogs.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取操作日志');
  }
}

async function fetchWaitlist() {
  try {
    const params = new URLSearchParams();
    if (waitlistFilter.value.status) params.set('status', waitlistFilter.value.status);
    const res = await fetch(`${API}/waitlist?${params}`);
    if (!res.ok) throw new Error((await res.json()).message || '获取候补列表失败');
    waitlistEntries.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取候补列表');
  }
}

async function fetchVisitRecords() {
  try {
    const params = new URLSearchParams();
    if (visitRecordFilter.value.patientPhone) params.set('patientPhone', visitRecordFilter.value.patientPhone.trim());
    if (visitRecordFilter.value.doctorId) params.set('doctorId', visitRecordFilter.value.doctorId);
    if (visitRecordFilter.value.dateRange?.[0]) params.set('dateStart', visitRecordFilter.value.dateRange[0]);
    if (visitRecordFilter.value.dateRange?.[1]) params.set('dateEnd', visitRecordFilter.value.dateRange[1]);
    const res = await fetch(`${API}/visit-records?${params}`);
    if (!res.ok) throw new Error((await res.json()).message || '获取就诊记录失败');
    visitRecords.value = await res.json();
  } catch (e: any) {
    ElMessage.error(e.message || '网络错误：无法获取就诊记录');
  }
}

const LOG_TYPE_LABELS: Record<string, string> = {
  CREATE_DEPARTMENT: '新增科室', CREATE_DOCTOR: '新增医生', CREATE_SCHEDULE: '新增排班',
  SUSPEND_SCHEDULE: '停诊', SUBSTITUTE_SCHEDULE: '替诊', CREATE_APPOINTMENT: '预约', CANCEL_APPOINTMENT: '取消预约',
  RESCHEDULE_APPOINTMENT: '改期', CHECKIN: '签到', CALL_QUEUE: '叫号',
  SKIP_QUEUE: '过号', REQUEUE: '重新排队', APPROVE_CHANGE_REQUEST: '审批通过',
  REJECT_CHANGE_REQUEST: '审批拒绝', START_APPOINTMENT: '开始接诊', COMPLETE_APPOINTMENT: '完成接诊',
  WAITLIST_JOIN: '加入候补', WAITLIST_CANCEL: '取消候补', WAITLIST_PROMOTE: '候补转正', WAITLIST_CLOSE: '候补关闭',
  CREATE_VISIT_RECORD: '创建就诊记录', MARK_NO_SHOW: '标记爽约',
};

function logTypeLabel(type: string) { return LOG_TYPE_LABELS[type] || type; }

function logTagType(type: string): string {
  if (type.includes('CREATE') || type === 'CHECKIN') return '';
  if (type.includes('CANCEL') || type === 'SUSPEND_SCHEDULE' || type === 'SKIP_QUEUE' || type === 'REJECT_CHANGE_REQUEST' || type === 'MARK_NO_SHOW') return 'danger';
  if (type.includes('COMPLETE') || type === 'APPROVE_CHANGE_REQUEST') return 'success';
  if (type === 'SUBSTITUTE_SCHEDULE') return 'warning';
  return 'warning';
}

function roleLabel(role: string) {
  const map: Record<string, string> = { ADMIN: '管理员', PATIENT: '患者', FRONTDESK: '前台', DOCTOR: '医生' };
  return map[role] || role;
}

function resultLabel(result: string) {
  const map: Record<string, string> = { success: '成功', fail: '失败', blocked: '需审批' };
  return map[result] || result;
}
</script>
