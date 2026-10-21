/**
 * 대학원 학위논문 발표 일정 조율 플랫폼 (script.js)
 * - 교수님 심사 가능 캘린더 (최상단 메인 섹터)
 * - 교수님 가능 일정(30분 단위) 종합 취합 및 필터링
 * - 외부 심사위원: '외부 1', '외부 2' 호칭 적용
 * - 확정된 일정 원클릭 취소 기능 전면 지원
 * - 교수님별 심사가능현황에서 발표자 선택/입력 후 확정 & 취소 지원
 */

// ==========================================================================
// 1. Storage Keys, Professor Pool & Default Schedules
// ==========================================================================

const STORAGE_KEY_PRESENTERS = 'thesis_sched_roster_v6';
const STORAGE_KEY_PROF_AVAIL = 'thesis_sched_prof_avail_v6';

const PROFESSORS = {
    internal: [
        { name: "김수철 교수님", type: "internal", classDot: "dot-prof1" },
        { name: "이상옥 교수님", type: "internal", classDot: "dot-prof2" },
        { name: "권희홍 교수님", type: "internal", classDot: "dot-prof3" },
        { name: "한민수 교수님", type: "internal", classDot: "dot-prof4" },
        { name: "정용재 교수님", type: "internal", classDot: "dot-prof5" }
    ],
    external: [
        { name: "외부 1", type: "external", classDot: "dot-prof6" },
        { name: "외부 2", type: "external", classDot: "dot-prof7" }
    ]
};

const ALL_PROF_NAMES = [
    ...PROFESSORS.internal.map(p => p.name),
    ...PROFESSORS.external.map(p => p.name)
];

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

// 캘린더용 교수님 성(Initial) 추출 (김, 이, 권, 한, 정, 외1, 외2)
function getProfInitial(pName) {
    if (pName.includes('외부 1') || pName === '외1') return '외1';
    if (pName.includes('외부 2') || pName === '외2') return '외2';
    const clean = pName.replace(' 교수님', '').trim();
    return clean.charAt(0);
}

// 10 Presenters
const DEFAULT_PRESENTERS = [
    // 1. 박사졸업발표 (김민제: 내부 3 + 외부 2 = 총 5인)
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
            { id: "r_p1_4", name: "외부 1", role: "심사위원", type: "external" },
            { id: "r_p1_5", name: "외부 2", role: "심사위원", type: "external" }
        ],
        confirmedSchedule: {
            date: "2026-11-27",
            time: "14:00",
            duration: 30,
            location: "세미나실 1호"
        }
    },

    // 2. 박사주제발표 (4명: 내부 3인)
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

    // 3. 석사졸업발표 (5명: 내부 3인)
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
        "외부 1": [
            "2026-11-27 13:30", "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00",
            "2026-12-04 14:00", "2026-12-04 14:30"
        ],
        "외부 2": [
            "2026-11-27 14:00", "2026-11-27 14:30", "2026-11-27 15:00", "2026-11-27 15:30",
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
    calendarYear: 2026,
    profCalendarMonth: 11,
    profFilterTarget: 'all',
    currentDayDate: '2026-11-27',
    currentWeekIndex: 0,
    modalProfInputMonth: 11,
    modalProfTargetName: "김수철 교수님"
};

function loadState() {
    try {
        const savedPresenters = localStorage.getItem(STORAGE_KEY_PRESENTERS);
        const savedProfAvail = localStorage.getItem(STORAGE_KEY_PROF_AVAIL);

        if (savedPresenters && savedProfAvail) {
            appState.presenters = JSON.parse(savedPresenters);
            appState.profAvailability = JSON.parse(savedProfAvail);
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
        ratio: total > 0 ? (availableCount / total) : 0,
        availableNames,
        unavailableNames
    };
}

function countStudentGoldenSlotsOnDate(presenter, dateStr) {
    let count = 0;
    TIME_SLOTS.forEach(time => {
        const dt = `${dateStr} ${time}`;
        if (analyzeSlotForStudent(presenter, dt).isAllMatch) {
            count++;
        }
    });
    return count;
}

// Action: Cancel a student's confirmed schedule
function cancelStudentConfirmation(studentId) {
    const student = appState.presenters.find(p => p.id === studentId);
    if (student) {
        student.confirmedSchedule = null;
        saveState();
        renderAll();
        showToast(`${student.name}님의 심사 확정이 취소되었습니다.`);
    }
}

// ==========================================================================
// 3. SECTOR 1: PROFESSORS CALENDAR (HOME OVERVIEW)
// ==========================================================================

function renderProfCalendarHero() {
    const year = 2026;
    const month = appState.profCalendarMonth;
    const filter = appState.profFilterTarget;
    const grid = document.getElementById('profCalendarGrid');
    grid.innerHTML = '';

    document.getElementById('btnProfNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('btnProfDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    const firstDate = new Date(year, month - 1, 1);
    const firstDayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    // 5-Day Weekday Grid (월=0, 화=1, 수=2, 목=3, 금=4). 주말(토, 일) 완전 제외!
    let leadingPadding = 0;
    if (firstDayOfWeek >= 1 && firstDayOfWeek <= 5) {
        leadingPadding = firstDayOfWeek - 1;
    }

    // Previous month padding cells (weekdays only)
    if (leadingPadding > 0) {
        for (let p = leadingPadding - 1; p >= 0; p--) {
            const pDay = prevMonthDays - p;
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${pDay}</span></div>`;
            grid.appendChild(cell);
        }
    }

    let renderedCount = leadingPadding;

    // Current month weekdays
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, d).getDay();

        // 주말(토요일=6, 일요일=0) 삭제!
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        renderedCount++;

        let availableProfs = getProfessorsAvailableOnDate(dateStr);
        if (filter !== 'all') {
            availableProfs = availableProfs.filter(name => name === filter);
        }

        const confirmedHere = appState.presenters.filter(
            p => p.confirmedSchedule && p.confirmedSchedule.date === dateStr
        );

        const cell = document.createElement('div');
        let classes = 'cal-day-cell prof-cal-cell';
        if (confirmedHere.length > 0) classes += ' has-confirmed';
        cell.className = classes;

        // "교수 n인 가능" 문구 완전 제거! 확정된 일정만 배지로 표시
        let badgeHtml = '';
        if (confirmedHere.length > 0) {
            badgeHtml = `<span class="cal-day-badge badge-confirmed">⭐ 확정</span>`;
        }

        let contentHtml = '';

        // 확정된 발표자가 있는 경우 간결하게 표시
        if (confirmedHere.length > 0) {
            confirmedHere.forEach(item => {
                contentHtml += `
                    <div class="cal-slot-chip confirmed-chip" title="${item.name} (${item.category}) ${item.confirmedSchedule.time} 심사 확정" style="padding:2px 4px; font-size:0.7rem; font-weight:700; margin-bottom:4px;">
                        ⭐ ${item.name} <span style="font-size:0.62rem; opacity:0.85;">(${item.confirmedSchedule.time})</span>
                    </div>
                `;
            });
        }

        // 가능 교수님 성함은 성(Initial)만 표기! (김, 이, 권, 한, 정, 외1, 외2)
        // "교수 n인 가능" 및 "외 n인" 문구 전면 제거
        if (availableProfs.length > 0) {
            contentHtml += `<div class="cal-prof-initials-wrap">`;
            availableProfs.forEach(pName => {
                const isExt = pName.includes('외부');
                const initial = getProfInitial(pName);
                contentHtml += `
                    <span class="prof-initial-badge ${isExt ? 'is-ext' : 'is-int'}" 
                          title="${pName} 참석 가능">
                        ${initial}
                    </span>
                `;
            });
            contentHtml += `</div>`;
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${d}</span>
                ${badgeHtml}
            </div>
            <div class="cal-day-content">${contentHtml}</div>
        `;

        cell.addEventListener('click', () => {
            openDateProfDetailModal(dateStr);
        });

        grid.appendChild(cell);
    }

    // 5열 채우기용 다음 달 평일 패딩
    const trailingPadding = (5 - (renderedCount % 5)) % 5;
    for (let t = 1; t <= trailingPadding; t++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${t}</span></div>`;
        grid.appendChild(cell);
    }
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
    const [y, m, d] = dateStr.split('-');
    const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];

    document.getElementById('dateProfDetailTitle').textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일) 교수님별 심사 가능 현황 및 발표자 확정`;

    const container = document.getElementById('dateProfDetailContent');

    // Datalist of all 10 presenters for browser autocomplete
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
                const isExt = name.includes('외부');
                return `<span class="${isExt ? 'badge-tag-external-xs' : 'badge-tag-internal-xs'}" style="margin-right:4px; margin-bottom:3px; display:inline-block;">${name.replace(' 교수님', '')}</span>`;
            }).join('');
        } else {
            profTagsHtml = `<span style="color:#94a3b8; font-size:0.8rem;">가능한 교수님 없음</span>`;
        }

        // Calculate eligible candidates (all committee members available)
        const fullyMatched = appState.presenters.filter(s => analyzeSlotForStudent(s, dt).isAllMatch);
        let candidatesHtml = '';
        if (fullyMatched.length > 0) {
            candidatesHtml = fullyMatched.map(s => {
                const isConf = s.confirmedSchedule !== null;
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
            // Create new presenter
            student = {
                id: 'p_custom_' + Date.now(),
                name: enteredName,
                category: '석사졸업발표',
                duration: 30,
                thesisTitle: '학위청구논문 발표',
                location: '세미나실 1호',
                reviewers: [
                    { id: 'r_c_1', name: '김수철 교수님', role: '심사위원장', type: 'internal' },
                    { id: 'r_c_2', name: '이상옥 교수님', role: '지도교수', type: 'internal' },
                    { id: 'r_c_3', name: '권희홍 교수님', role: '심사위원', type: 'internal' }
                ],
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
        const dt = `${date} ${time}`;
        const analysis = analyzeSlotForStudent(student, dt);
        if (!analysis.isAllMatch && analysis.unavailableNames.length > 0) {
            if (!confirm(`주의: ${student.name}님의 심사위원 중 [${analysis.unavailableNames.join(', ')}] 교수님이 이 시간대에 참석 불가로 표시되어 있습니다.\n그래도 확정하시겠습니까?`)) {
                return;
            }
        }

        student.confirmedSchedule = {
            date: date,
            time: time,
            duration: 30,
            location: student.location || "세미나실 1호"
        };

        saveState();
        openDateProfDetailModal(date); // Refresh modal view
        renderProfCalendarHero();
        renderPresentersSection();
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
            if (!student) return;

            if (confirm(`${student.name}님의 확정된 심사 일정을 취소하시겠습니까?`)) {
                student.confirmedSchedule = null;
                saveState();
                openDateProfDetailModal(date); // Refresh modal view
                renderProfCalendarHero();
                renderPresentersSection();
                showToast(`${student.name}님의 심사 확정이 취소되었습니다.`);
            }
        });
    });

    modal.classList.add('active');
}

// ==========================================================================
// 4. SECTOR 3: 10 PRESENTER ROSTER & MATCHING SUMMARY
// ==========================================================================

function renderPresentersSection() {
    const presenters = appState.presenters;

    const phdGradList = presenters.filter(p => p.category === '박사졸업발표');
    const phdPropList = presenters.filter(p => p.category === '박사주제발표');
    const msList = presenters.filter(p => p.category === '석사졸업발표');
    const confirmedCount = presenters.filter(p => p.confirmedSchedule !== null).length;

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
        const isConfirmed = p.confirmedSchedule !== null;

        let totalGoldenSlots = 0;
        [11, 12].forEach(m => {
            const daysInMonth = new Date(2026, m, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                totalGoldenSlots += countStudentGoldenSlotsOnDate(p, dateStr);
            }
        });

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
        } else if (totalGoldenSlots > 0) {
            statusBadgeHtml = `<span class="status-badge match-found">✨ 심사위원 전원 가능 ${totalGoldenSlots}개 슬롯 발견</span>`;
        } else {
            statusBadgeHtml = `<span class="status-badge">교수님 일정 취합중</span>`;
        }

        let reviewerListStr = reviewers.length > 0
            ? reviewers.map(r => `${r.role}:${r.name.replace(' 교수님', '')}`).join(', ')
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
            if (student && confirm(`${student.name}님의 확정된 심사 일정을 취소하시겠습니까?`)) {
                cancelStudentConfirmation(id);
            }
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
            if (confirm(`${presenter.name}님의 심사 확정을 취소하시겠습니까?`)) {
                cancelStudentConfirmation(presenter.id);
            }
        };
    } else {
        statusBadge.className = 'status-badge';
        statusBadge.textContent = '일정 조율 진행중';
    }

    const reviewers = presenter.reviewers || [];
    const isPhdGrad = presenter.category === '박사졸업발표';
    document.getElementById('bannerCommitteeCount').textContent = isPhdGrad
        ? `총 ${reviewers.length}인 (내부 3 + 외부 2)`
        : `총 ${reviewers.length}인 (내부 3)`;

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

        const typeBadge = r.type === 'external' ? '<span class="badge-tag-external-xs">외부</span>' : '<span class="badge-tag-internal-xs">내부</span>';

        const chip = document.createElement('div');
        chip.className = 'committee-member-chip';
        chip.innerHTML = `
            <div>
                ${typeBadge}
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
    const year = 2026;
    const month = appState.calendarMonth;

    document.getElementById('periodLabel').textContent = `${year}년 ${month}월`;
    document.getElementById('chipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('chipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    const grid = document.getElementById('calendarGridBody');
    grid.innerHTML = '';

    const firstDate = new Date(year, month - 1, 1);
    const firstDayOfWeek = firstDate.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    // 5-Day Weekday Grid (월~금). 주말(토, 일) 제외!
    let leadingPadding = 0;
    if (firstDayOfWeek >= 1 && firstDayOfWeek <= 5) {
        leadingPadding = firstDayOfWeek - 1;
    }

    if (leadingPadding > 0) {
        for (let p = leadingPadding - 1; p >= 0; p--) {
            const pDay = prevMonthDays - p;
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${pDay}</span></div>`;
            grid.appendChild(cell);
        }
    }

    let renderedCount = leadingPadding;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, d).getDay();

        // 주말(토, 일) 삭제
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        renderedCount++;

        const goldenCount = countStudentGoldenSlotsOnDate(presenter, dateStr);
        const isConfirmed = presenter.confirmedSchedule && presenter.confirmedSchedule.date === dateStr;

        const cell = document.createElement('div');
        let classes = 'cal-day-cell';
        if (isConfirmed) classes += ' confirmed-day';
        cell.className = classes;

        let badgeHtml = '';
        if (isConfirmed) {
            badgeHtml = `<span class="cal-day-badge badge-confirmed">⭐ 확정</span>`;
        } else if (goldenCount > 0) {
            badgeHtml = `<span class="cal-day-badge badge-golden">전원가능</span>`;
        }

        let chipsHtml = '';
        if (isConfirmed) {
            const end = getEndTime30Min(presenter.confirmedSchedule.time);
            chipsHtml += `<div class="cal-slot-chip confirmed-chip" style="font-size:0.7rem; padding:2px 4px;">⭐ ${presenter.confirmedSchedule.time}~${end} 확정</div>`;
        } else if (goldenCount > 0) {
            TIME_SLOTS.forEach(time => {
                if (analyzeSlotForStudent(presenter, `${dateStr} ${time}`).isAllMatch && chipsHtml === '') {
                    const end = getEndTime30Min(time);
                    chipsHtml += `<div class="cal-slot-chip golden" style="font-size:0.7rem; padding:2px 4px;">✓ ${time}~${end} 가능</div>`;
                }
            });
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${d}</span>
                ${badgeHtml}
            </div>
            <div class="cal-day-content">${chipsHtml}</div>
        `;

        cell.addEventListener('click', () => {
            appState.currentDayDate = dateStr;
            switchSubView('day');
        });

        grid.appendChild(cell);
    }

    // 5열 패딩 완료
    const trailingPadding = (5 - (renderedCount % 5)) % 5;
    for (let t = 1; t <= trailingPadding; t++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${t}</span></div>`;
        grid.appendChild(cell);
    }
}

function getAllWeeks() {
    const weeks = [];
    let curDate = new Date(2026, 10, 1);
    const endDate = new Date(2026, 11, 31);

    const day = curDate.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    curDate.setDate(curDate.getDate() + diffToMon);

    while (curDate <= endDate) {
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(curDate);
            weekDays.push({
                dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                dayName: ["일", "월", "화", "수", "목", "금", "토"][d.getDay()],
                dayNum: d.getDate(),
                month: d.getMonth() + 1,
                isWeekend: d.getDay() === 0 || d.getDay() === 6
            });
            curDate.setDate(curDate.getDate() + 1);
        }

        const hasTargetMonth = weekDays.some(w => (w.month === 11 || w.month === 12));
        if (hasTargetMonth) {
            const first = weekDays[0];
            const last = weekDays[6];
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
    const hideWeekend = document.getElementById('chkOnlyWeekdays').checked;

    weekSelect.innerHTML = '';
    weeks.forEach((w, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `제 ${idx + 1}주차: ${w.label}`;
        if (idx === appState.currentWeekIndex) opt.selected = true;
        weekSelect.appendChild(opt);
    });

    const currentWeek = weeks[appState.currentWeekIndex] || weeks[0];
    const displayDays = hideWeekend ? currentWeek.days.filter(d => !d.isWeekend) : currentWeek.days;

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
                cellContent = `<span class="slot-inner-badge">✓ 전원 가능 (${analysis.total}/${analysis.total})</span>`;
            } else if (analysis.ratio >= 0.6) {
                cellClass += ' slot-most';
                cellContent = `<span class="slot-inner-badge">${analysis.availableCount}/${analysis.total}명</span>`;
            } else if (analysis.availableCount > 0) {
                cellClass += ' slot-partial';
                cellContent = `<span class="slot-inner-badge">${analysis.availableCount}/${analysis.total}명</span>`;
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
                if (confirm(`${presenter.name}님의 확정된 심사 일정을 취소하시겠습니까?`)) {
                    cancelStudentConfirmation(presenter.id);
                }
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
    const [y, m, d] = dateStr.split('-');
    const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];

    document.getElementById('currentDayTitle').textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일)`;
    document.getElementById('directDatePicker').value = dateStr;

    const reviewers = presenter.reviewers || [];
    const matrixContainer = document.getElementById('dailyMatrix');

    let tableHtml = `<table class="daily-table"><thead><tr><th style="width: 110px;" class="center">30분 슬롯</th>`;

    reviewers.forEach(r => {
        const typeBadge = r.type === 'external' ? '<span class="badge-tag-external-xs">외부</span>' : '<span class="badge-tag-internal-xs">내부</span>';
        tableHtml += `
            <th>
                <div class="daily-person-header">
                    <span>${typeBadge} ${r.name}</span>
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
            summaryPill = `<span class="daily-summary-pill partial-match">${analysis.availableCount} / ${analysis.total}명 가능</span>`;
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
        } else {
            actionBtn = `
                <button class="btn btn-sm ${analysis.isAllMatch ? 'btn-success' : 'btn-outline'} btn-select-final"
                        data-date="${dateStr}" 
                        data-time="${time}">
                    ${analysis.isAllMatch ? '이 시간 확정' : '선택 확정'}
                </button>
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
            const id = btn.getAttribute('data-id');
            if (confirm(`${presenter.name}님의 확정된 심사 일정을 취소하시겠습니까?`)) {
                cancelStudentConfirmation(id);
            }
        });
    });
}

function renderRecommendations() {
    const presenter = getCurrentPresenter();
    const container = document.getElementById('recommendationsList');
    container.innerHTML = '';

    const matchedSlots = [];

    [11, 12].forEach(m => {
        const daysInMonth = new Date(2026, m, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            TIME_SLOTS.forEach(time => {
                const dt = `${dateStr} ${time}`;
                const analysis = analyzeSlotForStudent(presenter, dt);
                if (analysis.isAllMatch) {
                    matchedSlots.push({ dateStr, time, dateTimeStr: dt, analysis });
                }
            });
        }
    });

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
        const [y, m, d] = slot.dateStr.split('-');
        const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];
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
                    <span>✨ <strong>심사위원 전원(${slot.analysis.total}인) 참석 가능</strong></span>
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
                if (confirm(`${presenter.name}님의 심사 확정을 취소하시겠습니까?`)) {
                    cancelStudentConfirmation(presenter.id);
                }
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

    const weekdays = [];
    const daysInMonth = new Date(2026, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(2026, month - 1, d);
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            weekdays.push({
                dateStr: `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                dayName: ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek],
                dayNum: d
            });
        }
    }

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

    let isMouseDown = false;
    let modeToSet = true;

    tableContainer.querySelectorAll('.avail-check-cell').forEach(cell => {
        // Direct tap on mobile devices
        cell.addEventListener('click', () => {
            const dt = cell.getAttribute('data-datetime');
            const currentSelected = cell.classList.contains('selected');
            if (currentSelected) cell.classList.remove('selected');
            else cell.classList.add('selected');
            toggleProfAvailability(profName, dt);
            renderProfCalendarHero();
            renderPresentersSection();
        });

        // Desktop mouse drag
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isMouseDown = true;
            const dt = cell.getAttribute('data-datetime');
            const currentSelected = cell.classList.contains('selected');
            modeToSet = !currentSelected;

            if (modeToSet) cell.classList.add('selected');
            else cell.classList.remove('selected');
            toggleProfAvailability(profName, dt);
        });

        cell.addEventListener('mouseenter', () => {
            if (isMouseDown) {
                const dt = cell.getAttribute('data-datetime');
                const currentSelected = cell.classList.contains('selected');
                if (currentSelected !== modeToSet) {
                    if (modeToSet) cell.classList.add('selected');
                    else cell.classList.remove('selected');
                    toggleProfAvailability(profName, dt);
                }
            }
        });
    });

    window.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            renderProfCalendarHero();
            renderPresentersSection();
        }
    }, { once: false });
}

// ==========================================================================
// 7. COMMITTEE MANAGEMENT & OTHER MODALS
// ==========================================================================

function openPresenterModal(presenterToEdit) {
    const modal = document.getElementById('modalPresenter');
    const title = document.getElementById('modalPresenterTitle');
    const subtitle = document.getElementById('modalPresenterSubtitle');

    title.textContent = `${presenterToEdit.name} 심사위원단 및 발표 정보 설정`;
    document.getElementById('editPresenterId').value = presenterToEdit.id;
    document.getElementById('inputPresenterName').value = presenterToEdit.name;
    document.getElementById('inputCategory').value = presenterToEdit.category;
    document.getElementById('inputThesisTitle').value = presenterToEdit.thesisTitle || '';
    document.getElementById('inputLocation').value = presenterToEdit.location || '세미나실 1호';

    const isPhdGrad = presenterToEdit.category === '박사졸업발표';
    subtitle.textContent = isPhdGrad
        ? "규정: 박사졸업발표는 내부 심사위원 3인 + 외부 심사위원 2인 (총 5인) 구성입니다."
        : "규정: 석사졸업발표 및 박사주제발표는 내부 심사위원 3인 구성입니다.";

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

    if (isPhdGrad) {
        hint.innerHTML = `<span class="badge-tag-internal">내부 3인</span> (김수철, 이상옥, 권희홍, 한민수, 정용재) + <span class="badge-tag-external">외부 2인</span> (외부 1, 외부 2) 총 5인을 지정하세요.`;

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
        hint.innerHTML = `<span class="badge-tag-internal">내부 심사위원 3인</span> (김수철, 이상옥, 권희홍, 한민수, 정용재)을 지정하세요.`;

        const defaultRoles = [
            { role: "심사위원장", type: "internal" },
            { role: "지도교수", type: "internal" },
            { role: "심사위원", type: "internal" }
        ];

        defaultRoles.forEach((def, idx) => {
            const current = existingReviewers[idx];
            const currentName = current ? current.name : '';
            addProfessorSelectRow(def.role, def.type, currentName);
        });
    }
}

function addProfessorSelectRow(role = '심사위원', type = 'internal', selectedName = '') {
    const list = document.getElementById('reviewersInputList');
    const row = document.createElement('div');
    row.className = 'reviewer-row-item prof-select-row';

    const pool = type === 'external' ? PROFESSORS.external.map(p => p.name) : PROFESSORS.internal.map(p => p.name);
    const typeLabel = type === 'external' ? '외부' : '내부';
    const typeBadgeClass = type === 'external' ? 'badge-tag-external-xs' : 'badge-tag-internal-xs';

    let optionsHtml = `<option value="">-- ${typeLabel} 심사위원 선택 --</option>`;
    pool.forEach(pName => {
        optionsHtml += `<option value="${pName}" ${selectedName === pName ? 'selected' : ''}>${pName}</option>`;
    });

    row.innerHTML = `
        <div style="display:flex; align-items:center; gap:6px;">
            <span class="${typeBadgeClass}">${typeLabel}</span>
            <select class="form-control r-role" style="font-size:0.8rem;">
                <option value="심사위원장" ${role === '심사위원장' ? 'selected' : ''}>심사위원장</option>
                <option value="지도교수" ${role === '지도교수' ? 'selected' : ''}>지도교수</option>
                <option value="심사위원" ${role === '심사위원' ? 'selected' : ''}>심사위원</option>
            </select>
        </div>
        <select class="form-control r-name" data-type="${type}" required>
            ${optionsHtml}
        </select>
        <button type="button" class="btn-remove-row" title="행 삭제">&times;</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        row.remove();
    });

    list.appendChild(row);
}

document.getElementById('btnAddReviewerRow').addEventListener('click', () => {
    const cat = document.getElementById('inputCategory').value;
    const type = cat === '박사졸업발표' ? 'external' : 'internal';
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
        const type = nameSelect.getAttribute('data-type');
        if (rName) {
            reviewers.push({
                id: `r_${editId}_${idx + 1}`,
                name: rName,
                role: rRole,
                type: type || 'internal'
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
    const [y, m, d] = dateStr.split('-');
    const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];
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
        presenter.confirmedSchedule = {
            date: dateStr,
            time: timeStr,
            duration: 30,
            location: document.getElementById('confirmModalLocation').value.trim() || '세미나실'
        };
        saveState();
        closeModal('modalConfirmDefense');
        renderAll();
        showToast(`${presenter.name}님의 30분 발표 일정이 최종 확정되었습니다! 🎉`);
    };

    btnCancel.onclick = () => {
        if (confirm(`${presenter.name}님의 확정된 심사 일정을 취소하시겠습니까?`)) {
            cancelStudentConfirmation(presenter.id);
            closeModal('modalConfirmDefense');
        }
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
        const matched = [];
        [11, 12].forEach(m => {
            const daysInMonth = new Date(2026, m, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                TIME_SLOTS.forEach(time => {
                    if (analyzeSlotForStudent(presenter, `${dateStr} ${time}`).isAllMatch) {
                        const end = getEndTime30Min(time);
                        matched.push(`${dateStr} ${time} ~ ${end}`);
                    }
                });
            }
        });

        const topSlots = matched.slice(0, 3).map((s, idx) => `  ${idx + 1}. ${s}`).join('\n');

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
    loadState();
    renderAll();

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

    // Professor Filter Chips (외부 1, 외부 2 포함)
    document.querySelectorAll('#profFilterChips .prof-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#profFilterChips .prof-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            appState.profFilterTarget = chip.getAttribute('data-prof');
            renderProfCalendarHero();
        });
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

    document.getElementById('btnPrevPeriod').addEventListener('click', () => {
        appState.calendarMonth = appState.calendarMonth === 12 ? 11 : 12;
        renderMonthlyCalendar();
    });
    document.getElementById('btnNextPeriod').addEventListener('click', () => {
        appState.calendarMonth = appState.calendarMonth === 11 ? 12 : 11;
        renderMonthlyCalendar();
    });
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
    document.getElementById('chkOnlyWeekdays').addEventListener('change', renderWeeklyTimetable);

    document.getElementById('btnPrevDay').addEventListener('click', () => {
        const [y, m, d] = appState.currentDayDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) - 1);
        if (dateObj >= new Date(2026, 10, 1) && dateObj <= new Date(2026, 11, 31)) {
            appState.currentDayDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            renderDailyDetail();
        }
    });
    document.getElementById('btnNextDay').addEventListener('click', () => {
        const [y, m, d] = appState.currentDayDate.split('-');
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) + 1);
        if (dateObj >= new Date(2026, 10, 1) && dateObj <= new Date(2026, 11, 31)) {
            appState.currentDayDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
            renderDailyDetail();
        }
    });
    document.getElementById('directDatePicker').addEventListener('change', (e) => {
        appState.currentDayDate = e.target.value;
        renderDailyDetail();
    });

    document.getElementById('btnConfirmSlot').addEventListener('click', () => {
        openConfirmModal(getCurrentPresenter(), appState.currentDayDate, "14:00");
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
        const profName = appState.modalProfTargetName;
        const month = appState.modalProfInputMonth;
        const daysInMonth = new Date(2026, month, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(2026, month - 1, d);
            const dayOfWeek = dateObj.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const dateStr = `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                TIME_SLOTS.forEach(time => {
                    const dt = `${dateStr} ${time}`;
                    if (!isProfAvailable(profName, dt)) {
                        toggleProfAvailability(profName, dt);
                    }
                });
            }
        }
        renderInteractiveProfAvailTable();
        renderProfCalendarHero();
        renderPresentersSection();
        showToast(`${profName}: 해당 월 평일 전체 가능으로 설정되었습니다.`);
    });

    document.getElementById('btnProfSelectAfternoon').addEventListener('click', () => {
        const profName = appState.modalProfTargetName;
        const month = appState.modalProfInputMonth;
        const daysInMonth = new Date(2026, month, 0).getDate();
        const afternoonTimes = ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(2026, month - 1, d);
            const dayOfWeek = dateObj.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const dateStr = `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                afternoonTimes.forEach(time => {
                    const dt = `${dateStr} ${time}`;
                    if (!isProfAvailable(profName, dt)) {
                        toggleProfAvailability(profName, dt);
                    }
                });
            }
        }
        renderInteractiveProfAvailTable();
        renderProfCalendarHero();
        renderPresentersSection();
        showToast(`${profName}: 해당 월 평일 오후(13~18시) 가능으로 설정되었습니다.`);
    });

    document.getElementById('btnProfClear').addEventListener('click', () => {
        const profName = appState.modalProfTargetName;
        const month = appState.modalProfInputMonth;
        const monthPrefix = `2026-${String(month).padStart(2, '0')}`;

        if (appState.profAvailability[profName]) {
            appState.profAvailability[profName] = appState.profAvailability[profName].filter(
                dt => !dt.startsWith(monthPrefix)
            );
            saveState();
        }
        renderInteractiveProfAvailTable();
        renderProfCalendarHero();
        renderPresentersSection();
        showToast(`${profName}: 해당 월의 선택이 초기화되었습니다.`);
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
