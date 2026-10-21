/**
 * 대학원 학위논문 심사 일정 조율 플랫폼 (script.js)
 * 2026년 11월 ~ 12월 캘린더 지원, 발표자 및 심사위원 관리, 다중 뷰 (월/주/일), 최적 매칭 및 공지문 생성
 */

// ==========================================================================
// 1. Initial Sample Data & Storage Management
// ==========================================================================

const STORAGE_KEY_PRESENTERS = 'thesis_sched_presenters_2026';
const STORAGE_KEY_AVAIL = 'thesis_sched_availability_2026';

const DEFAULT_PRESENTERS = [
    {
        id: "p_1",
        name: "김민우",
        degree: "석사",
        department: "컴퓨터인공지능학과",
        thesisTitle: "엣지 디바이스 환경에서의 고효율 경량 딥러닝 모델 추론 가속 연구",
        duration: 60,
        location: "공학관 401호 (온·오프라인 병행)",
        reviewers: [
            { id: "r_1_1", name: "박정훈 교수", role: "심사위원장", affiliation: "본교 AI대학원" },
            { id: "r_1_2", name: "이성민 교수", role: "지도교수", affiliation: "본교 컴퓨터공학과" },
            { id: "r_1_3", name: "최은지 박사", role: "심사위원", affiliation: "한국전자통신연구원(ETRI)" }
        ],
        confirmedSchedule: {
            date: "2026-11-20",
            time: "14:00",
            duration: 60,
            location: "공학관 401호"
        }
    },
    {
        id: "p_2",
        name: "이지수",
        degree: "박사",
        department: "바이오메디컬공학과",
        thesisTitle: "멀티모달 바이오마커 기반의 조기 치매 예측 알고리즘 설계 및 임상 검증",
        duration: 120,
        location: "의학관 세미나실 2호실",
        reviewers: [
            { id: "r_2_1", name: "강현우 교수", role: "심사위원장", affiliation: "본교 의과대학" },
            { id: "r_2_2", name: "송지민 교수", role: "지도교수", affiliation: "본교 바이오공학과" },
            { id: "r_2_3", name: "정태양 교수", role: "심사위원", affiliation: "서울대학교병원" },
            { id: "r_2_4", name: "오혜련 교수", role: "심사위원", affiliation: "KAIST 전산학부" },
            { id: "r_2_5", name: "윤도현 연구위원", role: "심사위원", affiliation: "국립보건연구원" }
        ],
        confirmedSchedule: null
    }
];

function generateDefaultAvailability() {
    // Generate realistic overlapping schedules for 2026 Nov & Dec
    const avail = {
        "p_1": {
            // Presenter Kim is flexible on most afternoons
            "p_1": [
                "2026-11-18 10:00", "2026-11-18 11:00", "2026-11-18 14:00", "2026-11-18 15:00", "2026-11-18 16:00",
                "2026-11-20 13:00", "2026-11-20 14:00", "2026-11-20 15:00", "2026-11-20 16:00",
                "2026-11-25 10:00", "2026-11-25 11:00", "2026-11-25 14:00", "2026-11-25 15:00",
                "2026-12-04 14:00", "2026-12-04 15:00", "2026-12-04 16:00"
            ],
            // Chair Park
            "r_1_1": [
                "2026-11-18 14:00", "2026-11-18 15:00",
                "2026-11-20 14:00", "2026-11-20 15:00", "2026-11-20 16:00",
                "2026-11-25 10:00", "2026-11-25 11:00",
                "2026-12-04 14:00", "2026-12-04 15:00"
            ],
            // Advisor Lee
            "r_1_2": [
                "2026-11-18 10:00", "2026-11-18 11:00", "2026-11-18 14:00",
                "2026-11-20 13:00", "2026-11-20 14:00", "2026-11-20 15:00",
                "2026-11-25 10:00", "2026-11-25 11:00", "2026-11-25 14:00",
                "2026-12-04 15:00", "2026-12-04 16:00"
            ],
            // Reviewer Choi (External)
            "r_1_3": [
                "2026-11-20 14:00", "2026-11-20 15:00", "2026-11-20 16:00",
                "2026-11-25 10:00", "2026-11-25 11:00",
                "2026-12-04 14:00", "2026-12-04 15:00"
            ]
        },
        "p_2": {
            "p_2": [
                "2026-11-24 14:00", "2026-11-24 15:00", "2026-11-24 16:00",
                "2026-12-08 10:00", "2026-12-08 11:00", "2026-12-08 14:00", "2026-12-08 15:00"
            ],
            "r_2_1": ["2026-11-24 14:00", "2026-11-24 15:00", "2026-12-08 10:00", "2026-12-08 11:00"],
            "r_2_2": ["2026-11-24 14:00", "2026-11-24 15:00", "2026-12-08 10:00", "2026-12-08 11:00"],
            "r_2_3": ["2026-11-24 14:00", "2026-11-24 15:00", "2026-12-08 10:00", "2026-12-08 11:00"],
            "r_2_4": ["2026-11-24 14:00", "2026-11-24 15:00", "2026-12-08 10:00", "2026-12-08 11:00"],
            "r_2_5": ["2026-11-24 14:00", "2026-11-24 15:00", "2026-12-08 10:00", "2026-12-08 11:00"]
        }
    };
    return avail;
}

// Global Application State
let appState = {
    presenters: [],
    availability: {},
    currentPresenterId: null,
    currentView: 'month',
    calendarYear: 2026,
    calendarMonth: 11, // 11 for Nov, 12 for Dec
    currentDayDate: '2026-11-18',
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

    if (appState.presenters.length > 0) {
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
    appState.currentPresenterId = appState.presenters[0].id;
    saveState();
    showToast("기본 예시 데이터가 복원되었습니다.");
}

// ==========================================================================
// 2. Helper Functions (Dates, Slots, Matching)
// ==========================================================================

const TIME_SLOTS = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
];

function getCurrentPresenter() {
    return appState.presenters.find(p => p.id === appState.currentPresenterId) || appState.presenters[0];
}

function getCommitteeMembers(presenter) {
    if (!presenter) return [];
    return presenter.reviewers || [];
}

function getAllParticipants(presenter) {
    if (!presenter) return [];
    return [
        { id: presenter.id, name: presenter.name + " (발표자)", role: "발표자" },
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

/**
 * Returns matching metrics for a given dateTimeStr ("2026-11-20 14:00")
 * { total, availableCount, isPresenterAvail, isAllMatch, availableNames, unavailableNames }
 */
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

/**
 * Checks all slots on a specific date (YYYY-MM-DD)
 */
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
// 3. UI Renderers
// ==========================================================================

function updateHeaderAndBanner() {
    const presenter = getCurrentPresenter();
    if (!presenter) return;

    // Selector Dropdown
    const selector = document.getElementById('currentPresenterSelect');
    selector.innerHTML = '';
    appState.presenters.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `[${p.degree}] ${p.name} (${p.department})`;
        if (p.id === presenter.id) opt.selected = true;
        selector.appendChild(opt);
    });

    // Banner elements
    document.getElementById('bannerDegree').textContent = `${presenter.degree}학위 과정`;
    document.getElementById('bannerDept').textContent = presenter.department;
    document.getElementById('bannerThesis').textContent = presenter.thesisTitle;
    document.getElementById('bannerPresenterName').textContent = `${presenter.name} 연구원`;
    document.getElementById('bannerDuration').textContent = `${presenter.duration || 60}분`;
    document.getElementById('bannerLocation').textContent = presenter.location || "미정 (추후 공지)";

    const statusBadge = document.getElementById('bannerStatus');
    if (presenter.confirmedSchedule) {
        statusBadge.className = 'status-badge confirmed';
        statusBadge.textContent = `심사 확정 (${presenter.confirmedSchedule.date} ${presenter.confirmedSchedule.time})`;
    } else {
        statusBadge.className = 'status-badge';
        statusBadge.textContent = '일정 조율 진행중';
    }

    // Committee count & tags
    const reviewers = presenter.reviewers || [];
    const pAvail = appState.availability[presenter.id] || {};
    let submittedCount = 0;
    reviewers.forEach(r => {
        if (pAvail[r.id] && pAvail[r.id].length > 0) submittedCount++;
    });

    document.getElementById('bannerCommitteeCount').textContent = `총 ${reviewers.length}명 (일정 입력 ${submittedCount}명)`;

    const tagsContainer = document.getElementById('bannerCommitteeTags');
    tagsContainer.innerHTML = `
        <div class="committee-title-row">
            <span>심사위원단 구성</span>
            <span>입력현황</span>
        </div>
    `;

    reviewers.forEach(r => {
        const hasInput = pAvail[r.id] && pAvail[r.id].length > 0;
        let roleClass = 'role-member';
        if (r.role.includes('위원장')) roleClass = 'role-chair';
        else if (r.role.includes('지도')) roleClass = 'role-advisor';

        const chip = document.createElement('div');
        chip.className = 'committee-member-chip';
        chip.innerHTML = `
            <div>
                <span class="member-role-tag ${roleClass}">${r.role}</span>
                <strong>${r.name}</strong>
                <span style="font-size:0.75rem; color:#64748b; margin-left:4px;">${r.affiliation || ''}</span>
            </div>
            <span class="avail-state-dot ${hasInput ? 'dot-done' : 'dot-pending'}" title="${hasInput ? '일정 입력 완료' : '미입력'}"></span>
        `;
        tagsContainer.appendChild(chip);
    });
}

/**
 * VIEW 1: MONTHLY CALENDAR RENDERER (November or December 2026)
 */
function renderMonthlyCalendar() {
    const presenter = getCurrentPresenter();
    const year = 2026;
    const month = appState.calendarMonth; // 11 or 12

    // Update Period Label & Chips
    document.getElementById('periodLabel').textContent = `${year}년 ${month}월`;
    document.getElementById('chipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('chipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    const grid = document.getElementById('calendarGridBody');
    grid.innerHTML = '';

    // First day of month (0 = Sun, 1 = Mon ... 6 = Sat)
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    // 1. Prev month filler days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dNum = prevMonthDays - i;
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${dNum}</span>
            </div>
        `;
        grid.appendChild(cell);
    }

    // 2. Current month days
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
            badgeHtml = `<span class="cal-day-badge badge-confirmed">심사 확정</span>`;
        } else if (dateAnalysis.goldenSlotCount > 0) {
            badgeHtml = `<span class="cal-day-badge badge-golden">전원가능 ${dateAnalysis.goldenSlotCount}건</span>`;
        } else if (dateAnalysis.majoritySlotCount > 0) {
            badgeHtml = `<span class="cal-day-badge badge-majority">과반 가능</span>`;
        }

        // Slot chips
        let chipsHtml = '';
        if (dateAnalysis.isConfirmed) {
            chipsHtml += `<div class="cal-slot-chip confirmed-chip">⭐ ${presenter.confirmedSchedule.time} 심사 확정</div>`;
        } else if (dateAnalysis.goldenSlotCount > 0) {
            // Pick first golden slot
            TIME_SLOTS.forEach(time => {
                if (analyzeSlot(presenter, `${dateStr} ${time}`).isAllMatch && chipsHtml === '') {
                    chipsHtml += `<div class="cal-slot-chip golden">✓ ${time} 전원 일치</div>`;
                }
            });
        }

        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${d}</span>
                ${badgeHtml}
            </div>
            <div class="cal-day-content">
                ${chipsHtml}
            </div>
            <div class="cal-day-footer">
                ${dateAnalysis.anySlotCount > 0 ? `가능 시간대 ${dateAnalysis.anySlotCount}개` : '<span style="color:#cbd5e1;">일정 없음</span>'}
            </div>
        `;

        // Click on day to switch directly to Daily View
        cell.addEventListener('click', () => {
            appState.currentDayDate = dateStr;
            switchView('day');
        });

        grid.appendChild(cell);
    }

    // 3. Next month filler days to complete grid (up to 35 or 42 cells)
    const totalRendered = firstDay + daysInMonth;
    const remaining = totalRendered <= 35 ? (35 - totalRendered) : (42 - totalRendered);
    for (let j = 1; j <= remaining; j++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.innerHTML = `
            <div class="cal-day-header">
                <span class="cal-day-num">${j}</span>
            </div>
        `;
        grid.appendChild(cell);
    }
}

/**
 * VIEW 2: WEEKLY TIMETABLE RENDERER
 */
function getAllWeeks() {
    // Collect all weeks spanning 2026-11-01 to 2026-12-31
    const weeks = [];
    let curDate = new Date(2026, 10, 1); // 2026-11-01
    const endDate = new Date(2026, 11, 31); // 2026-12-31

    // Move to starting Monday of the first week
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

        // Only include week if at least one day is in Nov or Dec 2026
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

    // Populate week selector
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

    // Render Table
    let tableHtml = `
        <table class="weekly-table">
            <thead>
                <tr>
                    <th style="width: 80px;">시간</th>
    `;

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
        tableHtml += `
            <tr>
                <td class="time-col">${time}</td>
        `;

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
                cellContent = `<span class="slot-inner-badge">⭐ 심사확정</span>`;
            } else if (analysis.isAllMatch) {
                cellClass += ' slot-all';
                cellContent = `<span class="slot-inner-badge">✓ 전원 가능 (${analysis.total}/${analysis.total})</span>`;
            } else if (analysis.ratio >= 0.6) {
                cellClass += ' slot-most';
                cellContent = `<span class="slot-inner-badge">${analysis.availableCount}/${analysis.total}명 가능</span>`;
            } else if (analysis.availableCount > 0) {
                cellClass += ' slot-partial';
                cellContent = `<span class="slot-inner-badge">${analysis.availableCount}/${analysis.total}명</span>`;
            } else {
                cellClass += ' slot-none';
                cellContent = `<span style="font-size:0.7rem; color:#cbd5e1;">-</span>`;
            }

            const tooltip = `[${dateTimeStr}]\n가능: ${analysis.availableNames.join(', ') || '없음'}\n불가: ${analysis.unavailableNames.join(', ') || '없음'}`;

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

    // Click handler for cells in week view: jump to day view
    matrixContainer.querySelectorAll('.week-slot-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const dt = cell.getAttribute('data-datetime');
            if (dt) {
                const [date] = dt.split(' ');
                appState.currentDayDate = date;
                switchView('day');
            }
        });
    });
}

/**
 * VIEW 3: DAILY DETAIL & INSTANT EDIT RENDERER
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

    let tableHtml = `
        <table class="daily-table">
            <thead>
                <tr>
                    <th style="width: 100px;" class="center">시간</th>
    `;

    participants.forEach(p => {
        tableHtml += `
            <th>
                <div class="daily-person-header">
                    <span>${p.name}</span>
                    <span class="p-role">${p.role} ${p.affiliation ? '(' + p.affiliation + ')' : ''}</span>
                </div>
            </th>
        `;
    });

    tableHtml += `
                    <th style="width: 130px;" class="center">참석 가능 현황</th>
                    <th style="width: 140px;" class="center">심사 확정 조율</th>
                </tr>
            </thead>
            <tbody>
    `;

    TIME_SLOTS.forEach(time => {
        const dateTimeStr = `${dateStr} ${time}`;
        const analysis = analyzeSlot(presenter, dateTimeStr);
        const isConfirmed = presenter.confirmedSchedule &&
                            presenter.confirmedSchedule.date === dateStr &&
                            presenter.confirmedSchedule.time === time;

        const rowClass = analysis.isAllMatch ? 'daily-time-row golden-row' : 'daily-time-row';

        tableHtml += `
            <tr class="${rowClass}">
                <td class="center" style="font-weight:700;">${time}</td>
        `;

        // Participant columns with toggle buttons
        participants.forEach(p => {
            const avail = isSlotAvailable(presenter.id, p.id, dateTimeStr);
            tableHtml += `
                <td>
                    <button class="daily-cell-btn ${avail ? 'status-yes' : 'status-no'}" 
                            data-person-id="${p.id}" 
                            data-datetime="${dateTimeStr}">
                        ${avail ? '✓ 참석 가능' : '— 불가'}
                    </button>
                </td>
            `;
        });

        // Summary Match Pill
        let summaryPill = '';
        if (analysis.isAllMatch) {
            summaryPill = `<span class="daily-summary-pill all-match">🏆 전원 가능 (${analysis.total}/${analysis.total})</span>`;
        } else if (analysis.availableCount > 0) {
            summaryPill = `<span class="daily-summary-pill partial-match">${analysis.availableCount} / ${analysis.total}명 가능</span>`;
        } else {
            summaryPill = `<span style="font-size:0.75rem; color:#94a3b8;">가능자 없음</span>`;
        }

        // Action Column (Confirm Button)
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

    // Attach event listener to toggle availability buttons
    matrixContainer.querySelectorAll('.daily-cell-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const personId = btn.getAttribute('data-person-id');
            const dt = btn.getAttribute('data-datetime');
            toggleSlotAvailability(presenter.id, personId, dt);
            renderDailyDetail();
            updateHeaderAndBanner();
            showToast("일정이 즉시 반영되었습니다.");
        });
    });

    // Attach event listener to Confirm buttons
    matrixContainer.querySelectorAll('.btn-select-final').forEach(btn => {
        btn.addEventListener('click', () => {
            const d = btn.getAttribute('data-date');
            const t = btn.getAttribute('data-time');
            openConfirmModal(presenter, d, t);
        });
    });
}

/**
 * VIEW 4: PRESENTER & COMMITTEE MANAGEMENT RENDERER
 */
function renderManagementCards() {
    const grid = document.getElementById('presenterCardsGrid');
    grid.innerHTML = '';

    appState.presenters.forEach(p => {
        const reviewers = p.reviewers || [];
        const card = document.createElement('div');
        card.className = 'presenter-manage-card';

        let reviewersHtml = '';
        reviewers.forEach(r => {
            let roleClass = 'role-member';
            if (r.role.includes('위원장')) roleClass = 'role-chair';
            else if (r.role.includes('지도')) roleClass = 'role-advisor';

            reviewersHtml += `
                <li class="card-reviewer-item">
                    <span><span class="member-role-tag ${roleClass}">${r.role}</span> ${r.name}</span>
                    <span style="color:#64748b;">${r.affiliation || ''}</span>
                </li>
            `;
        });

        card.innerHTML = `
            <div>
                <div class="card-top-header">
                    <div>
                        <span class="degree-badge">${p.degree}</span>
                        <div class="card-student-name" style="margin-top:6px;">${p.name} 연구원</div>
                        <div style="font-size:0.8rem; color:#64748b;">${p.department}</div>
                    </div>
                    ${p.confirmedSchedule ? '<span class="status-badge confirmed">심사 확정</span>' : '<span class="status-badge">조율중</span>'}
                </div>
                <div class="card-thesis-title">${p.thesisTitle}</div>
                <div class="card-reviewers-box">
                    <div class="card-reviewers-title">심사위원단 (${reviewers.length}명)</div>
                    <ul class="card-reviewers-list">
                        ${reviewersHtml}
                    </ul>
                </div>
            </div>
            <div class="card-actions">
                <button class="btn btn-sm btn-outline btn-card-edit" data-id="${p.id}">정보 수정</button>
                <button class="btn btn-sm btn-outline btn-card-avail" data-id="${p.id}">일정표 열기</button>
                <button class="btn btn-sm btn-danger btn-card-delete" data-id="${p.id}" style="margin-left:auto;">삭제</button>
            </div>
        `;

        grid.appendChild(card);
    });

    // Edit handler
    grid.querySelectorAll('.btn-card-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const target = appState.presenters.find(p => p.id === id);
            if (target) openPresenterModal(target);
        });
    });

    // Delete handler
    grid.querySelectorAll('.btn-card-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (appState.presenters.length <= 1) {
                alert("최소 1명의 발표자는 등록되어 있어야 합니다.");
                return;
            }
            if (confirm("정말 이 발표자 및 심사 일정을 삭제하시겠습니까?")) {
                appState.presenters = appState.presenters.filter(p => p.id !== id);
                delete appState.availability[id];
                if (appState.currentPresenterId === id) {
                    appState.currentPresenterId = appState.presenters[0].id;
                }
                saveState();
                renderAll();
                showToast("발표자가 삭제되었습니다.");
            }
        });
    });

    // Direct open availability
    grid.querySelectorAll('.btn-card-avail').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            appState.currentPresenterId = id;
            openAvailabilityModal();
        });
    });
}

/**
 * VIEW 5: RECOMMENDATIONS & MATCHING ENGINE
 */
function renderRecommendations() {
    const presenter = getCurrentPresenter();
    const container = document.getElementById('recommendationsList');
    container.innerHTML = '';

    // Collect all slots where 100% participants are available
    const matchedSlots = [];

    // Scan all days of Nov and Dec 2026
    [11, 12].forEach(m => {
        const daysInMonth = new Date(2026, m, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            TIME_SLOTS.forEach(time => {
                const dt = `${dateStr} ${time}`;
                const analysis = analyzeSlot(presenter, dt);
                if (analysis.isAllMatch) {
                    matchedSlots.push({
                        dateStr,
                        time,
                        dateTimeStr: dt,
                        analysis
                    });
                }
            });
        }
    });

    if (matchedSlots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h4>아직 전원 가능한 일정이 없습니다.</h4>
                <p>발표자 또는 심사위원들의 가능한 시간대를 조금 더 추가 입력해주세요.</p>
                <button class="btn btn-primary" style="margin-top:14px;" onclick="document.getElementById('btnQuickInput').click()">
                    일정 추가 입력하기
                </button>
            </div>
        `;
        return;
    }

    matchedSlots.forEach((slot, index) => {
        const [y, m, d] = slot.dateStr.split('-');
        const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];
        const isConfirmed = presenter.confirmedSchedule &&
                            presenter.confirmedSchedule.date === slot.dateStr &&
                            presenter.confirmedSchedule.time === slot.time;

        const card = document.createElement('div');
        card.className = `recommendation-card is-golden ${isConfirmed ? 'is-confirmed' : ''}`;
        card.innerHTML = `
            <div class="rec-rank-badge">#${index + 1}</div>
            <div class="rec-info">
                <div class="rec-datetime">
                    ${y}년 ${m}월 ${d}일 (${dayName}) ${slot.time}
                    ${isConfirmed ? '<span class="status-badge confirmed" style="margin-left:8px;">현재 확정된 일정</span>' : ''}
                </div>
                <div class="rec-meta">
                    <span>✨ <strong>심사위원 전원(${slot.analysis.total}명) 참석 가능</strong></span>
                    <span>예상 소요시간: ${presenter.duration || 60}분</span>
                    <span>장소: ${presenter.location || '미정'}</span>
                </div>
            </div>
            <div class="rec-actions">
                <button class="btn btn-outline btn-sm btn-rec-jump" data-date="${slot.dateStr}">
                    일자별 상세 보기
                </button>
                <button class="btn btn-success btn-sm btn-rec-confirm" data-date="${slot.dateStr}" data-time="${slot.time}">
                    ${isConfirmed ? '확정 정보 변경' : '이 일정으로 확정'}
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    // Action handlers
    container.querySelectorAll('.btn-rec-jump').forEach(btn => {
        btn.addEventListener('click', () => {
            appState.currentDayDate = btn.getAttribute('data-date');
            switchView('day');
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
// 4. Modal Handlers & Dynamic Forms
// ==========================================================================

function openPresenterModal(presenterToEdit = null) {
    const modal = document.getElementById('modalPresenter');
    const title = document.getElementById('modalPresenterTitle');
    const list = document.getElementById('reviewersInputList');
    list.innerHTML = '';

    if (presenterToEdit) {
        title.textContent = '발표자 및 심사위원 정보 수정';
        document.getElementById('editPresenterId').value = presenterToEdit.id;
        document.getElementById('inputPresenterName').value = presenterToEdit.name;
        document.getElementById('inputDegree').value = presenterToEdit.degree;
        document.getElementById('inputDepartment').value = presenterToEdit.department;
        document.getElementById('inputThesisTitle').value = presenterToEdit.thesisTitle;
        document.getElementById('inputDuration').value = presenterToEdit.duration || 60;
        document.getElementById('inputLocation').value = presenterToEdit.location || '';

        (presenterToEdit.reviewers || []).forEach(r => {
            addReviewerRow(r.name, r.role, r.affiliation);
        });
    } else {
        title.textContent = '새 발표자 및 심사위원 등록';
        document.getElementById('editPresenterId').value = '';
        document.getElementById('inputPresenterName').value = '';
        document.getElementById('inputDegree').value = '석사';
        document.getElementById('inputDepartment').value = '';
        document.getElementById('inputThesisTitle').value = '';
        document.getElementById('inputDuration').value = '60';
        document.getElementById('inputLocation').value = '';

        // Default 3 committee rows
        addReviewerRow('', '심사위원장', '');
        addReviewerRow('', '지도교수', '');
        addReviewerRow('', '심사위원', '');
    }

    modal.classList.add('active');
}

function addReviewerRow(name = '', role = '심사위원', affiliation = '') {
    const list = document.getElementById('reviewersInputList');
    const row = document.createElement('div');
    row.className = 'reviewer-row-item';
    row.innerHTML = `
        <select class="form-control r-role">
            <option value="심사위원장" ${role === '심사위원장' ? 'selected' : ''}>심사위원장</option>
            <option value="지도교수" ${role === '지도교수' ? 'selected' : ''}>지도교수</option>
            <option value="심사위원" ${role === '심사위원' ? 'selected' : ''}>심사위원</option>
        </select>
        <input type="text" class="form-control r-name" placeholder="성함 (예: 홍길동 교수)" value="${name}" required>
        <input type="text" class="form-control r-affil" placeholder="소속 (예: 본교 AI학과)" value="${affiliation}">
        <button type="button" class="btn-remove-row" title="삭제">&times;</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        if (list.children.length <= 1) {
            alert('최소 1명 이상의 심사위원이 필요합니다.');
            return;
        }
        row.remove();
    });

    list.appendChild(row);
}

// Form Submit: Save Presenter
document.getElementById('formPresenter').addEventListener('submit', (e) => {
    e.preventDefault();

    const editId = document.getElementById('editPresenterId').value;
    const name = document.getElementById('inputPresenterName').value.trim();
    const degree = document.getElementById('inputDegree').value;
    const department = document.getElementById('inputDepartment').value.trim();
    const thesisTitle = document.getElementById('inputThesisTitle').value.trim();
    const duration = parseInt(document.getElementById('inputDuration').value, 10);
    const location = document.getElementById('inputLocation').value.trim();

    // Read reviewer rows
    const reviewerRows = document.querySelectorAll('#reviewersInputList .reviewer-row-item');
    const reviewers = [];
    reviewerRows.forEach((row, idx) => {
        const rRole = row.querySelector('.r-role').value;
        const rName = row.querySelector('.r-name').value.trim();
        const rAffil = row.querySelector('.r-affil').value.trim();
        if (rName) {
            reviewers.push({
                id: editId ? `r_${editId}_${idx + 1}` : `r_new_${Date.now()}_${idx + 1}`,
                name: rName,
                role: rRole,
                affiliation: rAffil
            });
        }
    });

    if (editId) {
        // Edit existing
        const p = appState.presenters.find(x => x.id === editId);
        if (p) {
            p.name = name;
            p.degree = degree;
            p.department = department;
            p.thesisTitle = thesisTitle;
            p.duration = duration;
            p.location = location;
            p.reviewers = reviewers;
        }
        showToast("발표자 정보가 수정되었습니다.");
    } else {
        // Add new
        const newId = `p_${Date.now()}`;
        // Re-key reviewer ids properly
        reviewers.forEach((r, idx) => {
            r.id = `r_${newId}_${idx + 1}`;
        });
        const newPresenter = {
            id: newId,
            name,
            degree,
            department,
            thesisTitle,
            duration,
            location,
            reviewers,
            confirmedSchedule: null
        };
        appState.presenters.push(newPresenter);
        appState.availability[newId] = {};
        appState.currentPresenterId = newId;
        showToast("새 발표자가 성공적으로 등록되었습니다.");
    }

    saveState();
    closeModal('modalPresenter');
    renderAll();
});

/**
 * MODAL 2: QUICK SCHEDULE AVAILABILITY ENTRY
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
    const month = appState.modalAvailMonth; // 11 or 12
    const tableContainer = document.getElementById('availTable');

    document.getElementById('modalChipNov').className = `btn-chip ${month === 11 ? 'active' : ''}`;
    document.getElementById('modalChipDec').className = `btn-chip ${month === 12 ? 'active' : ''}`;

    // Collect all weekdays (Mon-Fri) for this month
    const weekdays = [];
    const daysInMonth = new Date(2026, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(2026, month - 1, d);
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Weekdays only
            weekdays.push({
                dateStr: `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                dayName: ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek],
                dayNum: d
            });
        }
    }

    let tableHtml = `
        <table class="interactive-avail-table">
            <thead>
                <tr>
                    <th style="min-width: 70px;">시간</th>
    `;

    weekdays.forEach(w => {
        tableHtml += `
            <th style="min-width: 48px;">
                ${w.dayName}<br>${w.dayNum}일
            </th>
        `;
    });

    tableHtml += `</tr></thead><tbody>`;

    TIME_SLOTS.forEach(time => {
        tableHtml += `
            <tr>
                <td style="font-weight:700; background:#f8fafc;">${time}</td>
        `;

        weekdays.forEach(w => {
            const dt = `${w.dateStr} ${time}`;
            const isAvail = isSlotAvailable(presenter.id, personId, dt);
            tableHtml += `
                <td class="avail-check-cell ${isAvail ? 'selected' : ''}" 
                    data-datetime="${dt}" 
                    title="${dt}">
                </td>
            `;
        });

        tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;
    tableContainer.innerHTML = tableHtml;

    // Attach click and drag-to-select handlers
    let isMouseDown = false;
    let modeToSet = true; // true = add, false = remove

    tableContainer.querySelectorAll('.avail-check-cell').forEach(cell => {
        cell.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isMouseDown = true;
            const dt = cell.getAttribute('data-datetime');
            const currentSelected = cell.classList.contains('selected');
            modeToSet = !currentSelected;

            if (modeToSet) {
                cell.classList.add('selected');
            } else {
                cell.classList.remove('selected');
            }
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
            updateHeaderAndBanner();
        }
    }, { once: false });
}

/**
 * MODAL 3: CONFIRM FINAL DEFENSE SCHEDULE
 */
function openConfirmModal(presenter, dateStr, timeStr) {
    const modal = document.getElementById('modalConfirmDefense');
    const [y, m, d] = dateStr.split('-');
    const dayDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayDate.getDay()];

    document.getElementById('confirmModalPresenter').textContent = `${presenter.name} (${presenter.degree}과정)`;
    document.getElementById('confirmModalDateTime').textContent = `${y}년 ${m}월 ${d}일 (${dayName}) ${timeStr}`;
    document.getElementById('confirmModalDuration').textContent = `${presenter.duration || 60}분`;
    document.getElementById('confirmModalLocation').value = presenter.location || "공학관 401호";

    const btnCancel = document.getElementById('btnCancelConfirmation');
    if (presenter.confirmedSchedule) {
        btnCancel.style.display = 'inline-flex';
    } else {
        btnCancel.style.display = 'none';
    }

    // Save action
    const btnSave = document.getElementById('btnSaveConfirmation');
    btnSave.onclick = () => {
        presenter.confirmedSchedule = {
            date: dateStr,
            time: timeStr,
            duration: presenter.duration || 60,
            location: document.getElementById('confirmModalLocation').value.trim() || '미정'
        };
        saveState();
        closeModal('modalConfirmDefense');
        renderAll();
        showToast("학위논문 심사 일정이 최종 확정되었습니다! 🎉");
    };

    // Cancel confirmation action
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
 * MODAL 4: ANNOUNCEMENT COPY
 */
function openNoticeModal() {
    const presenter = getCurrentPresenter();
    const modal = document.getElementById('modalNotice');
    const textarea = document.getElementById('noticeTextarea');

    const confirmed = presenter.confirmedSchedule;
    const reviewers = presenter.reviewers || [];
    let reviewerListStr = reviewers.map(r => `  - ${r.role}: ${r.name} (${r.affiliation || '소속미정'})`).join('\n');

    let scheduleNotice = '';
    if (confirmed) {
        scheduleNotice = `
[심사 확정 일시 및 장소]
■ 일시: ${confirmed.date} (${confirmed.time} ~ ) [소요시간: 약 ${confirmed.duration}분]
■ 장소: ${confirmed.location}
`;
    } else {
        // Collect recommended golden slots
        const matched = [];
        [11, 12].forEach(m => {
            const daysInMonth = new Date(2026, m, 0).getDate();
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                TIME_SLOTS.forEach(time => {
                    if (analyzeSlot(presenter, `${dateStr} ${time}`).isAllMatch) {
                        matched.push(`${dateStr} ${time}`);
                    }
                });
            }
        });

        const topSlots = matched.slice(0, 3).map((s, idx) => `  ${idx + 1}. ${s}`).join('\n');

        scheduleNotice = `
[심사위원 전원 가능 추천 일시 (조율중)]
${topSlots || '  (현재 전원 가능한 시간을 취합 중입니다)'}
※ 최종 시간 확정 후 재공지 예정입니다.
`;
    }

    const noticeText = `[2026학년도 후기 학위청구논문 심사 일정 안내]

존경하는 심사위원장님 및 심사위원 교수님,

대학원 ${presenter.department} ${presenter.degree}학위 청구논문 발표 및 심사 일정을 아래와 같이 안내드립니다.

1. 발표자(수합대상자): ${presenter.name} (${presenter.degree}과정)
2. 학위논문 제목: ${presenter.thesisTitle}
3. 심사위원단 구성:
${reviewerListStr}

4. 심사 일정 안내:
${scheduleNotice}
감사합니다.

${presenter.department} 대학원 드림
일정 조율 사이트: https://minje9723.github.io/minshop/
`;

    textarea.value = noticeText;
    modal.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ==========================================================================
// 5. Toast & Event Listeners
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

function switchView(viewName) {
    appState.currentView = viewName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const periodNav = document.getElementById('periodNav');
    if (viewName === 'month') {
        periodNav.style.display = 'flex';
        document.getElementById('viewMonth').classList.add('active');
        renderMonthlyCalendar();
    } else if (viewName === 'week') {
        periodNav.style.display = 'none';
        document.getElementById('viewWeek').classList.add('active');
        renderWeeklyTimetable();
    } else if (viewName === 'day') {
        periodNav.style.display = 'none';
        document.getElementById('viewDay').classList.add('active');
        renderDailyDetail();
    } else if (viewName === 'manage') {
        periodNav.style.display = 'none';
        document.getElementById('viewManage').classList.add('active');
        renderManagementCards();
    } else if (viewName === 'recommend') {
        periodNav.style.display = 'none';
        document.getElementById('viewRecommend').classList.add('active');
        renderRecommendations();
    }
}

function renderAll() {
    updateHeaderAndBanner();
    switchView(appState.currentView);
}

// Global Event Wire-up
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderAll();

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.getAttribute('data-view'));
        });
    });

    // Presenter selector
    document.getElementById('currentPresenterSelect').addEventListener('change', (e) => {
        appState.currentPresenterId = e.target.value;
        appState.modalAvailTargetPersonId = null;
        renderAll();
    });

    // Month Navigation in Monthly View
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

    // Week selector
    document.getElementById('weekSelect').addEventListener('change', (e) => {
        appState.currentWeekIndex = parseInt(e.target.value, 10);
        renderWeeklyTimetable();
    });
    document.getElementById('chkOnlyWeekdays').addEventListener('change', () => {
        renderWeeklyTimetable();
    });

    // Day View Navigation
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

    // Day Header Confirm Button
    document.getElementById('btnConfirmSlot').addEventListener('click', () => {
        const presenter = getCurrentPresenter();
        openConfirmModal(presenter, appState.currentDayDate, "14:00");
    });

    // Header Action Buttons
    document.getElementById('btnNewPresenter').addEventListener('click', () => {
        openPresenterModal(null);
    });
    document.getElementById('btnAddNewPresenterTab').addEventListener('click', () => {
        openPresenterModal(null);
    });
    document.getElementById('btnQuickInput').addEventListener('click', () => {
        openAvailabilityModal();
    });
    document.getElementById('btnAddReviewerRow').addEventListener('click', () => {
        addReviewerRow();
    });
    document.getElementById('btnResetSample').addEventListener('click', () => {
        if (confirm("예시 데이터로 초기화하시겠습니까? (입력하신 데이터가 기본값으로 대체됩니다)")) {
            resetToSampleData();
            renderAll();
        }
    });

    // Announcement Modal
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

    // Modal Availability Controls
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
        updateHeaderAndBanner();
        showToast("전체 시간이 가능으로 설정되었습니다.");
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
        updateHeaderAndBanner();
        showToast("해당 월의 선택이 초기화되었습니다.");
    });

    // Modal Backdrop Close Handlers
    document.querySelectorAll('.modal-close, [data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetModalId = btn.getAttribute('data-close') || btn.closest('.modal-backdrop').id;
            closeModal(targetModalId);
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.remove('active');
            }
        });
    });
});
