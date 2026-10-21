/**
 * 대학원 학위논문 발표 일정 조율 플랫폼 (script.js)
 * - 인당 30분 발표 배정 (30분 단위 슬롯 지원)
 * - 석사졸업/박사주제: 내부 심사위원 3인 구성
 * - 박사졸업: 내부 심사위원 3인 + 외부 심사위원 2인 (총 5인 구성)
 * - 교수님 풀 (내부 5인, 외부 2인) 연동
 */

// ==========================================================================
// 1. Professor Pool & Default Roster Configuration
// ==========================================================================

const STORAGE_KEY_PRESENTERS = 'thesis_sched_roster_v4';
const STORAGE_KEY_AVAIL = 'thesis_sched_avail_v4';

const PROFESSOR_POOL = {
    internal: [
        "김수철 교수님",
        "이상옥 교수님",
        "권희홍 교수님",
        "한민수 교수님",
        "정용재 교수님"
    ],
    external: [
        "정광용 교수님",
        "조남철 교수님"
    ]
};

// 30-minute intervals from 09:00 to 18:30
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

const DEFAULT_PRESENTERS = [
    // 1. 박사졸업발표 (1명, 내부3 + 외부2 = 총 5인, 30분)
    {
        id: "p_phd_1",
        name: "김민제",
        category: "박사졸업발표",
        duration: 30,
        thesisTitle: "학위청구논문 심사",
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

    // 2. 박사주제발표 (4명, 내부 3인, 30분)
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

    // 3. 석사졸업발표 (5명, 내부 3인, 30분)
    {
        id: "p_ms_1",
        name: "김동녘",
        category: "석사졸업발표",
        duration: 30,
        thesisTitle: "석사학위 청구논문 발표",
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
        thesisTitle: "석사학위 청구논문 발표",
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
        thesisTitle: "석사학위 청구논문 발표",
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
        thesisTitle: "석사학위 청구논문 발표",
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
        thesisTitle: "석사학위 청구논문 발표",
        location: "세미나실 3호",
        reviewers: [
            { id: "r_ms5_1", name: "이상옥 교수님", role: "심사위원장", type: "internal" },
            { id: "r_ms5_2", name: "김수철 교수님", role: "지도교수", type: "internal" },
            { id: "r_ms5_3", name: "정용재 교수님", role: "심사위원", type: "internal" }
        ],
        confirmedSchedule: null
    }
];

function generateDefaultAvailability() {
    return {
        "p_phd_1": {
            "p_phd_1": ["2026-11-20 14:00", "2026-11-20 14:30", "2026-11-27 14:00", "2026-11-27 14:30", "2026-12-04 14:00"],
            "r_p1_1": ["2026-11-27 14:00", "2026-11-27 14:30", "2026-12-04 14:00"],
            "r_p1_2": ["2026-11-20 14:00", "2026-11-27 14:00", "2026-11-27 14:30"],
            "r_p1_3": ["2026-11-27 14:00", "2026-11-27 14:30"],
            "r_p1_4": ["2026-11-27 14:00", "2026-11-27 14:30"],
            "r_p1_5": ["2026-11-27 14:00", "2026-11-27 14:30"]
        },
        "p_ms_1": {
            "p_ms_1": ["2026-11-19 10:00", "2026-11-19 10:30", "2026-11-26 14:00", "2026-11-26 14:30"],
            "r_ms1_1": ["2026-11-19 10:00", "2026-11-19 10:30"],
            "r_ms1_2": ["2026-11-19 10:00", "2026-11-19 10:30", "2026-11-26 14:00"],
            "r_ms1_3": ["2026-11-19 10:00", "2026-11-19 10:30"]
        }
    };
}

let appState = {
    presenters: [],
    availability: {},
    activePage: 'home',
    currentPresenterId: 'p_phd_1',
    currentSubView: 'month',
    calendarYear: 2026,
    calendarMonth: 11,
    masterCalendarMonth: 11,
    currentDayDate: '2026-11-27',
    currentWeekIndex: 0,
    modalAvailMonth: 11,
    modalAvailTargetPersonId: null
};

function loadState() {
    try {
        const savedPresenters = localStorage.getItem(STORAGE_KEY_PRESENTERS);
        const savedAvail = localStorage.getItem(STORAGE_KEY_AVAIL);

        if (savedPresenters && savedAvail) {
            appState.presenters = JSON.parse(savedPresenters);
            appState.availability = JSON.parse(savedAvail);
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
    localStorage.setItem(STORAGE_KEY_AVAIL, JSON.stringify(appState.availability));
}

function resetToSampleData() {
    appState.presenters = JSON.parse(JSON.stringify(DEFAULT_PRESENTERS));
    appState.availability = generateDefaultAvailability();
    appState.currentPresenterId = "p_phd_1";
    saveState();
}

// ==========================================================================
// 2. Helper Functions (Dates, Slots, Matching)
// ==========================================================================

function getCurrentPresenter() {
    return appState.presenters.find(p => p.id === appState.currentPresenterId) || appState.presenters[0];
}

function getAllParticipants(presenter) {
    if (!presenter) return [];
    return [
        { id: presenter.id, name: `${presenter.name} (발표자)`, role: "발표자" },
        ...(presenter.reviewers || [])
    ];
}

function isSlotAvailable(presenterId, personId, dateTimeStr) {
    const pAvail = appState.availability[presenterId];
    if (!pAvail || !pAvail[personId]) return false;
    return pAvail[personId].includes(dateTimeStr);
}

function toggleSlotAvailability(presenterId, personId, dateTimeStr) {
    if (!appState.availability[presenterId]) {
        appState.availability[presenterId] = {};
    }
    if (!appState.availability[presenterId][personId]) {
        appState.availability[presenterId][personId] = [];
    }

    const list = appState.availability[presenterId][personId];
    const idx = list.indexOf(dateTimeStr);
    if (idx >= 0) {
        list.splice(idx, 1);
    } else {
        list.push(dateTimeStr);
    }
    saveState();
}

function analyzeSlot(presenter, dateTimeStr) {
    const participants = getAllParticipants(presenter);
    const total = participants.length;
    let availableCount = 0;
    const availableNames = [];
    const unavailableNames = [];
    let isPresenterAvail = false;

    participants.forEach(person => {
        const avail = isSlotAvailable(presenter.id, person.id, dateTimeStr);
        if (avail) {
            availableCount++;
            availableNames.push(person.name);
            if (person.id === presenter.id) isPresenterAvail = true;
        } else {
            unavailableNames.push(person.name);
        }
    });

    const isAllMatch = total > 0 && availableCount === total;
    return {
        total,
        availableCount,
        isPresenterAvail,
        isAllMatch,
        ratio: total > 0 ? (availableCount / total) : 0,
        availableNames,
        unavailableNames
    };
}

function analyzeDate(presenter, dateStr) {
    let goldenSlotCount = 0;
    let majoritySlotCount = 0;
    let anySlotCount = 0;

    TIME_SLOTS.forEach(time => {
        const dateTimeStr = `${dateStr} ${time}`;
        const res = analyzeSlot(presenter, dateTimeStr);
        if (res.isAllMatch) {
            goldenSlotCount++;
        } else if (res.ratio >= 0.5) {
            majoritySlotCount++;
        }
        if (res.availableCount > 0) {
            anySlotCount++;
        }
    });

    const isConfirmed = presenter.confirmedSchedule && presenter.confirmedSchedule.date === dateStr;

    return {
        dateStr,
        goldenSlotCount,
        majoritySlotCount,
        anySlotCount,
        isConfirmed
    };
}

// ==========================================================================
// 3. PAGE 1: HOME OVERVIEW DASHBOARD
// ==========================================================================

function renderHomeOverview() {
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

    renderMasterCalendar();
}

function renderRosterGrid(containerId, list) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    list.forEach(p => {
        const reviewers = p.reviewers || [];
        const requiredCount = p.category === '박사졸업발표' ? 5 : 3;
        const hasEnoughReviewers = reviewers.length >= requiredCount;
        const isConfirmed = p.confirmedSchedule !== null;

        const card = document.createElement('div');
        card.className = `roster-card ${isConfirmed ? 'is-confirmed-card' : ''}`;

        let statusBadgeHtml = '';
        if (isConfirmed) {
            const endTime = getEndTime30Min(p.confirmedSchedule.time);
            statusBadgeHtml = `<span class="status-badge confirmed">⭐ ${p.confirmedSchedule.date} (${p.confirmedSchedule.time}~${endTime}) 확정</span>`;
        } else if (hasEnoughReviewers) {
            statusBadgeHtml = `<span class="status-badge">조율 진행중</span>`;
        } else {
            statusBadgeHtml = `<span class="status-badge need-committee">심사위원 선택 필요</span>`;
        }

        let reviewerPreview = '';
        if (reviewers.length > 0) {
            const listStr = reviewers.map(r => `${r.role}:${r.name.replace(' 교수님', '')}`).join(', ');
            reviewerPreview = `<strong>심사위원 ${reviewers.length}인:</strong> ${listStr}`;
        } else {
            reviewerPreview = '<span style="color:#ef4444;">※ 심사위원 교수님이 아직 지정되지 않았습니다.</span>';
        }

        card.innerHTML = `
            <div class="roster-card-header">
                <div class="roster-name-wrap">
                    <h4 class="roster-student-name">${p.name}</h4>
                    <span class="roster-duration-tag">30분 발표</span>
                </div>
                ${statusBadgeHtml}
            </div>

            <div class="roster-reviewer-preview">
                ${reviewerPreview}
            </div>

            <div class="roster-card-actions">
                <button class="btn btn-sm btn-outline btn-manage-committee" data-id="${p.id}">
                    심사위원 선택/수정
                </button>
                <button class="btn btn-sm btn-primary btn-jump-coordination" data-id="${p.id}">
                    30분 일정 조율 →
                </button>
            </div>
        `;

        container.appendChild(card);
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

function renderMasterCalendar() {
    const year = 2026;
    const month = appState.masterCalendarMonth;
    const grid = document.getElementById('masterCalendarGrid');
    grid.innerHTML = '';

    document.getElementById('btnMasterNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('btnMasterDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const dNum = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${dNum}</span></div>`;
        grid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, d).getDay();

        const confirmedHere = appState.presenters.filter(
            p => p.confirmedSchedule && p.confirmedSchedule.date === dateStr
        );

        const goldenHere = [];
        appState.presenters.forEach(p => {
            if (!p.confirmedSchedule || p.confirmedSchedule.date !== dateStr) {
                const res = analyzeDate(p, dateStr);
                if (res.goldenSlotCount > 0) {
                    goldenHere.push({ presenter: p, count: res.goldenSlotCount });
                }
            }
        });

        const cell = document.createElement('div');
        let classes = 'cal-day-cell master-cal-cell';
        if (dayOfWeek === 0) classes += ' is-sun';
        if (dayOfWeek === 6) classes += ' is-sat';
        if (confirmedHere.length > 0) classes += ' has-confirmed';
        cell.className = classes;

        let chipsHtml = '';
        confirmedHere.forEach(item => {
            const end = getEndTime30Min(item.confirmedSchedule.time);
            chipsHtml += `
                <div class="cal-slot-chip confirmed-chip" title="${item.name} (${item.category}) ${item.confirmedSchedule.time}~${end} 확정">
                    ⭐ ${item.name} (${item.confirmedSchedule.time}~${end})
                </div>
            `;
        });

        goldenHere.slice(0, 2).forEach(item => {
            chipsHtml += `
                <div class="cal-slot-chip golden" title="${item.presenter.name} 심사위원 전원 가능 30분 슬롯 ${item.count}개">
                    ✓ ${item.presenter.name} 가능 (${item.count}개)
                </div>
            `;
        });

        if (goldenHere.length > 2) {
            chipsHtml += `<div class="cal-slot-chip" style="font-size:0.68rem; color:#64748b;">외 ${goldenHere.length - 2}명 가능</div>`;
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${d}</span>
                ${confirmedHere.length > 0 ? `<span class="cal-day-badge badge-confirmed">${confirmedHere.length}건 확정</span>` : ''}
            </div>
            <div class="cal-day-content">${chipsHtml}</div>
        `;

        grid.appendChild(cell);
    }

    const totalRendered = firstDay + daysInMonth;
    const remaining = totalRendered <= 35 ? (35 - totalRendered) : (42 - totalRendered);
    for (let j = 1; j <= remaining; j++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${j}</span></div>`;
        grid.appendChild(cell);
    }
}

// ==========================================================================
// 4. PAGE 2: INDIVIDUAL PRESENTER COORDINATION VIEW
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
    document.getElementById('bannerThesis').textContent = `발표자: ${presenter.name} (${presenter.thesisTitle || '학위논문 발표'})`;
    document.getElementById('bannerDuration').textContent = `인당 30분`;
    document.getElementById('bannerLocation').textContent = presenter.location || "세미나실 1호";

    const statusBadge = document.getElementById('bannerStatus');
    if (presenter.confirmedSchedule) {
        const end = getEndTime30Min(presenter.confirmedSchedule.time);
        statusBadge.className = 'status-badge confirmed';
        statusBadge.textContent = `심사 확정 (${presenter.confirmedSchedule.date} ${presenter.confirmedSchedule.time}~${end})`;
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
            <span>입력현황</span>
        </div>
    `;

    const pAvail = appState.availability[presenter.id] || {};

    if (reviewers.length === 0) {
        tagsContainer.innerHTML += `
            <div style="font-size:0.8rem; color:#ef4444; padding:8px 0;">
                아직 등록된 심사위원이 없습니다.<br>
                상단의 [심사위원 선택/수정] 버튼을 눌러주세요.
            </div>
        `;
        return;
    }

    reviewers.forEach(r => {
        const hasInput = pAvail[r.id] && pAvail[r.id].length > 0;
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
            <span class="avail-state-dot ${hasInput ? 'dot-done' : 'dot-pending'}" title="${hasInput ? '일정 입력 완료' : '미입력'}"></span>
        `;
        tagsContainer.appendChild(chip);
    });
}

/**
 * INDIVIDUAL SUBVIEW 1: MONTHLY CALENDAR
 */
function renderMonthlyCalendar() {
    const presenter = getCurrentPresenter();
    const year = 2026;
    const month = appState.calendarMonth;

    document.getElementById('periodLabel').textContent = `${year}년 ${month}월`;
    document.getElementById('chipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('chipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    const grid = document.getElementById('calendarGridBody');
    grid.innerHTML = '';

    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const dNum = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${dNum}</span></div>`;
        grid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        const dateAnalysis = analyzeDate(presenter, dateStr);

        const cell = document.createElement('div');
        let classes = 'cal-day-cell';
        if (dayOfWeek === 0) classes += ' is-sun';
        if (dayOfWeek === 6) classes += ' is-sat';
        if (dateAnalysis.isConfirmed) classes += ' confirmed-day';
        cell.className = classes;

        let badgeHtml = '';
        if (dateAnalysis.isConfirmed) {
            badgeHtml = `<span class="cal-day-badge badge-confirmed">30분 확정</span>`;
        } else if (dateAnalysis.goldenSlotCount > 0) {
            badgeHtml = `<span class="cal-day-badge badge-golden">전원가능 ${dateAnalysis.goldenSlotCount}건</span>`;
        } else if (dateAnalysis.majoritySlotCount > 0) {
            badgeHtml = `<span class="cal-day-badge badge-majority">과반 가능</span>`;
        }

        let chipsHtml = '';
        if (dateAnalysis.isConfirmed) {
            const end = getEndTime30Min(presenter.confirmedSchedule.time);
            chipsHtml += `<div class="cal-slot-chip confirmed-chip">⭐ ${presenter.confirmedSchedule.time}~${end} 심사</div>`;
        } else if (dateAnalysis.goldenSlotCount > 0) {
            TIME_SLOTS.forEach(time => {
                if (analyzeSlot(presenter, `${dateStr} ${time}`).isAllMatch && chipsHtml === '') {
                    const end = getEndTime30Min(time);
                    chipsHtml += `<div class="cal-slot-chip golden">✓ ${time}~${end} 전원 일치</div>`;
                }
            });
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${d}</span>
                ${badgeHtml}
            </div>
            <div class="cal-day-content">${chipsHtml}</div>
            <div class="cal-day-footer">
                ${dateAnalysis.anySlotCount > 0 ? `가능 슬롯 ${dateAnalysis.anySlotCount}개` : '<span style="color:#cbd5e1;">일정 없음</span>'}
            </div>
        `;

        cell.addEventListener('click', () => {
            appState.currentDayDate = dateStr;
            switchSubView('day');
        });

        grid.appendChild(cell);
    }

    const totalRendered = firstDay + daysInMonth;
    const remaining = totalRendered <= 35 ? (35 - totalRendered) : (42 - totalRendered);
    for (let j = 1; j <= remaining; j++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `<div class="cal-day-header"><span class="cal-day-num">${j}</span></div>`;
        grid.appendChild(cell);
    }
}

/**
 * INDIVIDUAL SUBVIEW 2: WEEKLY TIMETABLE (30 MIN SLOTS)
 */
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
            const analysis = analyzeSlot(presenter, dateTimeStr);
            const isConfirmed = presenter.confirmedSchedule &&
                                presenter.confirmedSchedule.date === d.dateStr &&
                                presenter.confirmedSchedule.time === time;

            let cellClass = 'week-slot-cell';
            let cellContent = '';

            if (isConfirmed) {
                cellClass += ' slot-confirmed';
                cellContent = `<span class="slot-inner-badge">⭐ 30분 확정</span>`;
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

            const tooltip = `[${dateTimeStr} ~ ${endTime}]\n가능: ${analysis.availableNames.join(', ') || '없음'}\n불가: ${analysis.unavailableNames.join(', ') || '없음'}`;

            tableHtml += `
                <td class="${cellClass}" title="${tooltip}" data-datetime="${dateTimeStr}">
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
            if (dt) {
                const [date] = dt.split(' ');
                appState.currentDayDate = date;
                switchSubView('day');
            }
        });
    });
}

/**
 * INDIVIDUAL SUBVIEW 3: DAILY DETAIL (30-MIN SLOTS)
 */
function renderDailyDetail() {
    const presenter = getCurrentPresenter();
    const dateStr = appState.currentDayDate;
    const [y, m, d] = dateStr.split('-');
    const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];

    document.getElementById('currentDayTitle').textContent = `${y}년 ${m}월 ${d}일 (${dayName}요일)`;
    document.getElementById('directDatePicker').value = dateStr;

    const participants = getAllParticipants(presenter);
    const matrixContainer = document.getElementById('dailyMatrix');

    let tableHtml = `<table class="daily-table"><thead><tr><th style="width: 110px;" class="center">30분 슬롯</th>`;

    participants.forEach(p => {
        const typeBadge = p.type === 'external' ? '<span class="badge-tag-external-xs">외부</span>' : (p.type === 'internal' ? '<span class="badge-tag-internal-xs">내부</span>' : '');
        tableHtml += `
            <th>
                <div class="daily-person-header">
                    <span>${typeBadge} ${p.name}</span>
                    <span class="p-role">${p.role}</span>
                </div>
            </th>
        `;
    });

    tableHtml += `
                    <th style="width: 130px;" class="center">참석 현황</th>
                    <th style="width: 140px;" class="center">30분 심사 확정</th>
                </tr>
            </thead>
            <tbody>
    `;

    TIME_SLOTS.forEach(time => {
        const endTime = getEndTime30Min(time);
        const dateTimeStr = `${dateStr} ${time}`;
        const analysis = analyzeSlot(presenter, dateTimeStr);
        const isConfirmed = presenter.confirmedSchedule &&
                            presenter.confirmedSchedule.date === dateStr &&
                            presenter.confirmedSchedule.time === time;

        const rowClass = analysis.isAllMatch ? 'daily-time-row golden-row' : 'daily-time-row';

        tableHtml += `
            <tr class="${rowClass}">
                <td class="center" style="font-weight:700; font-size:0.8rem;">${time} ~ ${endTime}</td>
        `;

        participants.forEach(p => {
            const avail = isSlotAvailable(presenter.id, p.id, dateTimeStr);
            tableHtml += `
                <td>
                    <button class="daily-cell-btn ${avail ? 'status-yes' : 'status-no'}" 
                            data-person-id="${p.id}" 
                            data-datetime="${dateTimeStr}">
                        ${avail ? '✓ 가능' : '— 불가'}
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

        let actionBtn = '';
        if (isConfirmed) {
            actionBtn = `<span class="btn-chip" style="background:#8b5cf6; color:#fff;">⭐ 확정됨</span>`;
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

    matrixContainer.querySelectorAll('.daily-cell-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const personId = btn.getAttribute('data-person-id');
            const dt = btn.getAttribute('data-datetime');
            toggleSlotAvailability(presenter.id, personId, dt);
            renderDailyDetail();
            updateDetailBanner();
            showToast("30분 슬롯 일정이 즉시 반영되었습니다.");
        });
    });

    matrixContainer.querySelectorAll('.btn-select-final').forEach(btn => {
        btn.addEventListener('click', () => {
            const d = btn.getAttribute('data-date');
            const t = btn.getAttribute('data-time');
            openConfirmModal(presenter, d, t);
        });
    });
}

/**
 * INDIVIDUAL SUBVIEW 4: RECOMMENDATIONS (30-MIN SLOTS)
 */
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
                const analysis = analyzeSlot(presenter, dt);
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
                <p>발표자 또는 교수님들의 가능한 시간대를 조금 더 추가 선택해주세요.</p>
                <button class="btn btn-primary" style="margin-top:14px;" onclick="document.getElementById('btnQuickInput').click()">
                    시간표 체크 입력하기
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
                <button class="btn btn-success btn-sm btn-rec-confirm" data-date="${slot.dateStr}" data-time="${slot.time}">
                    ${isConfirmed ? '확정 정보 변경' : '이 시간으로 확정'}
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
            const d = btn.getAttribute('data-date');
            const t = btn.getAttribute('data-time');
            openConfirmModal(presenter, d, t);
        });
    });
}

// ==========================================================================
// 5. COMMITTEE MANAGEMENT MODAL (내부5인 / 외부2인 풀 연동)
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

    // Watch category change to automatically adapt rows
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
        hint.innerHTML = `<span class="badge-tag-internal">내부 3인</span> (김수철, 이상옥, 권희홍, 한민수, 정용재) + <span class="badge-tag-external">외부 2인</span> (정광용, 조남철) 총 5인을 지정하세요.`;

        // 5 rows: 3 internal, 2 external
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

        // 3 rows: internal
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

    const pool = type === 'external' ? PROFESSOR_POOL.external : PROFESSOR_POOL.internal;
    const typeLabel = type === 'external' ? '외부' : '내부';
    const typeBadgeClass = type === 'external' ? 'badge-tag-external-xs' : 'badge-tag-internal-xs';

    let optionsHtml = `<option value="">-- ${typeLabel} 교수님 선택 --</option>`;
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
        p.duration = 30; // Enforce 30 mins
        p.thesisTitle = thesisTitle;
        p.location = location;
        p.reviewers = reviewers;
    }

    saveState();
    closeModal('modalPresenter');
    renderAll();
    showToast(`${p.name} 심사위원단 및 발표 정보가 저장되었습니다.`);
});

/**
 * MODAL 2: 30-MIN AVAILABILITY ENTRY
 */
function openAvailabilityModal() {
    const presenter = getCurrentPresenter();
    const modal = document.getElementById('modalAvailability');
    const targetSelect = document.getElementById('availTargetSelect');
    targetSelect.innerHTML = '';

    const participants = getAllParticipants(presenter);
    participants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.role}: ${p.name}`;
        if (!appState.modalAvailTargetPersonId && p.id === presenter.id) {
            opt.selected = true;
            appState.modalAvailTargetPersonId = p.id;
        } else if (appState.modalAvailTargetPersonId === p.id) {
            opt.selected = true;
        }
        targetSelect.appendChild(opt);
    });

    if (!appState.modalAvailTargetPersonId && participants.length > 0) {
        appState.modalAvailTargetPersonId = participants[0].id;
    }

    renderInteractiveAvailTable();
    modal.classList.add('active');
}

function renderInteractiveAvailTable() {
    const presenter = getCurrentPresenter();
    const personId = appState.modalAvailTargetPersonId;
    const month = appState.modalAvailMonth;
    const tableContainer = document.getElementById('availTable');

    document.getElementById('modalChipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('modalChipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

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
            const isAvail = isSlotAvailable(presenter.id, personId, dt);
            tableHtml += `
                <td class="avail-check-cell ${isAvail ? 'selected' : ''}" 
                    data-datetime="${dt}" 
                    title="${dt} ~ ${endTime}">
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
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isMouseDown = true;
            const dt = cell.getAttribute('data-datetime');
            const currentSelected = cell.classList.contains('selected');
            modeToSet = !currentSelected;

            if (modeToSet) cell.classList.add('selected');
            else cell.classList.remove('selected');
            toggleSlotAvailability(presenter.id, personId, dt);
        });

        cell.addEventListener('mouseenter', () => {
            if (isMouseDown) {
                const dt = cell.getAttribute('data-datetime');
                const currentSelected = cell.classList.contains('selected');
                if (currentSelected !== modeToSet) {
                    if (modeToSet) cell.classList.add('selected');
                    else cell.classList.remove('selected');
                    toggleSlotAvailability(presenter.id, personId, dt);
                }
            }
        });
    });

    window.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            updateDetailBanner();
        }
    }, { once: false });
}

/**
 * MODAL 3: CONFIRM 30-MIN DEFENSE SCHEDULE
 */
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
    if (presenter.confirmedSchedule) {
        btnCancel.style.display = 'inline-flex';
    } else {
        btnCancel.style.display = 'none';
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
        showToast("학위논문 30분 발표 일정이 최종 확정되었습니다! 🎉");
    };

    btnCancel.onclick = () => {
        if (confirm("확정된 일정을 취소하고 다시 조율 상태로 변경하시겠습니까?")) {
            presenter.confirmedSchedule = null;
            saveState();
            closeModal('modalConfirmDefense');
            renderAll();
            showToast("심사 확정이 취소되었습니다.");
        }
    };

    modal.classList.add('active');
}

/**
 * MODAL 5: ANNOUNCEMENT COPY (30 MIN)
 */
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
                    if (analyzeSlot(presenter, `${dateStr} ${time}`).isAllMatch) {
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

// ==========================================================================
// 6. Navigation & View Routing
// ==========================================================================

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
        renderHomeOverview();
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

    document.getElementById('brandHomeBtn').addEventListener('click', navigateToHome);
    document.getElementById('btnNavHome').addEventListener('click', navigateToHome);
    document.getElementById('btnBackToHome').addEventListener('click', navigateToHome);

    document.getElementById('btnProfPoolModal').addEventListener('click', () => {
        document.getElementById('modalProfPool').classList.add('active');
    });

    document.getElementById('currentPresenterSelect').addEventListener('change', (e) => {
        navigateToPresenter(e.target.value);
    });

    document.getElementById('btnEditCommitteeDirect').addEventListener('click', () => {
        openPresenterModal(getCurrentPresenter());
    });
    document.getElementById('btnQuickInput').addEventListener('click', () => {
        openAvailabilityModal();
    });

    document.getElementById('btnMasterNov').addEventListener('click', () => {
        appState.masterCalendarMonth = 11;
        renderMasterCalendar();
    });
    document.getElementById('btnMasterDec').addEventListener('click', () => {
        appState.masterCalendarMonth = 12;
        renderMasterCalendar();
    });

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

    document.getElementById('availTargetSelect').addEventListener('change', (e) => {
        appState.modalAvailTargetPersonId = e.target.value;
        renderInteractiveAvailTable();
    });
    document.getElementById('modalChipNov').addEventListener('click', () => {
        appState.modalAvailMonth = 11;
        renderInteractiveAvailTable();
    });
    document.getElementById('modalChipDec').addEventListener('click', () => {
        appState.modalAvailMonth = 12;
        renderInteractiveAvailTable();
    });

    document.getElementById('btnSelectAllSlots').addEventListener('click', () => {
        const presenter = getCurrentPresenter();
        const personId = appState.modalAvailTargetPersonId;
        const month = appState.modalAvailMonth;
        const daysInMonth = new Date(2026, month, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(2026, month - 1, d);
            const dayOfWeek = dateObj.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const dateStr = `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                TIME_SLOTS.forEach(time => {
                    const dt = `${dateStr} ${time}`;
                    if (!isSlotAvailable(presenter.id, personId, dt)) {
                        toggleSlotAvailability(presenter.id, personId, dt);
                    }
                });
            }
        }
        renderInteractiveAvailTable();
        updateDetailBanner();
        showToast("평일 전체 가능으로 설정되었습니다.");
    });

    document.getElementById('btnClearTargetSlots').addEventListener('click', () => {
        const presenter = getCurrentPresenter();
        const personId = appState.modalAvailTargetPersonId;
        const month = appState.modalAvailMonth;
        const monthPrefix = `2026-${String(month).padStart(2, '0')}`;

        if (appState.availability[presenter.id] && appState.availability[presenter.id][personId]) {
            appState.availability[presenter.id][personId] = appState.availability[presenter.id][personId].filter(
                dt => !dt.startsWith(monthPrefix)
            );
            saveState();
        }
        renderInteractiveAvailTable();
        updateDetailBanner();
        showToast("해당 월의 선택이 초기화되었습니다.");
    });

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
