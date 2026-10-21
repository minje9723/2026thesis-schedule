/**
 * 대학원 학위논문 발표 일정 조율 플랫폼 (script.js)
 * - 교수님 심사 가능 캘린더 (최상단 메인 섹터)
 * - 교수님 가능 일정(30분 단위) 종합 취합 및 필터링
 * - 확정된 일정 원클릭 취소 기능 전면 지원
 * - 교수님별 심사가능현황에서 발표자 선택/입력 후 확정 & 취소 지원
 */

// ==========================================================================
// 1. Storage Keys, Professor Pool & Default Schedules
// ==========================================================================

const STORAGE_KEY_PRESENTERS = 'thesis_sched_roster_v7';
const STORAGE_KEY_PROF_AVAIL = 'thesis_sched_prof_avail_v7';

// 심사위원 교수님 목록 (화면의 필터·선택 목록은 모두 여기서 만들어짐)
const PROFESSORS = {
    internal: ["김수철 교수님", "이상옥 교수님", "권희홍 교수님", "한민수 교수님", "정용재 교수님"],
    external: ["정광용 교수님", "조남철 교수님", "박정혜 교수님", "이광웅 교수님"]
};

const ALL_PROF_NAMES = [...PROFESSORS.internal, ...PROFESSORS.external];

const SCHEDULE_YEAR = 2026;
const SCHEDULE_MONTHS = [11, 12];
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

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

const TIME_SLOTS = [
    "09:00", "09:30",
    "10:00", "10:30",
    "11:00", "11:30",
    "12:00", "12:30",
    "13:00", "13:30",
    "14:00", "14:30",
    "15:00", "15:30",
    "16:00", "16:30",
    "17:00", "17:30",
    "18:00"
];

function getEndTime30Min(startTimeStr) {
    const [h, m] = startTimeStr.split(':').map(Number);
    let totalMins = h * 60 + m + 30;
    const endH = Math.floor(totalMins / 60);
    const endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
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
            time: "14:00",
            duration: 30,
            location: "세미나실 1호"
        }
    },

    // 2. 박사주제발표 (4명)
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

function generateDefaultProfAvailability() {
    return {
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
    modalProfInputMonth: 11,
    modalProfTargetName: ALL_PROF_NAMES[0]
};

function loadState() {
    try {
        const savedPresenters = localStorage.getItem(STORAGE_KEY_PRESENTERS);
        const savedProfAvail = localStorage.getItem(STORAGE_KEY_PROF_AVAIL);

        if (savedPresenters && savedProfAvail) {
            appState.presenters = JSON.parse(savedPresenters);
            appState.profAvailability = JSON.parse(savedProfAvail);
            const defaults = generateDefaultProfAvailability();
            ALL_PROF_NAMES.forEach(pName => {
                if (!appState.profAvailability[pName]) {
                    appState.profAvailability[pName] = defaults[pName] || [];
                }
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
let isProfAvailDragging = false;
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
    // 현재 명단에 없는 교수님 문서(이름 변경 전 문서 등)는 무시
    const next = {};
    ALL_PROF_NAMES.forEach(pName => { next[pName] = []; });
    snapshot.docs.forEach(doc => {
        if (ALL_PROF_NAMES.includes(doc.id)) next[doc.id] = (doc.data().slots || []).slice();
    });
    appState.profAvailability = next;
    Object.keys(syncedProfSlots).forEach(k => delete syncedProfSlots[k]);
    Object.keys(next).forEach(pName => { syncedProfSlots[pName] = new Set(next[pName]); });
}

// 다른 사람의 변경이 도착하면 화면 갱신 (드래그 입력 중에는 끝난 뒤로 미룸)
function renderAfterRemoteChange() {
    if (remoteRenderScheduled) return;
    remoteRenderScheduled = true;
    setTimeout(() => {
        remoteRenderScheduled = false;
        if (isProfAvailDragging) {
            renderAfterRemoteChange();
            return;
        }
        renderAll();
        if (document.getElementById('modalProfAvail').classList.contains('active')) {
            renderInteractiveProfAvailTable();
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

function getAvailableProfessorsAt(dateTimeStr) {
    return ALL_PROF_NAMES.filter(name => isProfAvailable(name, dateTimeStr));
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

function countStudentGoldenSlotsOnDate(presenter, dateStr) {
    return TIME_SLOTS.filter(time => analyzeSlotForStudent(presenter, `${dateStr} ${time}`).isAllMatch).length;
}

// 심사위원 전원이 가능한 30분 슬롯 전체 (11~12월 평일)
function findAllMatchSlots(presenter) {
    const slots = [];
    getAllScheduleDates().forEach(dateStr => {
        TIME_SLOTS.forEach(time => {
            if (analyzeSlotForStudent(presenter, `${dateStr} ${time}`).isAllMatch) slots.push({ dateStr, time });
        });
    });
    return slots;
}

function confirmSchedule(presenter, dateStr, time, location) {
    presenter.confirmedSchedule = { date: dateStr, time, duration: 30, location };
    saveState();
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

function renderProfCalendarHero() {
    const month = appState.profCalendarMonth;
    const filter = appState.profFilterTarget;

    document.getElementById('btnProfNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('btnProfDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    renderWeekdayCalendar(document.getElementById('profCalendarGrid'), month, (cell, { dateStr, dayNum }) => {
        let availableProfs = getProfessorsAvailableOnDate(dateStr);
        if (filter !== 'all') {
            availableProfs = availableProfs.filter(name => name === filter);
        }

        const confirmedHere = appState.presenters.filter(
            p => p.confirmedSchedule && p.confirmedSchedule.date === dateStr
        );

        cell.className = `cal-day-cell prof-cal-cell ${confirmedHere.length > 0 ? 'has-confirmed' : ''}`;

        const badgeHtml = confirmedHere.length > 0
            ? `<span class="cal-day-badge badge-confirmed">⭐ 확정</span>`
            : '';

        let contentHtml = confirmedHere.map(item => `
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

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${dayNum}</span>
                ${badgeHtml}
            </div>
            <div class="cal-day-content">${contentHtml}</div>
        `;

        cell.addEventListener('click', () => {
            openDateProfDetailModal(dateStr);
        });
    });
}

// 교수님별 필터 칩 (PROFESSORS 목록으로 생성)
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

// 교수님 가능 일정 입력 모달의 교수님 선택 목록
function renderProfTargetOptions() {
    const options = names => names.map(n => `<option value="${n}">${n}</option>`).join('');
    document.getElementById('selectProfTarget').innerHTML =
        `<optgroup label="내부 심사위원 (${PROFESSORS.internal.length}인)">${options(PROFESSORS.internal)}</optgroup>`
        + `<optgroup label="외부 심사위원 (${PROFESSORS.external.length}인)">${options(PROFESSORS.external)}</optgroup>`;
}

/**
 * MODAL: SINGLE DATE 30-MIN PROFESSOR BREAKDOWN & DIRECT PRESENTER CONFIRM / CANCEL
 * - Shows available professors per 30-min slot
 * - Shows eligible candidate presenters (발표 가능인원) with 1-click name filling
 * - Direct name input (이름 입력 후 확정) with datalist autocompletion
 * - Direct 1-click cancellation for confirmed slots
 */
function openDateProfDetailModal(dateStr) {
    const modal = document.getElementById('modalDateProfDetail');
    const { y, m, d, dayName } = formatDateWithDay(dateStr);

    document.getElementById('dateProfDetailTitle').textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일) 교수님별 심사 가능 현황 및 발표자 확정`;

    const container = document.getElementById('dateProfDetailContent');

    // 발표자 이름 자동완성 목록
    let datalistHtml = `
        <datalist id="studentNamesDatalist">
            ${appState.presenters.map(s => `
                <option value="${s.name}">${s.name} (${s.category} · ${s.reviewers.length}인 심사)</option>
            `).join('')}
        </datalist>
    `;

    let tableHtml = datalistHtml + `
        <div style="margin-bottom: 12px; font-size: 0.85rem; color: #475569; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div>
                💡 <strong>안내:</strong> 참석 가능 교수님을 확인하신 후, <strong>[발표 가능 후보]</strong>를 클릭하거나 우측 입력란에 <strong>발표자 이름을 직접 입력</strong>하고 <strong>[확정]</strong> 버튼을 누르시면 즉시 확정됩니다.
            </div>
            <span style="font-size:0.78rem; color:#64748b;">(확정 후에도 [확정 취소] 버튼으로 언제든 취소 가능)</span>
        </div>
        <div class="mobile-scroll-hint" style="display:none;">👉 좌우로 스크롤하여 전체 시간표를 확인할 수 있습니다.</div>
        <div class="mobile-table-scroll-wrap" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
        <table class="daily-table" style="min-width: 660px;">
            <thead>
                <tr>
                    <th style="width: 100px;" class="center">30분 슬롯</th>
                    <th style="width: 220px;">참석 가능 교수님</th>
                    <th style="width: 230px;">발표 가능인원 (심사 전원 가능 후보)</th>
                    <th style="width: 290px;" class="center">발표자 이름 입력 및 확정 / 취소</th>
                </tr>
            </thead>
            <tbody>
    `;

    TIME_SLOTS.forEach(time => {
        const endTime = getEndTime30Min(time);
        const dt = `${dateStr} ${time}`;
        const activeProfs = getAvailableProfessorsAt(dt);

        const confirmedHere = appState.presenters.find(
            p => p.confirmedSchedule && p.confirmedSchedule.date === dateStr && p.confirmedSchedule.time === time
        );

        let rowClass = 'daily-time-row';
        if (confirmedHere) rowClass += ' is-confirmed-row';

        let profTagsHtml = '';
        if (activeProfs.length > 0) {
            profTagsHtml = activeProfs.map(name => {
                const isExt = getProfType(name) === 'external';
                return `<span class="${isExt ? 'badge-tag-external-xs' : 'badge-tag-internal-xs'}" style="margin-right:4px; margin-bottom:3px; display:inline-block;">${getProfShortName(name)}</span>`;
            }).join('');
        } else {
            profTagsHtml = `<span style="color:#94a3b8; font-size:0.8rem;">가능한 교수님 없음</span>`;
        }

        // Calculate eligible candidates (all committee members available)
        const fullyMatched = appState.presenters.filter(s => analyzeSlotForStudent(s, dt).isAllMatch);
        let candidatesHtml = '';
        if (fullyMatched.length > 0) {
            candidatesHtml = fullyMatched.map(s => {
                const isConf = !!s.confirmedSchedule;
                const confTag = isConf ? ' [확정됨]' : '';
                return `
                    <button type="button" class="btn-candidate-chip ${isConf ? 'is-conf' : ''}" 
                            data-name="${s.name}" 
                            data-date="${dateStr}" 
                            data-time="${time}" 
                            title="클릭 시 '${s.name}' 이름이 입력란에 자동 채워집니다 (${s.category})">
                        ★ ${s.name} <span style="font-size:0.7rem; opacity:0.8;">(${s.category.replace('발표','')})${confTag}</span>
                    </button>
                `;
            }).join('');
        } else {
            candidatesHtml = `<span style="color:#94a3b8; font-size:0.75rem;">(전원 가능 발표자 없음)</span>`;
        }

        let actionControlHtml = '';

        if (confirmedHere) {
            // Already confirmed: Provide prominent Cancel button & badge
            actionControlHtml = `
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;">
                    <span class="status-badge confirmed" style="font-size:0.825rem;">
                        ⭐ <strong>${confirmedHere.name}</strong> (${confirmedHere.category})
                    </span>
                    <button class="btn btn-sm btn-danger btn-modal-cancel-slot" 
                            data-id="${confirmedHere.id}" 
                            data-date="${dateStr}" 
                            title="클릭하여 확정을 취소합니다">
                        확정 취소
                    </button>
                </div>
            `;
        } else {
            // Unconfirmed: Text input with datalist + [확정] button
            actionControlHtml = `
                <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
                    <input type="text" 
                           list="studentNamesDatalist" 
                           class="form-control input-slot-student-name" 
                           data-date="${dateStr}" 
                           data-time="${time}" 
                           placeholder="발표자 이름 입력 (예: 김민제)" 
                           style="font-size:0.82rem; padding:5px 8px; width:160px; border-radius:6px; border:1px solid #cbd5e1;">
                    <button class="btn btn-sm btn-success btn-modal-confirm-slot" 
                            data-date="${dateStr}" 
                            data-time="${time}">
                        확정
                    </button>
                </div>
            `;
        }

        tableHtml += `
            <tr class="${rowClass}">
                <td class="center" style="font-weight:700; font-size:0.8rem;">${time} ~ ${endTime}</td>
                <td>${profTagsHtml}</td>
                <td>${candidatesHtml}</td>
                <td class="center">${actionControlHtml}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;

    // Helper: Execute slot confirmation
    const executeConfirm = (date, time, row) => {
        const input = row.querySelector('.input-slot-student-name');
        const enteredName = input ? input.value.trim() : '';

        if (!enteredName) {
            alert("확정할 발표자의 이름을 입력해주세요. (예: 김민제, 강민지 등)");
            if (input) input.focus();
            return;
        }

        // Match student (exact or partial)
        let student = appState.presenters.find(p => p.name === enteredName);
        if (!student) {
            student = appState.presenters.find(p => enteredName.includes(p.name) || p.name.includes(enteredName));
        }

        if (!student) {
            const knownList = appState.presenters.map(p => p.name).join(', ');
            if (!confirm(`'${enteredName}' 발표자는 기존 등록 명단에 없습니다.\n(등록 명단: ${knownList})\n\n신규 발표자로 등록하고 이 시간(${date} ${time})으로 확정하시겠습니까?`)) {
                if (input) input.focus();
                return;
            }
            // 신규 발표자는 심사위원 미지정 상태로 등록 (이후 [심사위원 선택]에서 지정)
            student = {
                id: 'p_custom_' + Date.now(),
                name: enteredName,
                category: '석사졸업발표',
                duration: 30,
                thesisTitle: '학위청구논문 발표',
                location: '세미나실 1호',
                reviewers: [],
                confirmedSchedule: null
            };
            appState.presenters.push(student);
        }

        // Check if already confirmed elsewhere
        if (student.confirmedSchedule) {
            const cur = student.confirmedSchedule;
            if (!confirm(`${student.name}님은 이미 ${cur.date} ${cur.time}에 확정되어 있습니다.\n이 시간(${date} ${time})으로 변경하여 확정하시겠습니까?`)) {
                return;
            }
        }

        // Check committee member availability warning
        const analysis = analyzeSlotForStudent(student, `${date} ${time}`);
        if (!analysis.isAllMatch && analysis.unavailableNames.length > 0) {
            if (!confirm(`주의: ${student.name}님의 심사위원 중 [${analysis.unavailableNames.join(', ')}] 교수님이 이 시간대에 참석 불가로 표시되어 있습니다.\n그래도 확정하시겠습니까?`)) {
                return;
            }
        }

        confirmSchedule(student, date, time, student.location || "세미나실 1호");
        renderAll();
        openDateProfDetailModal(date);
        showToast(`${student.name}님의 발표가 ${date} ${time}으로 최종 확정되었습니다! 🎉`);
    };

    // Clicking candidate chip auto-fills name input and focuses
    container.querySelectorAll('.btn-candidate-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const name = chip.getAttribute('data-name');
            const row = chip.closest('tr');
            const input = row.querySelector('.input-slot-student-name');
            if (input) {
                input.value = name;
                input.focus();
                input.select();
            }
        });
    });

    // Enter key inside input triggers confirmation
    container.querySelectorAll('.input-slot-student-name').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const row = input.closest('tr');
                const btn = row.querySelector('.btn-modal-confirm-slot');
                if (btn) btn.click();
            }
        });
    });

    // Attach Confirm button handler in modal
    container.querySelectorAll('.btn-modal-confirm-slot').forEach(btn => {
        btn.addEventListener('click', () => {
            const date = btn.getAttribute('data-date');
            const time = btn.getAttribute('data-time');
            const row = btn.closest('tr');
            executeConfirm(date, time, row);
        });
    });

    // Attach Cancel button handler in modal
    container.querySelectorAll('.btn-modal-cancel-slot').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.getAttribute('data-id');
            const date = btn.getAttribute('data-date');
            const student = appState.presenters.find(p => p.id === studentId);
            if (student && cancelConfirmationWithPrompt(student)) {
                openDateProfDetailModal(date);
            }
        });
    });

    modal.classList.add('active');
}

// ==========================================================================
// 4. SECTOR 3: PRESENTER ROSTER & MATCHING SUMMARY
// ==========================================================================

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
            const endTime = getEndTime30Min(p.confirmedSchedule.time);
            statusBadgeHtml = `
                <div style="display:flex; align-items:center; gap:6px;">
                    <span class="status-badge confirmed">⭐ ${p.confirmedSchedule.date} (${p.confirmedSchedule.time}~${endTime}) 확정</span>
                    <button class="btn btn-sm btn-danger btn-roster-cancel" data-id="${p.id}" title="확정을 취소합니다" style="padding:2px 8px; font-size:0.72rem;">
                        취소
                    </button>
                </div>
            `;
        } else if (reviewers.length === 0) {
            statusBadgeHtml = `<span class="status-badge need-committee">심사위원 선택 필요</span>`;
        } else if (totalGoldenSlots > 0) {
            statusBadgeHtml = `<span class="status-badge match-found">✨ 심사위원 전원 가능 ${totalGoldenSlots}개 슬롯 발견</span>`;
        } else {
            statusBadgeHtml = `<span class="status-badge">교수님 일정 취합중</span>`;
        }

        let reviewerListStr = reviewers.length > 0
            ? reviewers.map(r => `${r.role}:${getProfShortName(r.name)}`).join(', ')
            : '미등록';

        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-name-wrap">
                    <h4 class="roster-student-name">${p.name}</h4>
                    <span class="roster-duration-tag">30분 발표</span>
                </div>
                ${statusBadgeHtml}
            </div>

            <div class="roster-reviewer-preview">
                <strong>심사위원단 (${reviewers.length}인):</strong> ${reviewerListStr}
            </div>

            <div class="roster-card-actions">
                <button class="btn btn-sm btn-outline btn-manage-committee" data-id="${p.id}">
                    심사위원 선택
                </button>
                <button class="btn btn-sm btn-primary btn-jump-coordination" data-id="${p.id}">
                    30분 슬롯 조율/확정 →
                </button>
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
        const end = getEndTime30Min(presenter.confirmedSchedule.time);
        statusBadge.className = 'status-badge confirmed';
        statusBadge.innerHTML = `심사 확정 (${presenter.confirmedSchedule.date} ${presenter.confirmedSchedule.time}~${end}) <button class="btn btn-sm btn-danger btn-banner-cancel" style="padding:1px 6px; font-size:0.7rem; margin-left:6px;">취소</button>`;
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
        const goldenCount = countStudentGoldenSlotsOnDate(presenter, dateStr);
        const isConfirmed = presenter.confirmedSchedule && presenter.confirmedSchedule.date === dateStr;

        cell.className = `cal-day-cell ${isConfirmed ? 'confirmed-day' : ''}`;

        let badgeHtml = '';
        let chipsHtml = '';
        if (isConfirmed) {
            const end = getEndTime30Min(presenter.confirmedSchedule.time);
            badgeHtml = `<span class="cal-day-badge badge-confirmed">⭐ 확정</span>`;
            chipsHtml = `<div class="cal-slot-chip confirmed-chip" style="font-size:0.7rem; padding:2px 4px;">⭐ ${presenter.confirmedSchedule.time}~${end} 확정</div>`;
        } else if (goldenCount > 0) {
            // 가장 이른 전원 가능 시간 하나만 표시
            const firstTime = TIME_SLOTS.find(time => analyzeSlotForStudent(presenter, `${dateStr} ${time}`).isAllMatch);
            badgeHtml = `<span class="cal-day-badge badge-golden">전원가능</span>`;
            chipsHtml = `<div class="cal-slot-chip golden" style="font-size:0.7rem; padding:2px 4px;">✓ ${firstTime}~${getEndTime30Min(firstTime)} 가능</div>`;
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

    let tableHtml = `<table class="weekly-table"><thead><tr><th style="width: 100px;">시간 (30분)</th>`;

    displayDays.forEach(d => {
        tableHtml += `
            <th>
                ${d.dayName}요일
                <span class="date-sub">${d.month}월 ${d.dayNum}일</span>
            </th>
        `;
    });

    tableHtml += `</tr></thead><tbody>`;

    TIME_SLOTS.forEach(time => {
        const endTime = getEndTime30Min(time);
        tableHtml += `<tr><td class="time-col" style="font-size:0.75rem;">${time}~${endTime}</td>`;

        displayDays.forEach(d => {
            const dateTimeStr = `${d.dateStr} ${time}`;
            const analysis = analyzeSlotForStudent(presenter, dateTimeStr);
            const isConfirmed = presenter.confirmedSchedule &&
                                presenter.confirmedSchedule.date === d.dateStr &&
                                presenter.confirmedSchedule.time === time;

            let cellClass = 'week-slot-cell';
            let cellContent = '';

            if (isConfirmed) {
                cellClass += ' slot-confirmed';
                cellContent = `<span class="slot-inner-badge" style="cursor:pointer;" title="클릭하여 확정 취소">⭐ 확정됨 (취소)</span>`;
            } else if (analysis.isAllMatch) {
                cellClass += ' slot-all';
                cellContent = `<span class="slot-inner-badge">✓ 전원 가능</span>`;
            } else {
                cellClass += ' slot-none';
                cellContent = `<span style="font-size:0.7rem; color:#cbd5e1;">-</span>`;
            }

            const tooltip = `[${dateTimeStr} ~ ${endTime}]\n가능 교수님: ${analysis.availableNames.join(', ') || '없음'}\n불가: ${analysis.unavailableNames.join(', ') || '없음'}`;

            tableHtml += `
                <td class="${cellClass}" title="${tooltip}" data-datetime="${dateTimeStr}" data-confirmed="${isConfirmed ? 'true' : 'false'}">
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
            const dt = cell.getAttribute('data-datetime');
            const isConf = cell.getAttribute('data-confirmed') === 'true';
            if (isConf) {
                cancelConfirmationWithPrompt(presenter);
            } else if (dt) {
                const [date] = dt.split(' ');
                appState.currentDayDate = date;
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

    let tableHtml = `<table class="daily-table"><thead><tr><th style="width: 110px;" class="center">30분 슬롯</th>`;

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
                    <th style="width: 140px;" class="center">30분 심사 확정/취소</th>
                </tr>
            </thead>
            <tbody>
    `;

    TIME_SLOTS.forEach(time => {
        const endTime = getEndTime30Min(time);
        const dateTimeStr = `${dateStr} ${time}`;
        const analysis = analyzeSlotForStudent(presenter, dateTimeStr);
        const isConfirmed = presenter.confirmedSchedule &&
                            presenter.confirmedSchedule.date === dateStr &&
                            presenter.confirmedSchedule.time === time;

        const rowClass = analysis.isAllMatch ? 'daily-time-row golden-row' : 'daily-time-row';

        tableHtml += `
            <tr class="${rowClass}">
                <td class="center" style="font-weight:700; font-size:0.8rem;">${time} ~ ${endTime}</td>
        `;

        reviewers.forEach(r => {
            const avail = isProfAvailable(r.name, dateTimeStr);
            tableHtml += `
                <td>
                    <button class="daily-cell-btn ${avail ? 'status-yes' : 'status-no'}" 
                            data-prof-name="${r.name}" 
                            data-datetime="${dateTimeStr}">
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

        // Action Column: When confirmed, provide DIRECT CANCEL button!
        let actionBtn = '';
        if (isConfirmed) {
            actionBtn = `
                <button class="btn btn-sm btn-danger btn-direct-cancel-final" data-id="${presenter.id}" title="클릭하여 확정을 취소합니다">
                    ⭐ 확정 취소
                </button>
            `;
        } else if (analysis.isAllMatch) {
            actionBtn = `
                <button class="btn btn-sm btn-success btn-select-final"
                        data-date="${dateStr}" 
                        data-time="${time}">
                    이 시간 확정
                </button>
            `;
        } else {
            actionBtn = `
                <span style="font-size:0.75rem; color:#94a3b8; font-weight:500;">불가 (${analysis.unavailableNames.length}인 불참)</span>
            `;
        }

        tableHtml += `
                <td class="center">${summaryPill}</td>
                <td class="center">${actionBtn}</td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;
    matrixContainer.innerHTML = tableHtml;

    // Toggle professor availability button
    matrixContainer.querySelectorAll('.daily-cell-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const pName = btn.getAttribute('data-prof-name');
            const dt = btn.getAttribute('data-datetime');
            toggleProfAvailability(pName, dt);
            renderDailyDetail();
            updateDetailBanner();
            showToast(`${pName}의 일정이 수정되었습니다.`);
        });
    });

    // Confirm button
    matrixContainer.querySelectorAll('.btn-select-final').forEach(btn => {
        btn.addEventListener('click', () => {
            const d = btn.getAttribute('data-date');
            const t = btn.getAttribute('data-time');
            openConfirmModal(presenter, d, t);
        });
    });

    // Direct Cancel button in Daily Table
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

    if (matchedSlots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h4>아직 심사위원 전원 가능한 30분 일정이 없습니다.</h4>
                <p>홈 화면 최상단의 <strong>[교수님 가능 일정 입력]</strong>을 통해 심사위원 교수님들의 가능한 시간대를 추가해주세요.</p>
                <button class="btn btn-primary" style="margin-top:14px;" onclick="openProfAvailModal()">
                    교수님 가능 일정 입력하기
                </button>
            </div>
        `;
        return;
    }

    matchedSlots.forEach((slot, index) => {
        const { y, m, d, dayName } = formatDateWithDay(slot.dateStr);
        const endTime = getEndTime30Min(slot.time);
        const isConfirmed = presenter.confirmedSchedule &&
                            presenter.confirmedSchedule.date === slot.dateStr &&
                            presenter.confirmedSchedule.time === slot.time;

        const card = document.createElement('div');
        card.className = `recommendation-card is-golden ${isConfirmed ? 'is-confirmed' : ''}`;
        card.innerHTML = `
            <div class="rec-rank-badge">#${index + 1}</div>
            <div class="rec-info">
                <div class="rec-datetime">
                    ${y}년 ${m}월 ${d}일 (${dayName}) ${slot.time} ~ ${endTime} (30분)
                    ${isConfirmed ? '<span class="status-badge confirmed" style="margin-left:8px;">현재 확정된 일정</span>' : ''}
                </div>
                <div class="rec-meta">
                    <span>✨ <strong>심사위원 전원(${committeeSize}인) 참석 가능</strong></span>
                    <span>배정 시간: 30분</span>
                    <span>장소: ${presenter.location || '세미나실'}</span>
                </div>
            </div>
            <div class="rec-actions">
                <button class="btn btn-outline btn-sm btn-rec-jump" data-date="${slot.dateStr}">일자별 상세 보기</button>
                <button class="btn ${isConfirmed ? 'btn-danger' : 'btn-success'} btn-sm btn-rec-confirm" data-date="${slot.dateStr}" data-time="${slot.time}">
                    ${isConfirmed ? '확정 취소하기' : '이 시간으로 확정'}
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
            const isConfirmed = btn.textContent.includes('확정 취소하기');
            if (isConfirmed) {
                cancelConfirmationWithPrompt(presenter);
            } else {
                const d = btn.getAttribute('data-date');
                const t = btn.getAttribute('data-time');
                openConfirmModal(presenter, d, t);
            }
        });
    });
}

// ==========================================================================
// 6. PROFESSOR AVAILABILITY INPUT MODAL
// ==========================================================================

function openProfAvailModal(targetProf = null) {
    const modal = document.getElementById('modalProfAvail');
    const select = document.getElementById('selectProfTarget');

    if (targetProf) {
        select.value = targetProf;
        appState.modalProfTargetName = targetProf;
    } else {
        appState.modalProfTargetName = select.value;
    }

    renderInteractiveProfAvailTable();
    modal.classList.add('active');
}

function renderInteractiveProfAvailTable() {
    const profName = appState.modalProfTargetName;
    const month = appState.modalProfInputMonth;
    const tableContainer = document.getElementById('profAvailTable');

    document.getElementById('modalProfChipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('modalProfChipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    const weekdays = getWeekdays(month);

    let tableHtml = `<table class="interactive-avail-table"><thead><tr><th style="min-width: 85px;">30분 슬롯</th>`;

    weekdays.forEach(w => {
        tableHtml += `<th style="min-width: 48px;">${w.dayName}<br>${w.dayNum}일</th>`;
    });

    tableHtml += `</tr></thead><tbody>`;

    TIME_SLOTS.forEach(time => {
        const endTime = getEndTime30Min(time);
        tableHtml += `<tr><td style="font-weight:700; background:#f8fafc; font-size:0.75rem;">${time}~${endTime}</td>`;

        weekdays.forEach(w => {
            const dt = `${w.dateStr} ${time}`;
            const isAvail = isProfAvailable(profName, dt);
            tableHtml += `
                <td class="avail-check-cell ${isAvail ? 'selected' : ''}" 
                    data-datetime="${dt}" 
                    title="${profName} - ${dt} ~ ${endTime}">
                </td>
            `;
        });

        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;
    tableContainer.innerHTML = tableHtml;

    // 클릭·탭·드래그 모두 mousedown/mouseenter에서 처리
    // (click에서도 바꾸면 한 번 클릭에 두 번 바뀌어 원래대로 돌아감)
    let modeToSet = true;
    const applyToCell = cell => {
        cell.classList.toggle('selected', modeToSet);
        toggleProfAvailability(profName, cell.getAttribute('data-datetime'));
    };

    tableContainer.querySelectorAll('.avail-check-cell').forEach(cell => {
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isProfAvailDragging = true;
            modeToSet = !cell.classList.contains('selected');
            applyToCell(cell);
        });

        cell.addEventListener('mouseenter', () => {
            if (isProfAvailDragging && cell.classList.contains('selected') !== modeToSet) {
                applyToCell(cell);
            }
        });
    });
}

// 선택한 교수님의 해당 월 평일 슬롯 중 times에 해당하는 시간을 모두 가능으로 설정
function markProfMonthAvailable(times, message) {
    const profName = appState.modalProfTargetName;
    if (!appState.profAvailability[profName]) appState.profAvailability[profName] = [];
    const slots = appState.profAvailability[profName];

    getWeekdays(appState.modalProfInputMonth).forEach(w => {
        times.forEach(time => {
            const dt = `${w.dateStr} ${time}`;
            if (!slots.includes(dt)) slots.push(dt);
        });
    });
    saveState();
    renderInteractiveProfAvailTable();
    renderAll();
    showToast(`${profName}: ${message}`);
}

// ==========================================================================
// 7. COMMITTEE MANAGEMENT & OTHER MODALS
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

    if (isPhdGrad) {
        subtitle.textContent = "규정: 박사졸업발표는 내부 심사위원 3인 + 외부 심사위원 2인 (총 5인) 구성입니다.";
        hint.innerHTML = `<span class="badge-tag-internal">내부 3인</span> (${internalList}) + <span class="badge-tag-external">외부 2인</span> (${externalList} 중 2인) 총 5인을 지정하세요.`;

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
        hint.innerHTML = `<span class="badge-tag-internal">내부</span> (${internalList}) · <span class="badge-tag-external">외부</span> (${externalList}) 구분 없이 자유롭게 지정하세요.`;

        const rows = existingReviewers.length > 0
            ? existingReviewers.map(r => ({ role: r.role, name: r.name }))
            : ["심사위원장", "지도교수", "심사위원"].map(role => ({ role, name: '' }));

        rows.forEach(r => addProfessorSelectRow(r.role, 'any', r.name));
    }
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
            <select class="form-control r-role" style="font-size:0.8rem;">
                <option value="심사위원장" ${role === '심사위원장' ? 'selected' : ''}>심사위원장</option>
                <option value="지도교수" ${role === '지도교수' ? 'selected' : ''}>지도교수</option>
                <option value="심사위원" ${role === '심사위원' ? 'selected' : ''}>심사위원</option>
            </select>
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

document.getElementById('btnAddReviewerRow').addEventListener('click', () => {
    const cat = document.getElementById('inputCategory').value;
    const type = cat === '박사졸업발표' ? 'external' : 'any';
    addProfessorSelectRow('심사위원', type, '');
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
        const nameSelect = row.querySelector('.r-name');
        const rName = nameSelect.value;
        if (rName) {
            reviewers.push({
                id: `r_${editId}_${idx + 1}`,
                name: rName,
                role: rRole,
                type: getProfType(rName)
            });
        }
    });

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

function openConfirmModal(presenter, dateStr, timeStr) {
    const modal = document.getElementById('modalConfirmDefense');
    const { y, m, d, dayName } = formatDateWithDay(dateStr);
    const endTime = getEndTime30Min(timeStr);

    document.getElementById('confirmModalPresenter').textContent = `${presenter.name} (${presenter.category})`;
    document.getElementById('confirmModalDateTime').textContent = `${y}년 ${m}월 ${d}일 (${dayName}) ${timeStr} ~ ${endTime}`;
    document.getElementById('confirmModalLocation').value = presenter.location || "세미나실 1호";

    const btnCancel = document.getElementById('btnCancelConfirmation');
    const leadText = document.getElementById('confirmLeadText');

    if (presenter.confirmedSchedule) {
        btnCancel.style.display = 'inline-flex';
        leadText.textContent = `현재 ${presenter.name}님의 심사 일정이 확정되어 있습니다. 시간을 변경하거나 확정을 취소할 수 있습니다.`;
    } else {
        btnCancel.style.display = 'none';
        leadText.textContent = `선택한 일시로 학위논문 발표(30분) 일정을 확정하시겠습니까?`;
    }

    const btnSave = document.getElementById('btnSaveConfirmation');
    btnSave.onclick = () => {
        confirmSchedule(presenter, dateStr, timeStr, document.getElementById('confirmModalLocation').value.trim() || '세미나실');
        closeModal('modalConfirmDefense');
        renderAll();
        showToast(`${presenter.name}님의 30분 발표 일정이 최종 확정되었습니다! 🎉`);
    };

    btnCancel.onclick = () => {
        if (cancelConfirmationWithPrompt(presenter)) closeModal('modalConfirmDefense');
    };

    modal.classList.add('active');
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
        const endTime = getEndTime30Min(confirmed.time);
        scheduleNotice = `
[발표 확정 일시 및 장소]
■ 일시: ${confirmed.date} (${confirmed.time} ~ ${endTime}) [배정 시간: 30분]
■ 장소: ${confirmed.location}
`;
    } else {
        const topSlots = findAllMatchSlots(presenter).slice(0, 3)
            .map((slot, idx) => `  ${idx + 1}. ${slot.dateStr} ${slot.time} ~ ${getEndTime30Min(slot.time)}`)
            .join('\n');

        scheduleNotice = `
[심사위원 전원 가능 30분 추천 일시 (조율중)]
${topSlots || '  (현재 전원 가능한 시간을 취합 중입니다)'}
※ 최종 시간 확정 후 재안내 예정입니다.
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
    renderProfFilterChips();
    renderProfTargetOptions();
    initDataSource();

    // Top Navigation
    document.getElementById('brandHomeBtn').addEventListener('click', navigateToHome);
    document.getElementById('btnNavHome').addEventListener('click', navigateToHome);
    document.getElementById('btnBackToHome').addEventListener('click', navigateToHome);

    document.getElementById('btnOpenProfInputModal').addEventListener('click', () => {
        openProfAvailModal();
    });
    document.getElementById('btnInputProfAvailHero').addEventListener('click', () => {
        openProfAvailModal();
    });

    document.getElementById('currentPresenterSelect').addEventListener('change', (e) => {
        navigateToPresenter(e.target.value);
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
    document.getElementById('btnQuickInput').addEventListener('click', () => {
        openProfAvailModal();
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

    // Professor Availability Modal controls
    document.getElementById('selectProfTarget').addEventListener('change', (e) => {
        appState.modalProfTargetName = e.target.value;
        renderInteractiveProfAvailTable();
    });
    document.getElementById('modalProfChipNov').addEventListener('click', () => {
        appState.modalProfInputMonth = 11;
        renderInteractiveProfAvailTable();
    });
    document.getElementById('modalProfChipDec').addEventListener('click', () => {
        appState.modalProfInputMonth = 12;
        renderInteractiveProfAvailTable();
    });

    document.getElementById('btnProfSelectAll').addEventListener('click', () => {
        markProfMonthAvailable(TIME_SLOTS, '해당 월 평일 전체 가능으로 설정되었습니다.');
    });
    document.getElementById('btnProfSelectAfternoon').addEventListener('click', () => {
        markProfMonthAvailable(TIME_SLOTS.filter(t => t >= '13:00'), '해당 월 평일 오후(13~18시) 가능으로 설정되었습니다.');
    });

    document.getElementById('btnProfClear').addEventListener('click', () => {
        const profName = appState.modalProfTargetName;
        const monthPrefix = `${SCHEDULE_YEAR}-${String(appState.modalProfInputMonth).padStart(2, '0')}`;

        if (appState.profAvailability[profName]) {
            appState.profAvailability[profName] = appState.profAvailability[profName].filter(
                dt => !dt.startsWith(monthPrefix)
            );
            saveState();
        }
        renderInteractiveProfAvailTable();
        renderAll();
        showToast(`${profName}: 해당 월의 선택이 초기화되었습니다.`);
    });

    // 교수님 일정표 드래그 종료
    window.addEventListener('mouseup', () => {
        if (!isProfAvailDragging) return;
        isProfAvailDragging = false;
        renderAll();
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
