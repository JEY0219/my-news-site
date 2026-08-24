/* ---------------------------------------------------------
   사전 / 사후 설문 문항 데이터
   - 기획서 9장(사전 설문지), 11장(사후 설문지) 문항을 그대로 옮겼다.
--------------------------------------------------------- */

const SCALE_AGREE = ["전혀 그렇지 않다", "그렇지 않다", "보통이다", "그렇다", "매우 그렇다"];

const SURVEY_SCHEMAS = {
  pre: [
    {
      id: "pre_1",
      type: "text",
      label: "익명 참여 번호를 입력해 주세요",
      helper: "사전 설문과 사후 설문을 연결하기 위한 번호입니다. 본인이 기억할 수 있는 숫자 네 자리를 입력해 주세요.",
      placeholder: "예: 1234",
      numeric4: true,
    },
    {
      id: "pre_2",
      type: "choice",
      label: "학년을 선택해 주세요",
      options: ["고등학교 1학년", "고등학교 2학년", "고등학교 3학년", "기타"],
    },
    {
      id: "pre_3",
      type: "choice",
      label: "평소 사회문제나 정책 관련 뉴스를 얼마나 자주 확인합니까",
      options: ["전혀 확인하지 않는다", "한 달에 한두 번 확인한다", "일주일에 한두 번 확인한다", "일주일에 세 번 이상 확인한다", "거의 매일 확인한다"],
    },
    {
      id: "pre_4",
      type: "choice",
      label: "현재 거주 지역에서 논의되는 주요 사회문제나 정책 이슈를 알고 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_5",
      type: "choice",
      label: "현재 거주 지역의 중요한 정책 문제를 한 가지 이상 설명할 수 있습니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_6",
      type: "choice",
      label: "다른 지역에서 논의되는 주요 사회문제나 정책 이슈를 알고 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_7",
      type: "choice",
      label: "뉴스를 읽을 때 같은 사건을 다룬 여러 언론사의 기사를 비교하는 편입니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_8",
      type: "choice",
      label: "기사 제목을 먼저 본 뒤 본문을 읽기 전부터 사건에 대한 판단이 형성되는 경우가 있습니까",
      options: ["전혀 없다", "거의 없다", "보통이다", "자주 있다", "매우 자주 있다"],
    },
    {
      id: "pre_9",
      type: "choice",
      label: "뉴스 기사에서 누구를 피해자로 제시하는지 구분할 수 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_10",
      type: "choice",
      label: "뉴스 기사에서 문제의 책임이 누구에게 부여되는지 구분할 수 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_11",
      type: "choice",
      label: "뉴스 기사에서 제시한 해결책과 기자의 문제 해석을 구분할 수 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_12",
      type: "choice",
      label: "같은 사건도 언론사나 지역에 따라 다르게 설명될 수 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_13",
      type: "choice",
      label: "특정 지역에 대한 이미지가 그 지역의 정책 문제를 판단하는 데 영향을 줄 수 있다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_14",
      type: "choice",
      label: "지역 이슈를 접할 때 다른 지역 주민의 관점도 함께 확인하는 편입니까",
      options: SCALE_AGREE,
    },
    {
      id: "pre_15",
      type: "choice",
      label: "지역 이슈 관련 기사를 읽을 때 가장 먼저 확인하는 요소는 무엇입니까",
      options: ["기사 제목", "언론사", "작성 날짜", "기사에 제시된 피해 사례", "문제의 원인", "제시된 해결책", "댓글 반응", "기타"],
    },
    {
      id: "pre_16",
      type: "textarea",
      label: "현재 자신이 알고 있는 지역 이슈를 한 가지 작성해 주세요",
    },
    {
      id: "pre_17",
      type: "textarea",
      label: "해당 이슈의 원인이나 책임 주체가 누구라고 생각하는지 작성해 주세요",
    },
    {
      id: "pre_18",
      type: "textarea",
      label: "해당 이슈를 해결하기 위해 필요한 정책을 작성해 주세요",
    },
  ],

  post: [
    {
      id: "post_1",
      type: "text",
      label: "익명 참여 번호를 입력해 주세요",
      helper: "사전 설문에서 사용한 익명 참여 번호와 같은 번호를 입력해 주세요.",
      placeholder: "예: 1234",
      numeric4: true,
    },
    {
      id: "post_2",
      type: "choice",
      label: "웹페이지를 이용한 뒤 선택한 지역 이슈를 이전보다 잘 이해하게 되었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_3",
      type: "choice",
      label: "같은 이슈를 다룬 여러 언론사의 기사를 비교하는 것이 문제를 이해하는 데 도움이 되었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_4",
      type: "choice",
      label: "기사마다 피해자로 제시하는 대상이 다를 수 있다는 점을 확인할 수 있었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_5",
      type: "choice",
      label: "기사마다 문제의 책임을 서로 다른 주체에게 부여할 수 있다는 점을 확인할 수 있었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_6",
      type: "choice",
      label: "기사마다 서로 다른 해결책을 강조할 수 있다는 점을 확인할 수 있었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_7",
      type: "choice",
      label: "정책서사 분석 카드가 기사의 관점을 파악하는 데 도움이 되었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_8",
      type: "choice",
      label: "내 지역 기사와 다른 지역 기사를 비교하는 기능이 지역 이슈를 이해하는 데 도움이 되었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_9",
      type: "choice",
      label: "다른 지역의 기사를 본 뒤 해당 지역에 대한 기존 이미지나 판단을 다시 생각하게 되었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_10",
      type: "choice",
      label: "웹페이지 이용 후 하나의 기사만 읽고 사건을 판단하는 데 주의해야겠다고 생각했습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_11",
      type: "choice",
      label: "앞으로 지역 이슈를 접할 때 여러 언론사의 기사를 비교할 의향이 있습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_12",
      type: "choice",
      label: "앞으로 지역 이슈를 접할 때 다른 지역의 관점도 확인할 의향이 있습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_13",
      type: "choice",
      label: "기사 배열이 인기순이나 추천순이 아닌 시간순이라는 점이 기사 비교에 도움이 되었습니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_14",
      type: "choice",
      label: "가장 도움이 된 기능을 선택해 주세요",
      options: ["GPS 기반 지역 설정", "지역 공공정보 접근성 제공", "시간순 기사 배열", "복수 언론사 기사 비교", "정책서사 분석 카드", "다른 지역 관점 비교", "감정 자가 점검", "기타"],
    },
    {
      id: "post_15",
      type: "choice",
      label: "사용하기 어렵거나 이해하기 어려웠던 기능을 선택해 주세요",
      options: ["GPS 기반 지역 설정", "지역 공공정보 접근성 제공", "시간순 기사 배열", "복수 언론사 기사 비교", "정책서사 모형 카드", "다른 지역 관점 비교", "감정 자가 점검", "어려운 기능이 없었다", "기타"],
    },
    {
      id: "post_16",
      type: "choice",
      label: "웹페이지를 학교 수업이나 자율활동에서 활용하는 것이 적절하다고 생각합니까",
      options: SCALE_AGREE,
    },
    {
      id: "post_17",
      type: "textarea",
      label: "웹페이지 이용 후 선택한 지역 이슈의 피해자가 누구라고 생각하는지 작성해 주세요",
    },
    {
      id: "post_18",
      type: "textarea",
      label: "해당 이슈의 책임 주체가 누구라고 생각하는지 작성해 주세요",
    },
    {
      id: "post_19",
      type: "textarea",
      label: "해당 이슈를 해결하기 위해 가장 필요한 정책을 작성해 주세요",
    },
    {
      id: "post_20",
      type: "textarea",
      label: "웹페이지에 추가되었으면 하는 기능이나 개선할 점을 자유롭게 작성해 주세요",
    },
  ],
};
