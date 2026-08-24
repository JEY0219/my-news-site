/* ---------------------------------------------------------
   다른 지역 관점 비교 - 예시 데이터 (1단계 데모용)
   - 이슈별로 "내 지역 보도 / 다른 지역 보도 / 전국 단위 보도" 관점에서
     주요 피해자, 책임 주체, 주요 감정, 해결책이 어떻게 다르게
     구성되는지 정리한 예시 데이터다.
   - 수도권·비수도권 불균형 이슈는 기획서 4.7의 예시 표를 그대로 사용했다.
--------------------------------------------------------- */

const REGION_COMPARE_DATA = {
  "gwangju-518": {
    myRegion: {
      tabLabel: "내 지역 보도",
      caption: "광주 지역 언론 보도 기준",
      victim: "5·18 희생자와 유가족",
      responsible: "국가폭력과 역사 왜곡 발언자",
      emotion: "분노와 불안",
      solution: "진상규명과 처벌",
    },
    otherRegion: {
      tabLabel: "다른 지역 보도",
      caption: "광주 이외 지역 언론 보도 기준",
      victim: "지역 주민 또는 시민 일반",
      responsible: "역사 왜곡 발언자 또는 정치권",
      emotion: "소외와 논쟁",
      solution: "역사교육 강화",
    },
    national: {
      tabLabel: "전국 단위 보도",
      caption: "전국 단위 언론 보도 기준",
      victim: "전체 시민",
      responsible: "중앙정부의 소극적 대응",
      emotion: "연대",
      solution: "제도 개선과 역사교육",
    },
  },

  "daegu-gyeongbuk": {
    myRegion: {
      tabLabel: "내 지역 보도",
      caption: "대구·경북 지역 언론 보도 기준",
      victim: "지역 주민과 지역 청년",
      responsible: "수도권 집중 구조",
      emotion: "자부심과 소외",
      solution: "균형발전과 산업 지원",
    },
    otherRegion: {
      tabLabel: "다른 지역 보도",
      caption: "대구·경북 이외 지역 언론 보도 기준",
      victim: "지역 유권자",
      responsible: "지역 정치권 또는 산업 구조",
      emotion: "갈등",
      solution: "제도 개선",
    },
    national: {
      tabLabel: "전국 단위 보도",
      caption: "전국 단위 언론 보도 기준",
      victim: "지역 청년 전반",
      responsible: "수도권 집중 구조",
      emotion: "위기",
      solution: "산업 지원과 청년 일자리 정책",
    },
  },

  "capital-imbalance": {
    myRegion: {
      tabLabel: "내 지역 보도",
      caption: "비수도권 지역 언론 보도 기준",
      victim: "지역 청년",
      responsible: "중앙정부",
      emotion: "소외와 불안",
      solution: "균형발전",
    },
    otherRegion: {
      tabLabel: "다른 지역 보도",
      caption: "수도권 지역 언론 보도 기준",
      victim: "수도권 청년 또는 지역 주민",
      responsible: "지역 정부 또는 산업 구조",
      emotion: "부담과 갈등",
      solution: "주거와 교통 개선",
    },
    national: {
      tabLabel: "전국 단위 보도",
      caption: "전국 단위 언론 보도 기준",
      victim: "전체 청년층",
      responsible: "수도권 집중 구조",
      emotion: "위기",
      solution: "국가 단위 분산 정책",
    },
  },
};
