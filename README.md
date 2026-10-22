# minshop

2026 학위논문 발표 일정 조율 페이지 (GitHub Pages로 운영)

## 실시간 공유 저장 (Firebase Firestore)

`firebase-config.js`에 Firebase 설정을 넣으면 발표자·교수님 일정 데이터가 Firestore에 저장되고,
페이지를 연 모든 사람에게 실시간으로 반영됩니다. 설정이 없으면(`null`) 각 브라우저에만 저장됩니다.
화면 왼쪽 위 제목 아래에 현재 저장 방식이 표시됩니다.

### 최초 설정

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만듭니다.
2. 프로젝트 개요 > 웹 앱 추가(`</>`)로 앱을 등록하고, 표시되는 `firebaseConfig` 값을
   `firebase-config.js`의 `window.FIREBASE_CONFIG`에 넣습니다.
3. 빌드 > Firestore Database > 데이터베이스 만들기 (위치: `asia-northeast3` 서울, 프로덕션 모드).
4. Firestore > 규칙 탭에 `firestore.rules` 내용을 붙여넣고 게시합니다.
5. 커밋·푸시하면 GitHub Pages에 반영됩니다. 처음 접속한 사람이 기본(샘플) 데이터를 Firestore에 채웁니다.

### 데이터 구조

- `presenters/{발표자 id}`: 발표자 정보, 심사위원단, 확정 일정
- `profAvailability/{교수님 이름}`: `{ slots: ["2026-11-27 14:00", ...] }`

### 배포 시 버전 표시

`index.html`은 `style.css`, `firebase-config.js`, `script.js`를 `?v=20261021.1`처럼 버전을 붙여 불러옵니다.
세 파일 중 하나라도 고쳐서 배포할 때는 `index.html`의 `?v=` 값 세 곳을 모두 같은 새 값으로 바꿔 주세요
(예: 같은 날 두 번째 배포면 `20261021.2`, 다음 날이면 `20261022.1`).
그래야 방문자 브라우저에 남아 있는 예전 파일과 새 파일이 섞이지 않습니다.

### 참고

- 링크를 아는 누구나 수정할 수 있습니다. 보안 규칙은 정해진 데이터 형식만 허용하고 삭제를 막습니다.
- 심사위원(교수님) 기본 명단은 `script.js`의 `BASE_PROFESSORS` 한 곳에서 관리합니다. 화면의 교수님 버튼·선택 목록은 이 명단에
  발표자가 직접 입력한 심사위원을 더해 자동으로 만들어집니다. 명단에서 뺀 교수님도 누군가의 심사위원단에 남아 있으면 계속 보입니다.
  이미 쓰던 교수님 이름을 바꾸면 Firestore의 기존 가능 일정과 심사위원 지정 내용도 새 이름으로 옮겨야 합니다.
- 데이터를 처음 상태로 되돌리려면 Firebase 콘솔에서 두 컬렉션을 삭제한 뒤 페이지를 다시 엽니다.
