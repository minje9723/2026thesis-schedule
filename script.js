/**
 * 대학원 학위논문 발표 일정 조율 플랫폼 (script.js)
 * - 교수님 심사 가능 캘린더 (최상단 메인 섹터)
 * - 교수님 가능 일정(오전/오후) 종합 취합 및 필터링, 발표 시간은 확정 시 직접 입력
 * - 확정된 일정 원클릭 취소 기능 전면 지원
 * - 교수님별 심사가능현황에서 발표자 선택/입력 후 확정 & 취소 지원
 */

// ==========================================================================
// 1. Storage Keys, Professor Pool & Default Schedules
// ==========================================================================

const STORAGE_KEY_PRESENTERS = 'thesis_sched_roster_v7';
const STORAGE_KEY_PROF_AVAIL = 'thesis_sched_prof_avail_v7';

// 기본 심사위원 교수님 목록
const BASE_PROFESSORS = {
    internal: ["김수철 교수님", "이상옥 교수님", "권희홍 교수님", "한민수 교수님", "정용재 교수님"],
    external: ["정광용 교수님", "조남철 교수님", "박정혜 교수님", "이광웅 교수님"]
};

// 실제로 쓰는 목록 = 기본 목록 + 발표자가 심사위원단에 직접 입력한 심사위원 (refreshProfessorPool에서 갱신)
// 화면의 교수님 버튼·선택 목록은 모두 여기서 만들어짐
const PROFESSORS = { internal: [...BASE_PROFESSORS.internal], external: [...BASE_PROFESSORS.external] };
const ALL_PROF_NAMES = [...PROFESSORS.internal, ...PROFESSORS.external];

// 일단 숨겨 둔 화면 요소 (다시 보이려면 true)
const SHOW_ROSTER_COORDINATION_BUTTON = false;   // 발표자 카드의 [일정 조율/확정 →] 버튼
const SHOW_HEADER_PRESENTER_SELECT = false;      // 상단바의 '발표자 선택'
const SHOW_HEADER_HOME_BUTTON = false;           // 상단바의 [홈 (교수님 캘린더)] 버튼

const SCHEDULE_YEAR = 2026;
const SCHEDULE_MONTHS = [11, 12];
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// 기본 목록 + 발표자가 심사위원단에 직접 입력한 심사위원으로 교수님 명단을 다시 만듦
// (아무 발표자의 심사위원단에도 없으면 명단에서 자동으로 빠짐)
function refreshProfessorPool() {
    const known = new Set([...BASE_PROFESSORS.internal, ...BASE_PROFESSORS.external]);
    const added = { internal: [], external: [] };
    appState.presenters.forEach(p => (p.reviewers || []).forEach(r => {
        if (!r.name || known.has(r.name)) return;
        known.add(r.name);
        added[r.type === 'external' ? 'external' : 'internal'].push(r.name);
    }));
    PROFESSORS.internal = [...BASE_PROFESSORS.internal, ...added.internal];
    PROFESSORS.external = [...BASE_PROFESSORS.external, ...added.external];
    ALL_PROF_NAMES.splice(0, ALL_PROF_NAMES.length, ...PROFESSORS.internal, ...PROFESSORS.external);
    if (appState.profFilterTarget !== 'all' && !ALL_PROF_NAMES.includes(appState.profFilterTarget)) {
        appState.profFilterTarget = 'all';
    }
}

// 직접 입력한 이름을 다른 심사위원과 같은 형식("홍길동 교수님")으로 정리
function normalizeProfName(input) {
    const name = input.replace(/[\/]/g, '').replace(/\s+/g, ' ').trim().replace(/\s*교수님$/, '');
    return name ? `${name} 교수님` : '';
}

function getProfType(pName) {
    return PROFESSORS.external.includes(pName) ? 'external' : 'internal';
}

function getProfShortName(pName) {
    return pName.replace(' 교수님', '');
}

function profTypeBadgeHtml(type) {
    return type === 'external'
        ? '<span class="badge-tag-external-xs">외부</span>'
        : '<span class="badge-tag-internal-xs">내부</span>';
}

function toDateStr(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 해당 월의 평일(월~금) 목록
function getWeekdays(month) {
    const days = [];
    const daysInMonth = new Date(SCHEDULE_YEAR, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dayOfWeek = new Date(SCHEDULE_YEAR, month - 1, d).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        days.push({ dateStr: toDateStr(SCHEDULE_YEAR, month, d), dayNum: d, dayName: DAY_NAMES[dayOfWeek] });
    }
    return days;
}

// 일정 기간(11~12월) 전체 평일의 날짜 목록
function getAllScheduleDates() {
    return SCHEDULE_MONTHS.flatMap(m => getWeekdays(m).map(w => w.dateStr));
}

function formatDateWithDay(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const dayName = DAY_NAMES[new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay()];
    return { y, m, d, dayName };
}

// 하루를 오전/오후로 나눠 조율하고, 정확한 발표 시간(30분)은 확정할 때 직접 입력
// 교수님 가능 일정은 "2026-11-20 AM" / "2026-11-20 PM" 형식으로 저장
const PERIODS = [
    { key: 'AM', label: '오전', range: '09:00~12:00', minTime: '09:00', maxTime: '11:59' },
    { key: 'PM', label: '오후', range: '12:00~18:00', minTime: '12:00', maxTime: '18:00' }
];

function getPeriod(key) {
    return PERIODS.find(p => p.key === key);
}

function periodOfTime(time) {
    return time < '12:00' ? 'AM' : 'PM';
}

// 확정 일정의 시간대 (오전/오후 도입 전에 확정된 일정은 시간으로 판단)
function schedulePeriod(schedule) {
    return schedule.period || periodOfTime(schedule.time);
}

function scheduleText(schedule) {
    const { dayName } = formatDateWithDay(schedule.date);
    return `${schedule.date} (${dayName}) ${getPeriod(schedulePeriod(schedule)).label} ${schedule.time} ~ ${getEndTime30Min(schedule.time)}`;
}

// 30분 단위로 저장돼 있던 예전 일정("2026-11-20 14:00")을 오전/오후 형식으로 변환
function toPeriodSlot(slot) {
    const [date, part] = slot.split(' ');
    return getPeriod(part) ? slot : `${date} ${periodOfTime(part)}`;
}

function toPeriodSlots(slots) {
    return [...new Set(slots.map(toPeriodSlot))];
}

function toMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function getEndTime30Min(startTimeStr) {
    const totalMins = toMinutes(startTimeStr) + 30;
    return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

// 캘린더용 교수님 성(Initial) 추출 (내부/외부는 배지 색으로 구분)
function getProfInitial(pName) {
    return getProfShortName(pName).charAt(0);
}

// 기본(샘플) 발표자 명단 - Firestore가 비어 있을 때 최초 1회 채움
const DEFAULT_PRESENTERS = [
    // 1. 박사졸업발표 (내부 3 + 외부 2 = 총 5인)
    {
        id: "p_phd_1",
        name: "김민제",
        category: "박사졸업발표",
        duration: 30,
        thesisTitle: "학위청구논문 최종 디펜스",
        location: "세미나실 1호",
        reviewers: [
            { id: "r_p1_1", name: "이상옥 교수님", role: "심사위원장", type: "internal" },
            { id: "r_p1_2", name: "김수철 교수님", role: "지도교수", type: "internal" },
            { id: "r_p1_3", name: "권희홍 교수님", role: "심사위원", type: "internal" },
            { id: "r_p1_4", name: "정광용 교수님", role: "심사위원", type: "external" },
            { id: "r_p1_5", name: "조남철 교수님", role: "심사위원", type: "external" }
        ],
        confirmedSchedule: {
            date: "2026-11-27",
            period: "PM",
            time: "14:00",
            duration: 30,
            location: "세미나실 1호"
        }
    },

    // 2. 박사주제발표 (5명)
    {
        id: "p_prop_1",
        name: "강민지",
        category: "박사주제발표",
        duration: 30,
        thesisTitle: "박사 학위논문 연구계획 발표",
        location: "세미나실 2호",
        reviewers: [
            { id: "r_prop1_1", name: "김수철 교수님", role: "심사위원장", type: "internal" },
            { id: "r_prop1_2", name: "한민수 교수님", role: "지도교수", type: "internal" },
            { id: "r_prop1_3", name: "정용재 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_prop_2",
        name: "김정연",
        category: "박사주제발표",
        duration: 30,
        thesisTitle: "박사 학위논문 연구계획 발표",
        location: "세미나실 2호",
        reviewers: [
            { id: "r_prop2_1", name: "권희홍 교수님", role: "심사위원장", type: "internal" },
            { id: "r_prop2_2", name: "이상옥 교수님", role: "지도교수", type: "internal" },
            { id: "r_prop2_3", name: "한민수 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_prop_3",
        name: "최소연",
        category: "박사주제발표",
        duration: 30,
        thesisTitle: "박사 학위논문 연구계획 발표",
        location: "세미나실 2호",
        reviewers: [
            { id: "r_prop3_1", name: "정용재 교수님", role: "심사위원장", type: "internal" },
            { id: "r_prop3_2", name: "김수철 교수님", role: "지도교수", type: "internal" },
            { id: "r_prop3_3", name: "권희홍 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_prop_4",
        name: "최규리",
        category: "박사주제발표",
        duration: 30,
        thesisTitle: "박사 학위논문 연구계획 발표",
        location: "세미나실 2호",
        reviewers: [
            { id: "r_prop4_1", name: "이상옥 교수님", role: "심사위원장", type: "internal" },
            { id: "r_prop4_2", name: "한민수 교수님", role: "지도교수", type: "internal" },
            { id: "r_prop4_3", name: "정용재 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_prop_5",
        name: "오은정",
        category: "박사주제발표",
        duration: 30,
        thesisTitle: "박사 학위논문 연구계획 발표",
        location: "세미나실 2호",
        reviewers: [],
        confirmedSchedule: null
    },

    // 3. 석사졸업발표 (6명)
    {
        id: "p_ms_1",
        name: "김동녘",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 심사",
        location: "세미나실 3호",
        reviewers: [
            { id: "r_ms1_1", name: "김수철 교수님", role: "심사위원장", type: "internal" },
            { id: "r_ms1_2", name: "권희홍 교수님", role: "지도교수", type: "internal" },
            { id: "r_ms1_3", name: "이상옥 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_ms_2",
        name: "김신기",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 심사",
        location: "세미나실 3호",
        reviewers: [
            { id: "r_ms2_1", name: "한민수 교수님", role: "심사위원장", type: "internal" },
            { id: "r_ms2_2", name: "정용재 교수님", role: "지도교수", type: "internal" },
            { id: "r_ms2_3", name: "김수철 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_ms_3",
        name: "김효정",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 심사",
        location: "세미나실 3호",
        reviewers: [
            { id: "r_ms3_1", name: "권희홍 교수님", role: "심사위원장", type: "internal" },
            { id: "r_ms3_2", name: "김수철 교수님", role: "지도교수", type: "internal" },
            { id: "r_ms3_3", name: "이상옥 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_ms_4",
        name: "박혜리",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 심사",
        location: "세미나실 3호",
        reviewers: [
            { id: "r_ms4_1", name: "정용재 교수님", role: "심사위원장", type: "internal" },
            { id: "r_ms4_2", name: "한민수 교수님", role: "지도교수", type: "internal" },
            { id: "r_ms4_3", name: "권희홍 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_ms_5",
        name: "백주은",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 심사",
        location: "세미나실 3호",
        reviewers: [
            { id: "r_ms5_1", name: "이상옥 교수님", role: "심사위원장", type: "internal" },
            { id: "r_ms5_2", name: "김수철 교수님", role: "지도교수", type: "internal" },
            { id: "r_ms5_3", name: "정용재 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    },
    {
        id: "p_ms_6",
        name: "안바르",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 심사",
        location: "세미나실 3호",
        reviewers: [],
        confirmedSchedule: null
    }
];

// 예시 가능 일정 (시간으로 적어 두고 오전/오후로 변환해 사용)
function generateDefaultProfAvailability() {
    const byTime = {
        "김수철 교수님": [
            "2026-11-19 14:00", "2026-11-19 14:30", "2026-11-19 15:00", "2026-11-19 15:30",
            "2026-11-20 13:30", "2026-11-20 14:00", "2026-11-20 14:30", "2026-11-20 15:00",
            "2026-11-26 14:00", "2026-11-26 14:30", "2026-11-26 15:00",
            "2026-11-27 13:30", "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00",
            "2026-12-04 14:00", "2026-12-04 14:30", "2026-12-04 15:00"
        ],
        "이상옥 교수님": [
            "2026-11-20 14:00", "2026-11-20 14:30", "2026-11-20 15:00",
            "2026-11-25 10:00", "2026-11-25 10:30", "2026-11-25 11:00",
            "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00", "2026-11-27 15:30",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ],
        "권희홍 교수님": [
            "2026-11-19 10:00", "2026-11-19 10:30", "2026-11-19 14:00", "2026-11-19 14:30",
            "2026-11-20 14:00", "2026-11-20 14:30", "2026-11-20 15:00",
            "2026-11-26 14:00", "2026-11-26 14:30",
            "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ],
        "한민수 교수님": [
            "2026-11-19 10:00", "2026-11-19 10:30", "2026-11-19 11:00",
            "2026-11-24 14:00", "2026-11-24 14:30", "2026-11-24 15:00",
            "2026-11-26 14:00", "2026-11-26 14:30",
            "2026-12-01 14:00", "2026-12-01 14:30", "2026-12-01 15:00"
        ],
        "정용재 교수님": [
            "2026-11-19 10:00", "2026-11-19 10:30", "2026-11-19 14:00", "2026-11-19 14:30",
            "2026-11-24 14:00", "2026-11-24 14:30",
            "2026-11-26 14:00", "2026-11-26 14:30",
            "2026-12-01 14:00", "2026-12-01 14:30"
        ],
        "정광용 교수님": [
            "2026-11-27 13:30", "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ],
        "조남철 교수님": [
            "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00", "2026-11-27 15:30",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ],
        "박정혜 교수님": [
            "2026-11-20 14:00", "2026-11-20 14:30", "2026-11-20 15:00",
            "2026-11-27 14:00", "2026-11-27 14:30",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ],
        "이광웅 교수님": [
            "2026-11-20 14:00", "2026-11-20 14:30",
            "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ]
    };
    const result = {};
    Object.keys(byTime).forEach(name => { result[name] = toPeriodSlots(byTime[name]); });
    return result;
}

let appState = {
    presenters: [],
    profAvailability: {},
    activePage: 'home',
    currentPresenterId: 'p_phd_1',
    currentSubView: 'month',
    calendarMonth: 11,
    profCalendarMonth: 11,
    profFilterTarget: 'all',
    currentDayDate: '2026-11-27',
    currentWeekIndex: 0,
    detailModalDate: null
};

function loadState() {
    try {
        const savedPresenters = localStorage.getItem(STORAGE_KEY_PRESENTERS);
        const savedProfAvail = localStorage.getItem(STORAGE_KEY_PROF_AVAIL);

        if (savedPresenters && savedProfAvail) {
            appState.presenters = JSON.parse(savedPresenters);
            const savedAvail = JSON.parse(savedProfAvail);
            const defaults = generateDefaultProfAvailability();
            appState.profAvailability = {};
            Object.keys(savedAvail).forEach(pName => {
                appState.profAvailability[pName] = toPeriodSlots(savedAvail[pName]);
            });
            ALL_PROF_NAMES.forEach(pName => {
                if (!appState.profAvailability[pName]) appState.profAvailability[pName] = defaults[pName] || [];
            });
        } else {
            resetToSampleData();
            return;
        }
    } catch (e) {
        console.warn("Storage load error, resetting to default:", e);
        resetToSampleData();
        return;
    }

    if (appState.presenters.length > 0 && !appState.currentPresenterId) {
        appState.currentPresenterId = appState.presenters[0].id;
    }
}

function saveState() {
    if (firestoreDb) {
        // 한 동작 안의 여러 변경(드래그, 전체 선택 등)을 모아 한 번에 전송
        if (!flushScheduled) {
            flushScheduled = true;
            queueMicrotask(flushToFirestore);
        }
        return;
    }
    localStorage.setItem(STORAGE_KEY_PRESENTERS, JSON.stringify(appState.presenters));
    localStorage.setItem(STORAGE_KEY_PROF_AVAIL, JSON.stringify(appState.profAvailability));
}

function resetToSampleData() {
    appState.presenters = JSON.parse(JSON.stringify(DEFAULT_PRESENTERS));
    appState.profAvailability = generateDefaultProfAvailability();
    appState.currentPresenterId = "p_phd_1";
    saveState();
}

// ==========================================================================
// 1-2. Firestore 실시간 공유 저장 (firebase-config.js 설정 시 사용)
// - presenters/{발표자 id}: 발표자 정보 전체
// - profAvailability/{교수님 이름}: { slots: ["2026-11-27 14:00", ...] }
// ==========================================================================

const FS_COL_PRESENTERS = 'presenters';
const FS_COL_PROF_AVAIL = 'profAvailability';

let firestoreDb = null;
let firestoreUnsubscribes = [];
let flushScheduled = false;
let initialSyncDone = false;
let remoteRenderScheduled = false;
// 마지막으로 서버와 일치한 상태 (변경분만 골라 전송하기 위한 기준)
const syncedPresenters = {};   // id -> JSON 문자열
const syncedProfSlots = {};    // 교수님 이름 -> Set

function setSyncStatus(state, text) {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    el.className = `sync-status sync-${state}`;
    el.textContent = text;
}

function handleSyncError(err) {
    console.error('Firestore 오류:', err);
    setSyncStatus('error', '공유 저장 오류 · 새로고침 후 다시 시도하세요');
    showToast(`공유 저장에 실패했습니다. (${err.code || err.message})`);
}

function flushToFirestore() {
    flushScheduled = false;
    if (!firestoreDb) return;
    const FieldValue = firebase.firestore.FieldValue;

    // 발표자는 바뀐 항목만 전송 (예: 한 사람의 일정 확정과 다른 사람의 심사위원 수정이 서로 지워지지 않도록)
    appState.presenters.forEach(p => {
        const json = JSON.stringify(p);
        if (syncedPresenters[p.id] === json) return;
        const prev = syncedPresenters[p.id] ? JSON.parse(syncedPresenters[p.id]) : null;
        const data = JSON.parse(json);
        syncedPresenters[p.id] = json;

        const ref = firestoreDb.collection(FS_COL_PRESENTERS).doc(p.id);
        if (!prev) {
            ref.set(data).catch(handleSyncError);
            return;
        }
        const changedFields = Object.keys(data).filter(k => JSON.stringify(data[k]) !== JSON.stringify(prev[k]));
        if (changedFields.length) ref.set(data, { mergeFields: changedFields }).catch(handleSyncError);
    });

    // 교수님 일정은 슬롯 단위로 추가/삭제하여 여러 명이 동시에 고쳐도 서로 덮어쓰지 않음
    Object.keys(appState.profAvailability).forEach(pName => {
        const current = appState.profAvailability[pName] || [];
        const currentSet = new Set(current);
        const synced = syncedProfSlots[pName] || new Set();
        const added = current.filter(dt => !synced.has(dt));
        const removed = [...synced].filter(dt => !currentSet.has(dt));
        if (added.length === 0 && removed.length === 0) return;

        syncedProfSlots[pName] = currentSet;
        const ref = firestoreDb.collection(FS_COL_PROF_AVAIL).doc(pName);
        if (added.length) ref.set({ slots: FieldValue.arrayUnion(...added) }, { merge: true }).catch(handleSyncError);
        if (removed.length) ref.set({ slots: FieldValue.arrayRemove(...removed) }, { merge: true }).catch(handleSyncError);
    });
}

function seedFirestore(collectionName) {
    const batch = firestoreDb.batch();
    if (collectionName === FS_COL_PRESENTERS) {
        DEFAULT_PRESENTERS.forEach(p => {
            batch.set(firestoreDb.collection(FS_COL_PRESENTERS).doc(p.id), JSON.parse(JSON.stringify(p)));
        });
    } else {
        const defaults = generateDefaultProfAvailability();
        ALL_PROF_NAMES.forEach(pName => {
            batch.set(firestoreDb.collection(FS_COL_PROF_AVAIL).doc(pName), { slots: defaults[pName] || [] });
        });
    }
    batch.commit().catch(handleSyncError);
}

function presenterDefaultOrder(id) {
    const idx = DEFAULT_PRESENTERS.findIndex(d => d.id === id);
    return idx < 0 ? Infinity : idx;
}

// 기존 객체를 그대로 두고 내용만 교체 (열려 있는 모달이 들고 있는 참조가 끊기지 않도록)
function applyPresentersSnapshot(snapshot) {
    const serverIds = new Set();
    snapshot.docs.forEach(doc => {
        serverIds.add(doc.id);
        const data = doc.data();
        let p = appState.presenters.find(x => x.id === doc.id);
        if (p) {
            Object.keys(p).forEach(k => delete p[k]);
            Object.assign(p, data, { id: doc.id });
        } else {
            p = Object.assign({}, data, { id: doc.id });
            appState.presenters.push(p);
        }
        syncedPresenters[doc.id] = JSON.stringify(p);
    });

    appState.presenters = appState.presenters.filter(p => serverIds.has(p.id));
    appState.presenters.sort((a, b) => (presenterDefaultOrder(a.id) - presenterDefaultOrder(b.id)) || a.id.localeCompare(b.id));
    if (appState.presenters.length > 0 && !appState.presenters.some(p => p.id === appState.currentPresenterId)) {
        appState.currentPresenterId = appState.presenters[0].id;
    }
}

function applyProfAvailSnapshot(snapshot) {
    // 모든 문서를 보관하고, 화면에는 현재 명단(ALL_PROF_NAMES)에 있는 교수님만 표시
    // (직접 입력한 심사위원은 발표자 정보가 도착한 뒤 명단에 추가되므로 미리 걸러내지 않음)
    const next = {};
    const legacyDocs = [];
    ALL_PROF_NAMES.forEach(pName => { next[pName] = []; });
    snapshot.docs.forEach(doc => {
        const raw = doc.data().slots || [];
        next[doc.id] = toPeriodSlots(raw);
        if (!ALL_PROF_NAMES.includes(doc.id)) return;
        const legacy = raw.filter(slot => toPeriodSlot(slot) !== slot);
        if (legacy.length) legacyDocs.push({ name: doc.id, legacy, converted: next[doc.id] });
    });
    appState.profAvailability = next;

    // 30분 단위로 남아 있는 예전 일정은 오전/오후로 바꿔 저장 (추가와 삭제를 한 번에 처리)
    if (legacyDocs.length) {
        const FieldValue = firebase.firestore.FieldValue;
        const batch = firestoreDb.batch();
        legacyDocs.forEach(({ name, legacy, converted }) => {
            const ref = firestoreDb.collection(FS_COL_PROF_AVAIL).doc(name);
            batch.set(ref, { slots: FieldValue.arrayUnion(...converted) }, { merge: true });
            batch.set(ref, { slots: FieldValue.arrayRemove(...legacy) }, { merge: true });
        });
        batch.commit().catch(handleSyncError);
    }
    Object.keys(syncedProfSlots).forEach(k => delete syncedProfSlots[k]);
    Object.keys(next).forEach(pName => { syncedProfSlots[pName] = new Set(next[pName]); });
}

// 다른 사람의 변경이 도착하면 화면 갱신 (열려 있는 날짜별 현황 표도 함께)
function renderAfterRemoteChange() {
    if (remoteRenderScheduled) return;
    remoteRenderScheduled = true;
    setTimeout(() => {
        remoteRenderScheduled = false;
        renderAll();
        if (document.getElementById('modalDateProfDetail').classList.contains('active')) {
            refreshDateDetailRows();
        }
        if (document.getElementById('modalPresenterList').classList.contains('active')) {
            renderPresenterList();
        }
    }, 300);
}

function useLocalStorageOnly(statusState, statusText) {
    firestoreUnsubscribes.forEach(unsubscribe => unsubscribe());
    firestoreUnsubscribes = [];
    firestoreDb = null;
    loadState();
    renderAll();
    setSyncStatus(statusState, statusText);
}

function initDataSource() {
    const config = window.FIREBASE_CONFIG;
    if (!config) {
        useLocalStorageOnly('local', '공유 미설정 · 이 브라우저에만 저장');
        return;
    }

    try {
        if (!firebase.apps.length) firebase.initializeApp(config);
        firestoreDb = firebase.firestore();
    } catch (e) {
        console.error('Firebase 초기화 실패:', e);
        useLocalStorageOnly('error', '공유 연결 실패 · 이 브라우저에만 저장');
        return;
    }

    setSyncStatus('connecting', '공유 저장소 연결 중…');
    appState.presenters = [];
    appState.profAvailability = {};
    const loaded = { presenters: false, prof: false };
    const offline = { presenters: false, prof: false };

    const updateConnectionStatus = () => {
        if (offline.presenters || offline.prof) {
            setSyncStatus('connecting', '오프라인 · 연결되면 자동으로 저장됩니다');
        } else {
            setSyncStatus('live', '실시간 공유 중');
        }
    };

    const listen = (collectionName, key, applyFn) => {
        const unsubscribe = firestoreDb.collection(collectionName).onSnapshot({ includeMetadataChanges: true }, snapshot => {
            if (!firestoreDb) return;
            offline[key] = snapshot.metadata.fromCache;

            if (!loaded[key]) {
                // 서버 응답 전의 빈 캐시로 화면을 그리지 않음
                if (snapshot.metadata.fromCache) {
                    setSyncStatus('connecting', '서버 응답을 기다리는 중…');
                    return;
                }
                // 최초 사용 시 기본 데이터로 채움
                if (snapshot.empty) {
                    seedFirestore(collectionName);
                    return;
                }
            }
            applyFn(snapshot);
            loaded[key] = true;

            if (!initialSyncDone) {
                if (loaded.presenters && loaded.prof) {
                    initialSyncDone = true;
                    renderAll();
                    updateConnectionStatus();
                }
                return;
            }
            updateConnectionStatus();
            const hasRemoteChange = snapshot.docChanges().some(c => !c.doc.metadata.hasPendingWrites);
            if (hasRemoteChange) renderAfterRemoteChange();
        }, err => {
            if (!firestoreDb) return;
            if (!initialSyncDone) {
                console.error('Firestore 연결 실패:', err);
                useLocalStorageOnly('error', '공유 연결 실패 · 이 브라우저에만 저장');
                showToast(`공유 저장소에 연결하지 못했습니다. (${err.code || err.message})`);
            } else {
                handleSyncError(err);
            }
        });
        firestoreUnsubscribes.push(unsubscribe);
    };

    listen(FS_COL_PRESENTERS, 'presenters', applyPresentersSnapshot);
    listen(FS_COL_PROF_AVAIL, 'prof', applyProfAvailSnapshot);

    // 잘못된 프로젝트 설정이나 데이터베이스 미생성 시 SDK는 오류 없이 재시도만 반복하므로 안내
    setTimeout(() => {
        if (firestoreDb && !initialSyncDone) {
            setSyncStatus('error', '공유 저장소에 연결할 수 없습니다 · 설정을 확인하세요');
            showToast('공유 저장소에 연결할 수 없습니다. Firebase 설정과 네트워크를 확인하세요.');
        }
    }, 15000);
}

// ==========================================================================
// 2. Helper Functions
// ==========================================================================

function getCurrentPresenter() {
    return appState.presenters.find(p => p.id === appState.currentPresenterId) || appState.presenters[0];
}

function isProfAvailable(profName, dateTimeStr) {
    const list = appState.profAvailability[profName];
    if (!list) return false;
    return list.includes(dateTimeStr);
}

function toggleProfAvailability(profName, dateTimeStr) {
    if (!appState.profAvailability[profName]) {
        appState.profAvailability[profName] = [];
    }
    const list = appState.profAvailability[profName];
    const idx = list.indexOf(dateTimeStr);
    if (idx >= 0) {
        list.splice(idx, 1);
    } else {
        list.push(dateTimeStr);
    }
    saveState();
}

function getProfessorsAvailableOnDate(dateStr) {
    const activeProfs = [];
    ALL_PROF_NAMES.forEach(pName => {
        const slots = appState.profAvailability[pName] || [];
        const hasSlot = slots.some(s => s.startsWith(dateStr));
        if (hasSlot) activeProfs.push(pName);
    });
    return activeProfs;
}

function analyzeSlotForStudent(presenter, dateTimeStr) {
    const reviewers = presenter.reviewers || [];
    const total = reviewers.length;
    let availableCount = 0;
    const availableNames = [];
    const unavailableNames = [];

    reviewers.forEach(r => {
        if (isProfAvailable(r.name, dateTimeStr)) {
            availableCount++;
            availableNames.push(r.name);
        } else {
            unavailableNames.push(r.name);
        }
    });

    const isAllMatch = total > 0 && availableCount === total;
    return {
        total,
        availableCount,
        isAllMatch,
        availableNames,
        unavailableNames
    };
}

// 해당 날짜에 심사위원 전원이 가능한 시간대(오전/오후) 목록
function getAllMatchPeriods(presenter, dateStr) {
    return PERIODS.filter(p => analyzeSlotForStudent(presenter, `${dateStr} ${p.key}`).isAllMatch).map(p => p.key);
}

// 심사위원 전원이 가능한 시간대 전체 (11~12월 평일 오전/오후)
function findAllMatchSlots(presenter) {
    return getAllScheduleDates().flatMap(dateStr =>
        getAllMatchPeriods(presenter, dateStr).map(period => ({ dateStr, period }))
    );
}

// 발표 확정: 시간 입력 확인 → 시간 겹침·기존 확정·심사위원 미지정 확인 → 저장. 저장했으면 true
function confirmPresenterSchedule(presenter, dateStr, period, time, location) {
    if (!presenter) {
        alert("확정할 발표자를 먼저 선택해주세요.");
        return false;
    }
    const p = getPeriod(period);
    if (!/^\d{2}:\d{2}$/.test(time || '')) {
        alert("발표 시간을 입력해주세요. (예: 14:00)");
        return false;
    }
    if (time < p.minTime || time > p.maxTime) {
        alert(`${p.label} 발표 시간은 ${p.range} 사이로 입력해주세요.`);
        return false;
    }

    // 같은 날 30분 발표끼리 겹치는지 확인
    const overlapping = appState.presenters.find(x =>
        x !== presenter && x.confirmedSchedule && x.confirmedSchedule.date === dateStr &&
        Math.abs(toMinutes(x.confirmedSchedule.time) - toMinutes(time)) < 30
    );
    if (overlapping && !confirm(`${overlapping.name}님의 발표(${overlapping.confirmedSchedule.time}~${getEndTime30Min(overlapping.confirmedSchedule.time)})와 시간이 겹칩니다.\n그래도 확정하시겠습니까?`)) {
        return false;
    }

    if (presenter.confirmedSchedule) {
        const cur = presenter.confirmedSchedule;
        if (!confirm(`${presenter.name}님은 이미 ${cur.date} ${cur.time}에 확정되어 있습니다.\n${dateStr} ${time}(으)로 변경하여 확정하시겠습니까?`)) {
            return false;
        }
    }

    const analysis = analyzeSlotForStudent(presenter, `${dateStr} ${period}`);
    if (!analysis.isAllMatch && analysis.unavailableNames.length > 0) {
        if (!confirm(`주의: ${presenter.name}님의 심사위원 중 [${analysis.unavailableNames.join(', ')}] 교수님이 이 날 ${p.label}에 참석 가능으로 지정되어 있지 않습니다.\n그래도 확정하시겠습니까?`)) {
            return false;
        }
    }

    presenter.confirmedSchedule = { date: dateStr, period, time, duration: 30, location };
    saveState();
    renderAll();
    showToast(`${presenter.name}님의 발표가 ${dateStr} ${p.label} ${time}으로 확정되었습니다! 🎉`);
    return true;
}

// 확인 창을 띄운 뒤 확정 취소. 취소했으면 true
function cancelConfirmationWithPrompt(presenter) {
    if (!confirm(`${presenter.name}님의 확정된 심사 일정을 취소하시겠습니까?`)) return false;
    presenter.confirmedSchedule = null;
    saveState();
    renderAll();
    showToast(`${presenter.name}님의 심사 확정이 취소되었습니다.`);
    return true;
}

// 월~금 5열 캘린더 (앞뒤 빈칸은 이전/다음 달 날짜로 채움). fillDayCell(cell, weekday)로 각 날짜 칸을 채움
function renderWeekdayCalendar(grid, month, fillDayCell) {
    grid.innerHTML = '';
    const addPaddingCell = dayNum => {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${dayNum}</span></div>`;
        grid.appendChild(cell);
    };

    const firstDayOfWeek = new Date(SCHEDULE_YEAR, month - 1, 1).getDay();
    const leadingPadding = (firstDayOfWeek >= 1 && firstDayOfWeek <= 5) ? firstDayOfWeek - 1 : 0;
    const prevMonthDays = new Date(SCHEDULE_YEAR, month - 1, 0).getDate();
    for (let p = leadingPadding - 1; p >= 0; p--) addPaddingCell(prevMonthDays - p);

    const weekdays = getWeekdays(month);
    weekdays.forEach(w => {
        const cell = document.createElement('div');
        fillDayCell(cell, w);
        grid.appendChild(cell);
    });

    const trailingPadding = (5 - ((leadingPadding + weekdays.length) % 5)) % 5;
    for (let t = 1; t <= trailingPadding; t++) addPaddingCell(t);
}

// ==========================================================================
// 3. SECTOR 1: PROFESSORS CALENDAR (HOME OVERVIEW)
// ==========================================================================

// 홈 캘린더: '전체'일 때는 날짜를 누르면 오전/오후 현황 표,
// 교수님 이름을 골랐을 때는 날짜마다 [오전]/[오후] 버튼으로 그 교수님의 가능 일정을 바로 지정
function renderProfCalendarHero() {
    const month = appState.profCalendarMonth;
    const pickProf = appState.profFilterTarget === 'all' ? null : appState.profFilterTarget;

    document.getElementById('btnProfNov').className = `month-tab ${month === 11 ? 'active' : ''}`;
    document.getElementById('btnProfDec').className = `month-tab ${month === 12 ? 'active' : ''}`;

    const banner = document.getElementById('profPickBanner');
    banner.hidden = !pickProf;
    document.querySelector('.legend-cal-tip').hidden = !!pickProf;   // '날짜를 누르면 현황 표' 안내는 전체 보기에서만
    if (pickProf) {
        document.getElementById('profPickText').innerHTML =
            `📅 <strong>${pickProf}</strong> 가능 일정 선택 중 · <strong>[오전]/[오후]</strong>를 눌러 가능/불가를 바꾸고, <strong>날짜 칸</strong>을 누르면 하루 전체를 한 번에 선택/해제합니다.`;
        document.getElementById('btnProfPickAll').textContent =
            isProfMonthFull(pickProf, month) ? `${month}월 전체 해제` : `${month}월 전체 가능`;
    }

    renderWeekdayCalendar(document.getElementById('profCalendarGrid'), month, (cell, { dateStr, dayNum }) => {
        const confirmedHere = appState.presenters.filter(
            p => p.confirmedSchedule && p.confirmedSchedule.date === dateStr
        );

        let contentHtml = '';
        if (pickProf) {
            const isFullDay = PERIODS.every(p => isProfAvailable(pickProf, `${dateStr} ${p.key}`));
            cell.className = `cal-day-cell prof-cal-cell pick-mode ${isFullDay ? 'is-full' : ''}`;
            cell.title = isFullDay ? '누르면 오전·오후 한꺼번에 해제' : '누르면 오전·오후 한꺼번에 선택';
            contentHtml = `<div class="pick-halves">${PERIODS.map(p => {
                const on = isProfAvailable(pickProf, `${dateStr} ${p.key}`);
                return `<button type="button" class="pick-half ${on ? 'is-on' : ''}" data-period="${p.key}"
                                title="${p.label} ${p.range} · ${on ? '가능 (누르면 해제)' : '누르면 가능'}">${on ? '✓ ' : ''}${p.label}</button>`;
            }).join('')}</div>`;
        } else {
            const availableProfs = getProfessorsAvailableOnDate(dateStr);
            cell.className = `cal-day-cell prof-cal-cell ${confirmedHere.length > 0 ? 'has-confirmed' : ''}`;

            contentHtml = confirmedHere.map(item => `
                <div class="cal-slot-chip confirmed-chip" title="${item.name} (${item.category}) ${item.confirmedSchedule.time} 심사 확정" style="padding:2px 4px; font-size:0.7rem; font-weight:700; margin-bottom:4px;">
                    ⭐ ${item.name} <span style="font-size:0.62rem; opacity:0.85;">(${item.confirmedSchedule.time})</span>
                </div>
            `).join('');

            // 가능 교수님은 성(Initial)만 표기, 내부(파랑)/외부(주황)는 배지 색으로 구분
            if (availableProfs.length > 0) {
                contentHtml += `<div class="cal-prof-initials-wrap">${availableProfs.map(pName => `
                    <span class="prof-initial-badge ${getProfType(pName) === 'external' ? 'is-ext' : 'is-int'}" title="${pName} 참석 가능">
                        ${getProfInitial(pName)}
                    </span>
                `).join('')}</div>`;
            }
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${dayNum}</span>
            </div>
            <div class="cal-day-content">${contentHtml}</div>
        `;

        if (pickProf) {
            // 날짜 칸 = 하루 전체 선택/해제, [오전]/[오후] = 해당 칸만 (칸 클릭으로 번지지 않게 막음)
            cell.addEventListener('click', () => {
                toggleProfWholeDay(pickProf, dateStr);
                renderAll();
            });
            cell.querySelectorAll('.pick-half').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleProfAvailability(pickProf, `${dateStr} ${btn.dataset.period}`);
                    renderAll();
                });
            });
        } else {
            cell.addEventListener('click', () => {
                openDateProfDetailModal(dateStr);
            });
        }
    });
}

// 교수님 한 분의 하루(오전·오후) 일괄 선택/해제: 둘 다 가능이면 해제, 아니면 둘 다 가능으로
function toggleProfWholeDay(profName, dateStr) {
    const slots = PERIODS.map(p => `${dateStr} ${p.key}`);
    const allOn = slots.every(slot => isProfAvailable(profName, slot));
    slots.forEach(slot => {
        if (isProfAvailable(profName, slot) === allOn) toggleProfAvailability(profName, slot);
    });
}

// 해당 월 평일의 오전·오후 슬롯 전체
function getMonthSlots(month) {
    return getWeekdays(month).flatMap(w => PERIODS.map(p => `${w.dateStr} ${p.key}`));
}

function isProfMonthFull(profName, month) {
    return getMonthSlots(month).every(slot => isProfAvailable(profName, slot));
}

// 해당 월 평일 전체를 오전·오후 모두 가능(또는 전체 해제)으로 설정
function setProfMonthAvailability(profName, month, available) {
    const monthSlots = getMonthSlots(month);
    const current = appState.profAvailability[profName] || [];
    appState.profAvailability[profName] = available
        ? [...new Set([...current, ...monthSlots])]
        : current.filter(slot => !monthSlots.includes(slot));
    saveState();
}

// 교수님별 칩 (PROFESSORS 목록으로 생성) - 이름을 누르면 그 교수님의 가능 날짜 선택 모드
function renderProfFilterChips() {
    const container = document.getElementById('profFilterChips');
    const chip = (value, label) =>
        `<button class="prof-chip ${appState.profFilterTarget === value ? 'active' : ''}" data-prof="${value}">${label}</button>`;
    const group = names => names.map(n => chip(n, getProfShortName(n))).join('');

    container.innerHTML = chip('all', `전체 교수님 종합 (${ALL_PROF_NAMES.length}인)`)
        + `<span class="filter-divider">|</span>` + group(PROFESSORS.internal)
        + `<span class="filter-divider">|</span>` + group(PROFESSORS.external);

    container.querySelectorAll('.prof-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            appState.profFilterTarget = btn.getAttribute('data-prof');
            renderProfFilterChips();
            renderProfCalendarHero();
        });
    });
}

/**
 * MODAL: 날짜별 오전/오후 교수님 가능 일정 지정 & 발표자 확정 / 취소
 * - 교수님 이름을 눌러 오전/오후 참석 가능 여부 지정
 * - 발표자 선택(심사위원 전원 가능 후보 먼저) + 정확한 발표 시간 직접 입력
 * - 확정 / 확정 취소 (한 시간대에 여러 명 확정 가능)
 * (클릭 처리는 DOMContentLoaded에서 #dateProfDetailContent에 위임)
 */
function openDateProfDetailModal(dateStr) {
    const { y, m, d, dayName } = formatDateWithDay(dateStr);
    appState.detailModalDate = dateStr;

    document.getElementById('dateProfDetailTitle').textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일) 교수님 가능 일정 지정 및 발표자 확정`;

    document.getElementById('dateProfDetailContent').innerHTML = `
        <div class="date-detail-guide">
            <div>💡 <strong>교수님 이름</strong>을 눌러 오전/오후 참석 가능 여부를 지정하고, <strong>발표자를 선택하고 발표 시간을 입력</strong>한 뒤 <strong>[확정]</strong>을 누르세요.</div>
            <span class="date-detail-guide-sub">색이 채워진 이름 = 참석 가능 · 한 시간대에 여러 발표자 확정 가능 · 확정 후에도 [취소] 가능</span>
        </div>
        <div class="mobile-table-scroll-wrap" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="daily-table date-detail-table">
            <thead>
                <tr>
                    <th style="width: 95px;" class="center">시간대</th>
                    <th>참석 가능 교수님 (눌러서 지정)</th>
                    <th style="width: 250px;">발표자 선택 · 발표 시간 입력</th>
                    <th style="width: 190px;" class="center">확정 / 취소</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        </div>
    `;

    refreshDateDetailRows();
    document.getElementById('modalDateProfDetail').classList.add('active');
}

// 표의 행만 다시 그림 (입력 중인 발표자·시간과 스크롤 위치 유지)
function refreshDateDetailRows() {
    const dateStr = appState.detailModalDate;
    const tbody = document.querySelector('#dateProfDetailContent tbody');
    if (!dateStr || !tbody) return;

    const drafts = {};
    tbody.querySelectorAll('tr[data-period]').forEach(tr => {
        const sel = tr.querySelector('.slot-presenter-select');
        const timeInput = tr.querySelector('.slot-time-input');
        drafts[tr.dataset.period] = { presenterId: sel ? sel.value : '', time: timeInput ? timeInput.value : '' };
    });
    tbody.innerHTML = PERIODS.map(p => buildDateDetailRow(dateStr, p, drafts[p.key] || { presenterId: '', time: '' })).join('');
}

function buildDateDetailRow(dateStr, period, draft) {
    const slot = `${dateStr} ${period.key}`;
    const confirmedHere = appState.presenters
        .filter(p => p.confirmedSchedule && p.confirmedSchedule.date === dateStr && schedulePeriod(p.confirmedSchedule) === period.key)
        .sort((a, b) => a.confirmedSchedule.time.localeCompare(b.confirmedSchedule.time));

    const profToggles = ALL_PROF_NAMES.map(name => {
        const on = isProfAvailable(name, slot);
        const typeClass = getProfType(name) === 'external' ? 'is-ext' : 'is-int';
        return `<button type="button" class="slot-prof-toggle ${typeClass} ${on ? 'is-on' : ''}" data-prof="${name}" data-period="${period.key}"
                        title="${name} · ${on ? '참석 가능 (누르면 해제)' : '미지정 (누르면 참석 가능)'}">${getProfShortName(name)}</button>`;
    }).join('');

    const candidates = [];
    const others = [];
    appState.presenters.forEach(p => {
        const analysis = analyzeSlotForStudent(p, slot);
        (analysis.isAllMatch ? candidates : others).push({ p, analysis });
    });
    const option = ({ p, analysis }) => {
        const notes = [];
        if (!analysis.isAllMatch) notes.push(analysis.total === 0 ? '심사위원 미지정' : `${analysis.availableCount}/${analysis.total} 가능`);
        if (p.confirmedSchedule) notes.push(`${p.confirmedSchedule.date.slice(5)} ${p.confirmedSchedule.time} 확정됨`);
        const label = `${p.name} (${p.category.replace('발표', '')})${notes.length ? ' · ' + notes.join(' · ') : ''}`;
        return `<option value="${p.id}" ${p.id === draft.presenterId ? 'selected' : ''}>${label}</option>`;
    };

    const confirmedList = confirmedHere.map(p => `
        <div class="slot-confirmed-item">
            <span class="status-badge confirmed">⭐ ${p.confirmedSchedule.time} ${p.name}</span>
            <button type="button" class="btn btn-sm btn-danger btn-modal-cancel-slot" data-id="${p.id}">취소</button>
        </div>
    `).join('');

    return `
        <tr class="daily-time-row ${confirmedHere.length ? 'is-confirmed-row' : ''}" data-period="${period.key}">
            <td class="center slot-period-cell">
                <strong>${period.label}</strong>
                <span>${period.range}</span>
            </td>
            <td class="slot-prof-cell">${profToggles}</td>
            <td>
                <select class="form-control slot-presenter-select">
                    <option value="">-- 발표자 선택 --</option>
                    ${candidates.length ? `<optgroup label="심사위원 전원 가능 (${candidates.length}명)">${candidates.map(option).join('')}</optgroup>` : ''}
                    ${others.length ? `<optgroup label="그 외 발표자">${others.map(option).join('')}</optgroup>` : ''}
                </select>
                <label class="slot-time-label">발표 시간
                    <input type="time" class="form-control slot-time-input" min="${period.minTime}" max="${period.maxTime}" step="300" value="${draft.time}">
                </label>
                <div class="slot-candidate-count ${candidates.length ? 'has-candidates' : ''}">${candidates.length ? `✓ 전원 가능 후보 ${candidates.length}명` : '전원 가능 후보 없음'}</div>
            </td>
            <td class="center">
                <button type="button" class="btn btn-sm btn-success btn-modal-confirm-slot">확정</button>
                ${confirmedList}
            </td>
        </tr>
    `;
}

// ==========================================================================
// 4. SECTOR 3: PRESENTER ROSTER & MATCHING SUMMARY
// ==========================================================================

const CATEGORY_PILLS = {
    '박사졸업발표': { label: '박사 졸업', className: 'pill-phd-grad' },
    '박사주제발표': { label: '박사 주제', className: 'pill-phd-prop' },
    '석사졸업발표': { label: '석사 졸업', className: 'pill-ms-grad' }
};

// [전체 발표자] 카드를 누르면 나오는 발표자 명단과 심사 일자 (구분별 순서)
function renderPresenterList() {
    const presenters = Object.keys(CATEGORY_PILLS).flatMap(cat => appState.presenters.filter(p => p.category === cat));
    const confirmedCount = presenters.filter(p => p.confirmedSchedule).length;
    document.getElementById('presenterListSummary').textContent =
        `총 ${presenters.length}명 · 심사 일자 확정 ${confirmedCount}명 · 미정 ${presenters.length - confirmedCount}명`;

    const rows = presenters.map(p => {
        const cs = p.confirmedSchedule;
        const pill = CATEGORY_PILLS[p.category];
        let when = '<span class="presenter-list-pending">미정</span>';
        if (cs) {
            const { m, d, dayName } = formatDateWithDay(cs.date);
            when = `<strong>${Number(m)}월 ${Number(d)}일 (${dayName}) ${getPeriod(schedulePeriod(cs)).label} ${cs.time}~${getEndTime30Min(cs.time)}</strong>`
                + (cs.location ? `<span class="presenter-list-location">${cs.location}</span>` : '');
        }
        return `
            <tr class="${cs ? 'is-confirmed' : ''}">
                <td><span class="cat-pill ${pill.className}">${pill.label}</span></td>
                <td class="presenter-list-name">${p.name}</td>
                <td>${when}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('presenterListContent').innerHTML = `
        <table class="presenter-list-table">
            <thead><tr><th>구분</th><th>발표자</th><th>심사 일시</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function openPresenterListModal() {
    renderPresenterList();
    document.getElementById('modalPresenterList').classList.add('active');
}

function renderPresentersSection() {
    const presenters = appState.presenters;

    const phdGradList = presenters.filter(p => p.category === '박사졸업발표');
    const phdPropList = presenters.filter(p => p.category === '박사주제발표');
    const msList = presenters.filter(p => p.category === '석사졸업발표');
    const confirmedCount = presenters.filter(p => p.confirmedSchedule).length;

    document.getElementById('statTotalCount').textContent = presenters.length;
    document.getElementById('statPhdGradCount').textContent = phdGradList.length;
    document.getElementById('statPhdPropCount').textContent = phdPropList.length;
    document.getElementById('statMsCount').textContent = msList.length;
    document.getElementById('statConfirmedCount').textContent = confirmedCount;

    renderRosterGrid('rosterPhdGrad', phdGradList);
    renderRosterGrid('rosterPhdProp', phdPropList);
    renderRosterGrid('rosterMsGrad', msList);
}

function renderRosterGrid(containerId, list) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    list.forEach(p => {
        const reviewers = p.reviewers || [];
        const isConfirmed = !!p.confirmedSchedule;
        const totalGoldenSlots = findAllMatchSlots(p).length;

        const card = document.createElement('div');
        card.className = `roster-card ${isConfirmed ? 'is-confirmed-card' : ''}`;

        let statusBadgeHtml = '';
        if (isConfirmed) {
            const cs = p.confirmedSchedule;
            statusBadgeHtml = `
                <span class="status-badge confirmed">⭐ ${cs.date.slice(5)} ${getPeriod(schedulePeriod(cs)).label} ${cs.time} 확정</span>
                <button class="btn btn-sm btn-danger btn-roster-cancel" data-id="${p.id}" title="확정을 취소합니다">취소</button>
            `;
        } else if (reviewers.length === 0) {
            statusBadgeHtml = `<span class="status-badge need-committee">심사위원 선택 필요</span>`;
        } else if (totalGoldenSlots > 0) {
            statusBadgeHtml = `<span class="status-badge match-found">✨ 심사위원 전원 가능 시간대 ${totalGoldenSlots}개</span>`;
        } else {
            statusBadgeHtml = `<span class="status-badge">교수님 일정 취합중</span>`;
        }

        // 항목(역할+이름) 단위로만 줄바꿈되도록 각각 묶어서 표시
        const reviewerListHtml = reviewers.length > 0
            ? reviewers.map(r => `<span class="roster-reviewer"><span class="roster-reviewer-role">${r.role}</span>${getProfShortName(r.name)}</span>`).join('')
            : '<span class="roster-reviewer-empty">미등록</span>';

        card.innerHTML = `
            <div class="roster-card-header">
                <h4 class="roster-student-name">${p.name}</h4>
            </div>

            <div class="roster-status-row">${statusBadgeHtml}</div>

            <div class="roster-reviewer-preview">
                <div class="roster-reviewer-title">심사위원단 ${reviewers.length}인</div>
                <div class="roster-reviewer-list">${reviewerListHtml}</div>
            </div>

            <div class="roster-card-actions">
                <button class="btn btn-sm btn-outline btn-manage-committee" data-id="${p.id}">
                    심사위원 선택
                </button>
                ${SHOW_ROSTER_COORDINATION_BUTTON ? `
                <button class="btn btn-sm btn-primary btn-jump-coordination" data-id="${p.id}">
                    일정 조율/확정 →
                </button>` : ''}
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.btn-roster-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const student = appState.presenters.find(p => p.id === id);
            if (student) cancelConfirmationWithPrompt(student);
        });
    });

    container.querySelectorAll('.btn-manage-committee').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const target = appState.presenters.find(p => p.id === id);
            if (target) openPresenterModal(target);
        });
    });

    container.querySelectorAll('.btn-jump-coordination').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            navigateToPresenter(id);
        });
    });
}

// ==========================================================================
// 5. PAGE 2: INDIVIDUAL PRESENTER COORDINATION
// ==========================================================================

function navigateToPresenter(presenterId) {
    appState.currentPresenterId = presenterId;
    appState.activePage = 'detail';
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateToHome() {
    appState.activePage = 'home';
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePresenterSelectorDropdown() {
    const selector = document.getElementById('currentPresenterSelect');
    selector.innerHTML = '';

    const groups = {
        "박사졸업발표": [],
        "박사주제발표": [],
        "석사졸업발표": []
    };

    appState.presenters.forEach(p => {
        if (groups[p.category]) groups[p.category].push(p);
    });

    for (const [catName, list] of Object.entries(groups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = catName;
        list.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.name} ${p.confirmedSchedule ? '(확정)' : ''}`;
            if (p.id === appState.currentPresenterId) opt.selected = true;
            optgroup.appendChild(opt);
        });
        selector.appendChild(optgroup);
    }
}

function updateDetailBanner() {
    const presenter = getCurrentPresenter();
    if (!presenter) return;

    document.getElementById('bannerDegree').textContent = presenter.category;
    document.getElementById('bannerThesis').textContent = `발표자: ${presenter.name} (${presenter.thesisTitle || '학위청구논문 발표'})`;
    document.getElementById('bannerDuration').textContent = `인당 30분`;
    document.getElementById('bannerLocation').textContent = presenter.location || "세미나실 1호";

    const statusBadge = document.getElementById('bannerStatus');
    if (presenter.confirmedSchedule) {
        statusBadge.className = 'status-badge confirmed';
        statusBadge.innerHTML = `심사 확정 (${scheduleText(presenter.confirmedSchedule)}) <button class="btn btn-sm btn-danger btn-banner-cancel" style="padding:1px 6px; font-size:0.7rem; margin-left:6px;">취소</button>`;
        statusBadge.querySelector('.btn-banner-cancel').onclick = (e) => {
            e.stopPropagation();
            cancelConfirmationWithPrompt(presenter);
        };
    } else {
        statusBadge.className = 'status-badge';
        statusBadge.textContent = '일정 조율 진행중';
    }

    const reviewers = presenter.reviewers || [];
    const extCount = reviewers.filter(r => r.type === 'external').length;
    const intCount = reviewers.length - extCount;
    document.getElementById('bannerCommitteeCount').textContent = reviewers.length === 0
        ? '심사위원 미지정'
        : extCount > 0
        ? `총 ${reviewers.length}인 (내부 ${intCount} + 외부 ${extCount})`
        : `총 ${reviewers.length}인 (내부 ${intCount})`;

    const tagsContainer = document.getElementById('bannerCommitteeTags');
    tagsContainer.innerHTML = `
        <div class="committee-title-row">
            <span>심사위원단 (${reviewers.length}인)</span>
            <span>교수님 일정 현황</span>
        </div>
    `;

    reviewers.forEach(r => {
        const pSlots = appState.profAvailability[r.name] || [];
        const hasInput = pSlots.length > 0;
        let roleClass = 'role-member';
        if (r.role.includes('위원장')) roleClass = 'role-chair';
        else if (r.role.includes('지도')) roleClass = 'role-advisor';

        const chip = document.createElement('div');
        chip.className = 'committee-member-chip';
        chip.innerHTML = `
            <div>
                ${profTypeBadgeHtml(r.type)}
                <span class="member-role-tag ${roleClass}">${r.role}</span>
                <strong>${r.name}</strong>
            </div>
            <span class="avail-state-dot ${hasInput ? 'dot-done' : 'dot-pending'}" title="${hasInput ? '가능 일정 입력됨' : '미입력'}"></span>
        `;
        tagsContainer.appendChild(chip);
    });
}

function renderMonthlyCalendar() {
    const presenter = getCurrentPresenter();
    const month = appState.calendarMonth;

    document.getElementById('periodLabel').textContent = `${SCHEDULE_YEAR}년 ${month}월`;
    document.getElementById('chipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('chipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    renderWeekdayCalendar(document.getElementById('calendarGridBody'), month, (cell, { dateStr, dayNum }) => {
        const cs = presenter.confirmedSchedule;
        const isConfirmed = cs && cs.date === dateStr;
        const matchPeriods = getAllMatchPeriods(presenter, dateStr);

        cell.className = `cal-day-cell ${isConfirmed ? 'confirmed-day' : ''}`;

        let badgeHtml = '';
        let chipsHtml = '';
        if (isConfirmed) {
            badgeHtml = `<span class="cal-day-badge badge-confirmed">⭐ 확정</span>`;
            chipsHtml = `<div class="cal-slot-chip confirmed-chip" style="font-size:0.7rem; padding:2px 4px;">⭐ ${getPeriod(schedulePeriod(cs)).label} ${cs.time} 확정</div>`;
        } else if (matchPeriods.length > 0) {
            badgeHtml = `<span class="cal-day-badge badge-golden">전원가능</span>`;
            chipsHtml = `<div class="cal-slot-chip golden" style="font-size:0.7rem; padding:2px 4px;">✓ ${matchPeriods.map(k => getPeriod(k).label).join('·')} 가능</div>`;
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${dayNum}</span>
                ${badgeHtml}
            </div>
            <div class="cal-day-content">${chipsHtml}</div>
        `;

        cell.addEventListener('click', () => {
            appState.currentDayDate = dateStr;
            switchSubView('day');
        });
    });
}

// 11~12월이 포함된 주(월~금) 목록
function getAllWeeks() {
    const weeks = [];
    const curDate = new Date(SCHEDULE_YEAR, SCHEDULE_MONTHS[0] - 1, 1);
    const endDate = new Date(SCHEDULE_YEAR, SCHEDULE_MONTHS[SCHEDULE_MONTHS.length - 1], 0);

    const day = curDate.getDay();
    curDate.setDate(curDate.getDate() + (day === 0 ? -6 : 1) - day);

    while (curDate <= endDate) {
        const weekDays = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(curDate);
            d.setDate(d.getDate() + i);
            weekDays.push({
                dateStr: toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate()),
                dayName: DAY_NAMES[d.getDay()],
                dayNum: d.getDate(),
                month: d.getMonth() + 1
            });
        }
        curDate.setDate(curDate.getDate() + 7);

        if (weekDays.some(w => SCHEDULE_MONTHS.includes(w.month))) {
            const first = weekDays[0];
            const last = weekDays[4];
            const label = `${first.month}/${first.dayNum} ~ ${last.month}/${last.dayNum} (${first.month === 11 ? '11월' : '12월'})`;
            weeks.push({ label, days: weekDays });
        }
    }
    return weeks;
}

function renderWeeklyTimetable() {
    const presenter = getCurrentPresenter();
    const weeks = getAllWeeks();
    const weekSelect = document.getElementById('weekSelect');
    const matrixContainer = document.getElementById('weeklyMatrix');

    weekSelect.innerHTML = '';
    weeks.forEach((w, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `제 ${idx + 1}주차: ${w.label}`;
        if (idx === appState.currentWeekIndex) opt.selected = true;
        weekSelect.appendChild(opt);
    });

    const displayDays = (weeks[appState.currentWeekIndex] || weeks[0]).days;
    const cs = presenter.confirmedSchedule;

    let tableHtml = `<table class="weekly-table"><thead><tr><th style="width: 100px;">시간대</th>`;
    displayDays.forEach(d => {
        tableHtml += `
            <th>
                ${d.dayName}요일
                <span class="date-sub">${d.month}월 ${d.dayNum}일</span>
            </th>
        `;
    });
    tableHtml += `</tr></thead><tbody>`;

    PERIODS.forEach(period => {
        tableHtml += `<tr><td class="time-col" style="font-size:0.75rem;"><strong>${period.label}</strong><br>${period.range}</td>`;

        displayDays.forEach(d => {
            const slot = `${d.dateStr} ${period.key}`;
            const analysis = analyzeSlotForStudent(presenter, slot);
            const isConfirmed = cs && cs.date === d.dateStr && schedulePeriod(cs) === period.key;

            let cellClass = 'week-slot-cell';
            let cellContent = '';
            if (isConfirmed) {
                cellClass += ' slot-confirmed';
                cellContent = `<span class="slot-inner-badge" style="cursor:pointer;" title="클릭하여 확정 취소">⭐ ${cs.time} 확정 (취소)</span>`;
            } else if (analysis.isAllMatch) {
                cellClass += ' slot-all';
                cellContent = `<span class="slot-inner-badge">✓ 전원 가능</span>`;
            } else {
                cellClass += ' slot-none';
                cellContent = `<span style="font-size:0.7rem; color:#cbd5e1;">-</span>`;
            }

            const tooltip = `[${d.dateStr} ${period.label}]\n가능 교수님: ${analysis.availableNames.join(', ') || '없음'}\n불가: ${analysis.unavailableNames.join(', ') || '없음'}`;
            tableHtml += `
                <td class="${cellClass}" title="${tooltip}" data-date="${d.dateStr}" data-confirmed="${isConfirmed ? 'true' : 'false'}">
                    ${cellContent}
                </td>
            `;
        });

        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;
    matrixContainer.innerHTML = tableHtml;

    matrixContainer.querySelectorAll('.week-slot-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            if (cell.getAttribute('data-confirmed') === 'true') {
                cancelConfirmationWithPrompt(presenter);
            } else {
                appState.currentDayDate = cell.getAttribute('data-date');
                switchSubView('day');
            }
        });
    });
}

function renderDailyDetail() {
    const presenter = getCurrentPresenter();
    const dateStr = appState.currentDayDate;
    const { y, m, d, dayName } = formatDateWithDay(dateStr);

    document.getElementById('currentDayTitle').textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일)`;
    document.getElementById('directDatePicker').value = dateStr;

    const reviewers = presenter.reviewers || [];
    const matrixContainer = document.getElementById('dailyMatrix');
    const cs = presenter.confirmedSchedule;

    let tableHtml = `<table class="daily-table"><thead><tr><th style="width: 110px;" class="center">시간대</th>`;
    reviewers.forEach(r => {
        tableHtml += `
            <th>
                <div class="daily-person-header">
                    <span>${profTypeBadgeHtml(r.type)} ${r.name}</span>
                    <span class="p-role">${r.role}</span>
                </div>
            </th>
        `;
    });
    tableHtml += `
                    <th style="width: 130px;" class="center">참석 현황</th>
                    <th style="width: 150px;" class="center">확정/취소</th>
                </tr>
            </thead>
            <tbody>
    `;

    PERIODS.forEach(period => {
        const slot = `${dateStr} ${period.key}`;
        const analysis = analyzeSlotForStudent(presenter, slot);
        const isConfirmed = cs && cs.date === dateStr && schedulePeriod(cs) === period.key;

        tableHtml += `
            <tr class="${analysis.isAllMatch ? 'daily-time-row golden-row' : 'daily-time-row'}">
                <td class="center slot-period-cell"><strong>${period.label}</strong><span>${period.range}</span></td>
        `;

        reviewers.forEach(r => {
            const avail = isProfAvailable(r.name, slot);
            tableHtml += `
                <td>
                    <button class="daily-cell-btn ${avail ? 'status-yes' : 'status-no'}" data-prof-name="${r.name}" data-slot="${slot}">
                        ${avail ? '✓ 참석 가능' : '— 불가'}
                    </button>
                </td>
            `;
        });

        let summaryPill = '';
        if (analysis.isAllMatch) {
            summaryPill = `<span class="daily-summary-pill all-match">🏆 전원 가능 (${analysis.total}/${analysis.total})</span>`;
        } else if (analysis.availableCount > 0) {
            summaryPill = `<span class="daily-summary-pill partial-match" style="background:#f1f5f9; color:#64748b; border-color:#cbd5e1;">${analysis.availableCount} / ${analysis.total}명 가능</span>`;
        } else {
            summaryPill = `<span style="font-size:0.75rem; color:#94a3b8;">가능자 없음</span>`;
        }

        let actionBtn = '';
        if (isConfirmed) {
            actionBtn = `<button class="btn btn-sm btn-danger btn-direct-cancel-final" title="클릭하여 확정을 취소합니다">⭐ ${cs.time} 확정 취소</button>`;
        } else if (analysis.isAllMatch) {
            actionBtn = `<button class="btn btn-sm btn-success btn-select-final" data-period="${period.key}">이 시간대로 확정</button>`;
        } else {
            actionBtn = `<span style="font-size:0.75rem; color:#94a3b8; font-weight:500;">불가 (${analysis.unavailableNames.length}인 불참)</span>`;
        }

        tableHtml += `
                <td class="center">${summaryPill}</td>
                <td class="center">${actionBtn}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    matrixContainer.innerHTML = tableHtml;

    matrixContainer.querySelectorAll('.daily-cell-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pName = btn.getAttribute('data-prof-name');
            toggleProfAvailability(pName, btn.getAttribute('data-slot'));
            renderDailyDetail();
            updateDetailBanner();
            showToast(`${pName}의 일정이 수정되었습니다.`);
        });
    });

    matrixContainer.querySelectorAll('.btn-select-final').forEach(btn => {
        btn.addEventListener('click', () => {
            openConfirmModal(presenter, dateStr, btn.getAttribute('data-period'));
        });
    });

    matrixContainer.querySelectorAll('.btn-direct-cancel-final').forEach(btn => {
        btn.addEventListener('click', () => {
            cancelConfirmationWithPrompt(presenter);
        });
    });
}

function renderRecommendations() {
    const presenter = getCurrentPresenter();
    const container = document.getElementById('recommendationsList');
    container.innerHTML = '';

    const matchedSlots = findAllMatchSlots(presenter);
    const committeeSize = (presenter.reviewers || []).length;
    const cs = presenter.confirmedSchedule;

    if (matchedSlots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h4>아직 심사위원 전원 가능한 일정이 없습니다.</h4>
                <p>홈 화면 캘린더에서 <strong>날짜를 눌러</strong> 심사위원 교수님들의 오전/오후 가능 여부를 지정해주세요.</p>
                <button class="btn btn-primary" style="margin-top:14px;" onclick="navigateToHome()">
                    홈 캘린더로 이동
                </button>
            </div>
        `;
        return;
    }

    matchedSlots.forEach((slot, index) => {
        const { y, m, d, dayName } = formatDateWithDay(slot.dateStr);
        const period = getPeriod(slot.period);
        const isConfirmed = cs && cs.date === slot.dateStr && schedulePeriod(cs) === slot.period;

        const card = document.createElement('div');
        card.className = `recommendation-card is-golden ${isConfirmed ? 'is-confirmed' : ''}`;
        card.innerHTML = `
            <div class="rec-rank-badge">#${index + 1}</div>
            <div class="rec-info">
                <div class="rec-datetime">
                    ${y}년 ${m}월 ${d}일 (${dayName}) ${period.label} (${period.range})
                    ${isConfirmed ? `<span class="status-badge confirmed" style="margin-left:8px;">${cs.time} 확정됨</span>` : ''}
                </div>
                <div class="rec-meta">
                    <span>✨ <strong>심사위원 전원(${committeeSize}인) 참석 가능</strong></span>
                    <span>배정 시간: 30분</span>
                    <span>장소: ${presenter.location || '세미나실'}</span>
                </div>
            </div>
            <div class="rec-actions">
                <button class="btn btn-outline btn-sm btn-rec-jump" data-date="${slot.dateStr}">일자별 상세 보기</button>
                <button class="btn ${isConfirmed ? 'btn-danger' : 'btn-success'} btn-sm btn-rec-confirm" data-date="${slot.dateStr}" data-period="${slot.period}" data-confirmed="${isConfirmed ? 'true' : 'false'}">
                    ${isConfirmed ? '확정 취소하기' : '이 시간대로 확정'}
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    container.querySelectorAll('.btn-rec-jump').forEach(btn => {
        btn.addEventListener('click', () => {
            appState.currentDayDate = btn.getAttribute('data-date');
            switchSubView('day');
        });
    });

    container.querySelectorAll('.btn-rec-confirm').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-confirmed') === 'true') {
                cancelConfirmationWithPrompt(presenter);
            } else {
                openConfirmModal(presenter, btn.getAttribute('data-date'), btn.getAttribute('data-period'));
            }
        });
    });
}

// ==========================================================================
// 6. COMMITTEE MANAGEMENT & OTHER MODALS
// ==========================================================================

function openPresenterModal(presenterToEdit) {
    const modal = document.getElementById('modalPresenter');
    const title = document.getElementById('modalPresenterTitle');

    title.textContent = `${presenterToEdit.name} 심사위원단 및 발표 정보 설정`;
    document.getElementById('editPresenterId').value = presenterToEdit.id;
    document.getElementById('inputPresenterName').value = presenterToEdit.name;
    document.getElementById('inputCategory').value = presenterToEdit.category;
    document.getElementById('inputThesisTitle').value = presenterToEdit.thesisTitle || '';
    document.getElementById('inputLocation').value = presenterToEdit.location || '세미나실 1호';

    renderCommitteeRows(presenterToEdit.category, presenterToEdit.reviewers);

    const catSelect = document.getElementById('inputCategory');
    catSelect.onchange = () => {
        renderCommitteeRows(catSelect.value, []);
    };

    modal.classList.add('active');
}

function renderCommitteeRows(category, existingReviewers = []) {
    const list = document.getElementById('reviewersInputList');
    list.innerHTML = '';

    const isPhdGrad = category === '박사졸업발표';
    const hint = document.getElementById('committeeRuleHint');
    const subtitle = document.getElementById('modalPresenterSubtitle');
    const internalList = PROFESSORS.internal.map(getProfShortName).join(', ');
    const externalList = PROFESSORS.external.map(getProfShortName).join(', ');
    const customReviewerHint = `<br>목록에 없는 심사위원은 <strong>[+ 목록에 없는 심사위원 직접 입력]</strong>으로 추가하세요. 저장하면 교수님 목록에도 추가됩니다.`;

    if (isPhdGrad) {
        subtitle.textContent = "규정: 박사졸업발표는 내부 심사위원 3인 + 외부 심사위원 2인 (총 5인) 구성입니다.";
        hint.innerHTML = `<span class="badge-tag-internal">내부 3인</span> (${internalList}) + <span class="badge-tag-external">외부 2인</span> (${externalList} 중 2인) 총 5인을 지정하세요.${customReviewerHint}`;

        const defaultRoles = [
            { role: "심사위원장", type: "internal" },
            { role: "지도교수", type: "internal" },
            { role: "심사위원", type: "internal" },
            { role: "심사위원", type: "external" },
            { role: "심사위원", type: "external" }
        ];

        defaultRoles.forEach((def, idx) => {
            const current = existingReviewers[idx];
            const currentName = current ? current.name : '';
            addProfessorSelectRow(def.role, def.type, currentName);
        });
    } else {
        // 석사졸업발표·박사주제발표: 내부/외부 구분 없이 자유 구성 (내부 3인 규정 해제)
        subtitle.textContent = "석사졸업발표 및 박사주제발표는 내부·외부 심사위원을 자유롭게 구성할 수 있습니다.";
        hint.innerHTML = `<span class="badge-tag-internal">내부</span> (${internalList}) · <span class="badge-tag-external">외부</span> (${externalList}) 구분 없이 자유롭게 지정하세요.${customReviewerHint}`;

        const rows = existingReviewers.length > 0
            ? existingReviewers.map(r => ({ role: r.role, name: r.name }))
            : ["심사위원장", "지도교수", "심사위원"].map(role => ({ role, name: '' }));

        rows.forEach(r => addProfessorSelectRow(r.role, 'any', r.name));
    }
}

function roleSelectHtml(role) {
    return `
        <select class="form-control r-role" style="font-size:0.8rem;">
            ${['심사위원장', '지도교수', '심사위원'].map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
    `;
}

// type: 'internal' | 'external' | 'any' (내부·외부 모두 선택 가능)
function addProfessorSelectRow(role = '심사위원', type = 'internal', selectedName = '') {
    const list = document.getElementById('reviewersInputList');
    const row = document.createElement('div');
    row.className = 'reviewer-row-item prof-select-row';

    const toOptions = names => names
        .map(pName => `<option value="${pName}" ${selectedName === pName ? 'selected' : ''}>${pName}</option>`)
        .join('');
    const internalNames = PROFESSORS.internal;
    const externalNames = PROFESSORS.external;

    let optionsHtml;
    if (type === 'any') {
        optionsHtml = `<option value="">-- 내부/외부 심사위원 선택 --</option>`
            + `<optgroup label="내부 심사위원">${toOptions(internalNames)}</optgroup>`
            + `<optgroup label="외부 심사위원">${toOptions(externalNames)}</optgroup>`;
    } else {
        const typeLabel = type === 'external' ? '외부' : '내부';
        optionsHtml = `<option value="">-- ${typeLabel} 심사위원 선택 --</option>`
            + toOptions(type === 'external' ? externalNames : internalNames);
    }

    row.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
            <span class="r-type-badge"></span>
            ${roleSelectHtml(role)}
        </div>
        <select class="form-control r-name" required>
            ${optionsHtml}
        </select>
        <button type="button" class="btn-remove-row" title="행 삭제">&times;</button>
    `;

    const badge = row.querySelector('.r-type-badge');
    const nameSelect = row.querySelector('.r-name');
    const updateBadge = () => {
        if (type === 'any' && !nameSelect.value) {
            badge.className = 'badge-tag-internal-xs';
            badge.textContent = '내/외';
            return;
        }
        const badgeType = type === 'any' ? getProfType(nameSelect.value) : type;
        badge.className = badgeType === 'external' ? 'badge-tag-external-xs' : 'badge-tag-internal-xs';
        badge.textContent = badgeType === 'external' ? '외부' : '내부';
    };
    updateBadge();
    nameSelect.addEventListener('change', updateBadge);

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
    });

    list.appendChild(row);
}

// 목록에 없는 심사위원을 이름과 내부/외부를 직접 입력해 추가하는 행 (저장하면 교수님 명단에도 추가됨)
function addCustomReviewerRow(role = '심사위원') {
    const list = document.getElementById('reviewersInputList');
    const row = document.createElement('div');
    row.className = 'reviewer-row-item prof-select-row custom-reviewer-row';
    row.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
            <select class="form-control r-custom-type" title="내부/외부">
                <option value="internal">내부</option>
                <option value="external">외부</option>
            </select>
            ${roleSelectHtml(role)}
        </div>
        <input type="text" class="form-control r-custom-name" placeholder="심사위원 이름 직접 입력 (예: 홍길동)" maxlength="20" required>
        <button type="button" class="btn-remove-row" title="행 삭제">&times;</button>
    `;
    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
    });
    list.appendChild(row);
    row.querySelector('.r-custom-name').focus();
}

document.getElementById('btnAddReviewerRow').addEventListener('click', () => {
    const cat = document.getElementById('inputCategory').value;
    const type = cat === '박사졸업발표' ? 'external' : 'any';
    addProfessorSelectRow('심사위원', type, '');
});

document.getElementById('btnAddCustomReviewer').addEventListener('click', () => {
    addCustomReviewerRow();
});

document.getElementById('formPresenter').addEventListener('submit', (e) => {
    e.preventDefault();

    const editId = document.getElementById('editPresenterId').value;
    const category = document.getElementById('inputCategory').value;
    const thesisTitle = document.getElementById('inputThesisTitle').value.trim();
    const location = document.getElementById('inputLocation').value.trim();

    const reviewerRows = document.querySelectorAll('#reviewersInputList .reviewer-row-item');
    const reviewers = [];
    reviewerRows.forEach((row, idx) => {
        const rRole = row.querySelector('.r-role').value;
        const customName = row.querySelector('.r-custom-name');
        // 직접 입력한 이름이 이미 명단에 있으면 그 심사위원으로 처리 (내부/외부도 기존 값 사용)
        const rName = customName ? normalizeProfName(customName.value) : row.querySelector('.r-name').value;
        const rType = customName && !ALL_PROF_NAMES.includes(rName)
            ? row.querySelector('.r-custom-type').value
            : getProfType(rName);
        if (rName) {
            reviewers.push({
                id: `r_${editId}_${idx + 1}`,
                name: rName,
                role: rRole,
                type: rType
            });
        }
    });

    const names = reviewers.map(r => r.name);
    const duplicates = [...new Set(names.filter((name, i) => names.indexOf(name) !== i))];
    if (duplicates.length) {
        alert(`같은 심사위원이 두 번 들어 있습니다: ${duplicates.map(getProfShortName).join(', ')}`);
        return;
    }

    const p = appState.presenters.find(x => x.id === editId);
    if (p) {
        p.category = category;
        p.duration = 30;
        p.thesisTitle = thesisTitle;
        p.location = location;
        p.reviewers = reviewers;
    }

    saveState();
    closeModal('modalPresenter');
    renderAll();
    showToast(`${p.name} 심사위원단 및 발표 정보가 저장되었습니다.`);
});

function openConfirmModal(presenter, dateStr, period) {
    const modal = document.getElementById('modalConfirmDefense');
    const { y, m, d, dayName } = formatDateWithDay(dateStr);
    const p = getPeriod(period);
    const cs = presenter.confirmedSchedule;

    document.getElementById('confirmModalPresenter').textContent = `${presenter.name} (${presenter.category})`;
    document.getElementById('confirmModalDateTime').textContent = `${y}년 ${m}월 ${d}일 (${dayName}) ${p.label} (${p.range})`;
    document.getElementById('confirmModalLocation').value = presenter.location || "세미나실 1호";

    const timeInput = document.getElementById('confirmModalTime');
    timeInput.min = p.minTime;
    timeInput.max = p.maxTime;
    timeInput.value = cs && cs.date === dateStr && schedulePeriod(cs) === period ? cs.time : '';

    const btnCancel = document.getElementById('btnCancelConfirmation');
    const leadText = document.getElementById('confirmLeadText');

    if (cs) {
        btnCancel.style.display = 'inline-flex';
        leadText.textContent = `현재 ${presenter.name}님의 심사 일정이 ${cs.date} ${cs.time}로 확정되어 있습니다. 시간을 변경하거나 확정을 취소할 수 있습니다.`;
    } else {
        btnCancel.style.display = 'none';
        leadText.textContent = `발표 시간을 입력하고 학위논문 발표(30분) 일정을 확정하세요.`;
    }

    document.getElementById('btnSaveConfirmation').onclick = () => {
        const location = document.getElementById('confirmModalLocation').value.trim() || '세미나실';
        if (confirmPresenterSchedule(presenter, dateStr, period, timeInput.value, location)) {
            closeModal('modalConfirmDefense');
        }
    };

    btnCancel.onclick = () => {
        if (cancelConfirmationWithPrompt(presenter)) closeModal('modalConfirmDefense');
    };

    modal.classList.add('active');
    timeInput.focus();
}

function openNoticeModal() {
    const presenter = getCurrentPresenter();
    const modal = document.getElementById('modalNotice');
    const textarea = document.getElementById('noticeTextarea');

    const confirmed = presenter.confirmedSchedule;
    const reviewers = presenter.reviewers || [];
    let reviewerListStr = reviewers.length > 0
        ? reviewers.map(r => `  - [${r.type === 'external' ? '외부' : '내부'}] ${r.role}: ${r.name}`).join('\n')
        : '  (심사위원단 구성 예정)';

    let scheduleNotice = '';
    if (confirmed) {
        scheduleNotice = `
[발표 확정 일시 및 장소]
■ 일시: ${scheduleText(confirmed)} [배정 시간: 30분]
■ 장소: ${confirmed.location}
`;
    } else {
        const topSlots = findAllMatchSlots(presenter).slice(0, 3)
            .map((slot, idx) => {
                const { dayName } = formatDateWithDay(slot.dateStr);
                const p = getPeriod(slot.period);
                return `  ${idx + 1}. ${slot.dateStr} (${dayName}) ${p.label} (${p.range})`;
            })
            .join('\n');

        scheduleNotice = `
[심사위원 전원 가능 추천 시간대 (조율중)]
${topSlots || '  (현재 전원 가능한 시간대를 취합 중입니다)'}
※ 정확한 발표 시간 확정 후 재안내 예정입니다.
`;
    }

    const noticeText = `[2026 후기 학위논문 발표 일정 안내 (인당 30분)]

안녕하세요, ${presenter.category} 대상자 ${presenter.name}입니다.

2026년 후기 학위청구논문 발표 및 심사 일정을 아래와 같이 공유드립니다.

1. 발표자: ${presenter.name} (${presenter.category})
2. 배정 시간: 인당 30분
3. 논문 제목: ${presenter.thesisTitle || '학위논문 발표'}
4. 심사위원단 구성:
${reviewerListStr}

5. 발표 일정:
${scheduleNotice}
감사합니다.

일정 조율 사이트: https://minje9723.github.io/2026thesis-schedule/
`;

    textarea.value = noticeText;
    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

function switchSubView(subViewName) {
    appState.currentSubView = subViewName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-subview') === subViewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.querySelectorAll('.subview-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const periodNav = document.getElementById('periodNav');
    if (subViewName === 'month') {
        periodNav.style.display = 'flex';
        document.getElementById('subviewMonth').classList.add('active');
        renderMonthlyCalendar();
    } else if (subViewName === 'week') {
        periodNav.style.display = 'none';
        document.getElementById('subviewWeek').classList.add('active');
        renderWeeklyTimetable();
    } else if (subViewName === 'day') {
        periodNav.style.display = 'none';
        document.getElementById('subviewDay').classList.add('active');
        renderDailyDetail();
    } else if (subViewName === 'recommend') {
        periodNav.style.display = 'none';
        document.getElementById('subviewRecommend').classList.add('active');
        renderRecommendations();
    }
}

function renderAll() {
    refreshProfessorPool();
    renderProfFilterChips();
    updatePresenterSelectorDropdown();

    const pageHome = document.getElementById('pageHome');
    const pageDetail = document.getElementById('pageDetail');
    const btnNavHome = document.getElementById('btnNavHome');

    if (appState.activePage === 'home') {
        pageHome.classList.add('active');
        pageDetail.classList.remove('active');
        btnNavHome.classList.add('active-nav');
        renderProfCalendarHero();
        renderPresentersSection();
    } else {
        pageHome.classList.remove('active');
        pageDetail.classList.add('active');
        btnNavHome.classList.remove('active-nav');
        updateDetailBanner();
        switchSubView(appState.currentSubView);
    }
}

// Global Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('.presenter-selector-box').hidden = !SHOW_HEADER_PRESENTER_SELECT;
    document.getElementById('btnNavHome').hidden = !SHOW_HEADER_HOME_BUTTON;
    renderProfFilterChips();
    initDataSource();

    // Top Navigation
    document.getElementById('brandHomeBtn').addEventListener('click', navigateToHome);
    document.getElementById('btnNavHome').addEventListener('click', navigateToHome);
    document.getElementById('btnBackToHome').addEventListener('click', navigateToHome);

    document.getElementById('currentPresenterSelect').addEventListener('change', (e) => {
        navigateToPresenter(e.target.value);
    });

    // [전체 발표자] 카드: 발표자 명단과 심사 일자
    const presenterListCard = document.getElementById('btnPresenterList');
    presenterListCard.addEventListener('click', openPresenterListModal);
    presenterListCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPresenterListModal();
        }
    });

    // 교수님 가능 날짜 선택 모드 종료
    document.getElementById('btnProfPickAll').addEventListener('click', () => {
        const profName = appState.profFilterTarget;
        const month = appState.profCalendarMonth;
        const makeAvailable = !isProfMonthFull(profName, month);
        setProfMonthAvailability(profName, month, makeAvailable);
        renderAll();
        showToast(`${profName}: ${month}월 평일 ${makeAvailable ? '전체 가능으로 설정' : '전체 해제'}했습니다.`);
    });
    document.getElementById('btnProfPickDone').addEventListener('click', () => {
        appState.profFilterTarget = 'all';
        renderProfFilterChips();
        renderProfCalendarHero();
    });

    // Month toggles in Sector 1
    document.getElementById('btnProfNov').addEventListener('click', () => {
        appState.profCalendarMonth = 11;
        renderProfCalendarHero();
    });
    document.getElementById('btnProfDec').addEventListener('click', () => {
        appState.profCalendarMonth = 12;
        renderProfCalendarHero();
    });

    // Detail Action Buttons
    document.getElementById('btnEditCommitteeDirect').addEventListener('click', () => {
        openPresenterModal(getCurrentPresenter());
    });

    // Subtabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchSubView(btn.getAttribute('data-subview'));
        });
    });

    // 일정 기간이 11·12월 두 달이라 이전/다음 모두 다른 달로 전환
    const toggleCalendarMonth = () => {
        appState.calendarMonth = appState.calendarMonth === 11 ? 12 : 11;
        renderMonthlyCalendar();
    };
    document.getElementById('btnPrevPeriod').addEventListener('click', toggleCalendarMonth);
    document.getElementById('btnNextPeriod').addEventListener('click', toggleCalendarMonth);
    document.getElementById('chipNov').addEventListener('click', () => {
        appState.calendarMonth = 11;
        renderMonthlyCalendar();
    });
    document.getElementById('chipDec').addEventListener('click', () => {
        appState.calendarMonth = 12;
        renderMonthlyCalendar();
    });

    document.getElementById('weekSelect').addEventListener('change', (e) => {
        appState.currentWeekIndex = parseInt(e.target.value, 10);
        renderWeeklyTimetable();
    });

    // 이전/다음 평일로 이동 (11~12월 범위 안에서)
    const moveDailyDate = step => {
        const dates = getAllScheduleDates();
        const idx = dates.findIndex(dt => step > 0 ? dt > appState.currentDayDate : dt >= appState.currentDayDate);
        const target = step > 0 ? dates[idx] : dates[(idx < 0 ? dates.length : idx) - 1];
        if (target) {
            appState.currentDayDate = target;
            renderDailyDetail();
        }
    };
    document.getElementById('btnPrevDay').addEventListener('click', () => moveDailyDate(-1));
    document.getElementById('btnNextDay').addEventListener('click', () => moveDailyDate(1));
    document.getElementById('directDatePicker').addEventListener('change', (e) => {
        appState.currentDayDate = e.target.value;
        renderDailyDetail();
    });

    document.getElementById('btnCopyAnnouncement').addEventListener('click', openNoticeModal);
    document.getElementById('btnDoCopyNotice').addEventListener('click', () => {
        const textarea = document.getElementById('noticeTextarea');
        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
            showToast("공지문이 클립보드에 복사되었습니다! 📋");
            closeModal('modalNotice');
        }).catch(() => {
            document.execCommand('copy');
            showToast("공지문이 복사되었습니다.");
            closeModal('modalNotice');
        });
    });

    // 날짜별 현황 모달: 교수님 가능 여부 지정 / 확정 / 취소 (표를 다시 그려도 동작하도록 위임)
    document.getElementById('dateProfDetailContent').addEventListener('click', (e) => {
        const toggle = e.target.closest('.slot-prof-toggle');
        if (toggle) {
            toggleProfAvailability(toggle.dataset.prof, `${appState.detailModalDate} ${toggle.dataset.period}`);
            refreshDateDetailRows();
            renderAll();
            return;
        }

        const confirmBtn = e.target.closest('.btn-modal-confirm-slot');
        if (confirmBtn) {
            const row = confirmBtn.closest('tr');
            const select = row.querySelector('.slot-presenter-select');
            const timeInput = row.querySelector('.slot-time-input');
            const presenter = appState.presenters.find(p => p.id === select.value);
            const location = presenter ? (presenter.location || '세미나실 1호') : '';
            if (confirmPresenterSchedule(presenter, appState.detailModalDate, row.dataset.period, timeInput.value, location)) {
                select.value = '';
                timeInput.value = '';
                refreshDateDetailRows();
            }
            return;
        }

        const cancelBtn = e.target.closest('.btn-modal-cancel-slot');
        if (cancelBtn) {
            const presenter = appState.presenters.find(p => p.id === cancelBtn.dataset.id);
            if (presenter && cancelConfirmationWithPrompt(presenter)) refreshDateDetailRows();
        }
    });

    // Modal Close handlers
    document.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetModalId = btn.getAttribute('data-close') || btn.closest('.modal-backdrop').id;
            closeModal(targetModalId);
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.classList.remove('active');
        });
    });
});
