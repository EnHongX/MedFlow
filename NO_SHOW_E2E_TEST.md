# No-Show Feature E2E Test Scenarios

## Test Overview
This document provides end-to-end test scenarios to verify the No-Show feature implementation.

## Prerequisites
- Backend server running on port 3000
- Frontend dev servers running (admin-web, clinic-web, patient-web)
- Database migrated with new fields (MARK_NO_SHOW operation type, no-show thresholds)

---

## Scenario 1: Admin Configuration

### Steps:
1. Open admin-web: `http://localhost:5000`
2. Navigate to **规则配置** tab
3. Verify two new configuration cards:
   - ⏰ **迟到阈值** (Late Threshold Minutes) - default: 15
   - 🚫 **爽约阈值** (No-Show Threshold Minutes) - default: 30
4. Set values: 迟到阈值 = 10, 爽约阈值 = 30
5. Click **保存配置**
6. Verify success message: "配置已保存"

### Expected Results:
- ✅ Two new config cards displayed correctly
- ✅ Input validation: positive integers only
- ✅ Validation: 迟到阈值 < 爽约阈值
- ✅ API call to `PATCH /config` with new fields
- ✅ Success message displayed

---

## Scenario 2: Appointment Status Display in Clinic Web

### Setup:
1. Open clinic-web: `http://localhost:5001`
2. Create a test appointment with startTime **15 minutes ago**:
   ```sql
   -- Execute in database
   INSERT INTO appointments (id, "patientId", "scheduleId", status, "createdAt")
   VALUES (
     uuid_generate_v4(),
     '<patient-id>',
     '<schedule-id>',
     'BOOKED',
     NOW() - INTERVAL '15 minutes'
   );
   ```

### Verification Steps:
1. Refresh clinic-web appointments list
2. Verify the appointment displays:
   - Status badge: **已迟到** (yellow/warning tag)
   - Check-in button: **签到** (green) should be visible
   - No "标记爽约" button yet

### Expected Results:
- ✅ Status shows "已迟到" with warning color
- ✅ Check-in button visible (patient can still check in when late)
- ✅ No-show button NOT visible (threshold not reached)

---

## Scenario 3: No-Show Threshold Reached

### Setup:
1. Create/modify appointment with startTime **35 minutes ago**:
   ```sql
   UPDATE appointments
   SET "createdAt" = NOW() - INTERVAL '35 minutes'
   WHERE id = '<appointment-id>';
   ```

### Verification Steps:
1. Refresh clinic-web
2. Verify the appointment displays:
   - Status badge: **已爽约** (yellow/warning tag)
   - Check-in button: **签到** (green) still visible (patient could still arrive)
   - No-show button: **标记爽约** (red/danger) now visible
3. Click **标记爽约** button
4. Select a reason: "患者未到场"
5. Click **确认**

### Expected Results:
- ✅ Status shows "已爽约" with warning color
- ✅ Both buttons visible: "签到" AND "标记爽约"
- ✅ Clicking "标记爽约" opens confirmation dialog
- ✅ Reason select dropdown populated
- ✅ API call to `PATCH /appointments/:id/mark-no-show`

---

## Scenario 4: Mark No-Show API Execution

### Backend Verification:
After clicking "标记爽约" in Scenario 3, verify:

### Database State:
```sql
-- Check appointment status
SELECT status, "updatedAt" FROM appointments WHERE id = '<appointment-id>';
-- Expected: status = 'NO_SHOW'

-- Check operation log
SELECT * FROM operation_logs
WHERE type = 'MARK_NO_SHOW'
ORDER BY "createdAt" DESC
LIMIT 1;
-- Expected: One record with appointmentId, reason, operatorRole='DOCTOR'
```

### Expected Results:
- ✅ Appointment status changed to `NO_SHOW`
- ✅ Operation log created with type `MARK_NO_SHOW`
- ✅ Log includes: appointmentId, reason, operatorRole='DOCTOR'
- ✅ API response: `{ success: true, status: 'NO_SHOW' }`

---

## Scenario 5: Patient Web Status Display

### Steps:
1. Open patient-web: `http://localhost:5002`
2. Login as the patient from Scenario 3
3. Navigate to **我的预约** tab
4. Verify the appointment card displays:
   - Status badge: **已爽约** (red/danger tag)
   - Action buttons: **无** (no check-in, no cancel)
   - Appointment details still visible

### Expected Results:
- ✅ Status shows "已爽约" with danger color
- ✅ No action buttons available (cannot check in or cancel NO_SHOW appointment)
- ✅ Appointment information (doctor, time, etc.) still displayed

---

## Scenario 6: Check-In Blocked for No-Show Appointment

### Steps:
1. In patient-web, attempt to check in for the NO_SHOW appointment
2. Frontend should disable/hide the check-in button
3. If bypassed (direct API call), backend should reject:
   ```bash
   curl -X POST http://localhost:3000/api/queue/checkin \
     -H "Content-Type: application/json" \
     -d '{"appointmentId": "<no-show-appointment-id>"}'
   ```

### Expected Results:
- ✅ Frontend: Check-in button disabled/hidden for NO_SHOW status
- ✅ Backend: API returns error "Appointment has been marked as no-show"
- ✅ No queue entry created

---

## Scenario 7: Operation Log Verification in Admin Web

### Steps:
1. Open admin-web: `http://localhost:5000`
2. Navigate to **操作日志** tab
3. Apply filter: Type = **标记爽约**
4. Verify the log entry:
   - Type badge: **标记爽约** (red/danger tag)
   - Target: Patient name or appointment ID
   - Reason: "患者未到场" (or selected reason)
   - Operator Role: 医生
   - Timestamp: Recent

### Expected Results:
- ✅ Filter dropdown includes "标记爽约" option
- ✅ Log entry displayed with correct information
- ✅ Type badge uses danger color (red)
- ✅ All fields populated correctly

---

## Scenario 8: Configuration Validation

### Test Cases:

#### Case 8.1: Invalid Threshold Values
1. Admin web: Set 迟到阈值 = -5
2. Save should fail with validation error

**Expected**: ❌ Frontend validation prevents negative input (min=1)

#### Case 8.2: Late Threshold ≥ No-Show Threshold
1. Admin web: Set 迟到阈值 = 30, 爽约阈值 = 20
2. Click save

**Expected**: ❌ Backend returns error: "迟到阈值必须小于爽约阈值"

#### Case 8.3: Valid Configuration
1. Admin web: Set 迟到阈值 = 15, 爽约阈值 = 30
2. Click save

**Expected**: ✅ Success message, configuration updated

---

## Scenario 9: Concurrent Access

### Setup:
- Two browser windows open clinic-web
- Both logged in as different doctors
- Same appointment visible to both

### Steps:
1. Window A: Click "标记爽约" on appointment X
2. Window B: Simultaneously click "标记爽约" on same appointment X
3. First request should succeed
4. Second request should return error (already NO_SHOW)

### Expected Results:
- ✅ Only one request succeeds (race condition prevented)
- ✅ Second request returns appropriate error message
- ✅ Database operation log shows only one MARK_NO_SHOW entry
- ✅ UI refreshes correctly in both windows

---

## Scenario 10: Check-In Still Allowed When Late (Not No-Show)

### Setup:
1. Create appointment with startTime **20 minutes ago** (between late and no-show thresholds)

### Steps:
1. Clinic web: Verify status shows "已迟到"
2. Click **签到** button
3. Verify check-in succeeds

### Expected Results:
- ✅ Status: "已迟到"
- ✅ Check-in button visible and enabled
- ✅ Check-in API succeeds: appointment status → CHECKED_IN
- ✅ Queue entry created successfully

---

## Success Checklist

- [ ] Admin configuration UI works (save/load)
- [ ] Clinic web displays correct status for all phases:
  - [ ] Not late yet (待就诊)
  - [ ] Late but not no-show (已迟到)
  - [ ] No-show threshold reached (已爽约)
- [ ] Mark no-show button appears only when threshold reached
- [ ] Check-in button remains visible (allows late arrivals)
- [ ] Mark no-show API executes successfully
- [ ] Operation log created in database
- [ ] Patient web shows no-show status correctly
- [ ] Check-in blocked for NO_SHOW appointments
- [ ] Admin web log filter includes "标记爽约"
- [ ] Log badge uses danger color (red)
- [ ] Configuration validation works
- [ ] Concurrent access handled correctly
- [ ] No TypeScript compilation errors
- [ ] All frontend dev servers start without errors

---

## Cleanup

After testing, reset test data:
```sql
-- Delete test appointments
DELETE FROM appointments WHERE id IN ('<test-appointment-ids>');

-- Delete test logs
DELETE FROM operation_logs WHERE type = 'MARK_NO_SHOW' AND "createdAt" > NOW() - INTERVAL '1 hour';

-- Reset config to defaults (optional)
UPDATE clinic_config SET late_threshold_minutes = 15, no_show_threshold_minutes = 30;
```

---

## Notes

- Ensure timezone consistency between database and frontend
- Test with different appointment times (morning, afternoon, evening)
- Verify behavior across time zones if applicable
- Test edge cases: exactly at threshold boundary (e.g., exactly 15 minutes)
- Performance test: Verify no-show check doesn't slow down large queue lists
