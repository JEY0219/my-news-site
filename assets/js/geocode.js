/* ---------------------------------------------------------
   위도/경도 -> 시/군/구 변환 (브라우저에서 직접, 서버를 거치지 않음)

   - OpenStreetMap Nominatim(무료, API 키 불필요)으로 역지오코딩한다.
     region-select.html이 이미 방문자에게 "정확한 위도와 경도는 저장하지
     않으며 위치 확인이 완료된 뒤 즉시 삭제합니다 / 서버에는 시도와
     시군구 정보만 전달됩니다"라고 안내하고 있어서, 좌표 원본이 우리
     서버(server.js)에 닿을 일이 아예 없도록 이 변환도 브라우저 ->
     Nominatim 사이에서만 오가게 했다. 변환 결과(시/도, 시/군/구)만
     region-select.js가 setSelectedRegion()으로 저장한다.

   한계
   - Nominatim 사용 정책은 식별 가능한 User-Agent를 권장하지만, 브라우저
     fetch는 User-Agent를 커스텀으로 지정할 수 없다(브라우저가 항상
     실제 UA로 덮어씀). 사용자가 버튼을 누를 때 1회만 호출되는 저빈도
     요청이라는 점으로 감안했다.
   - OSM의 한국 행정구역 태깅이 항상 깔끔하지는 않아서, 시/도는 안정적인
     ISO 3166-2:KR 코드로 먼저 판별하고, 시/군/구는 REGIONS 목록과 대조
     검증한다. 둘 다 확실히 맞아떨어질 때만 성공으로 보고, 애매하면
     추측하지 않고 null을 반환해 호출 쪽이 "직접 선택" 화면으로 보내게
     한다 - 틀린 시/군/구를 자동으로 골라주는 것(예전의 "목록 첫 항목"
     방식)보다는 실패를 인정하는 쪽이 낫다고 판단했다.
--------------------------------------------------------- */

const ISO_KR_TO_SIDO = {
  "KR-11": "서울특별시",
  "KR-26": "부산광역시",
  "KR-27": "대구광역시",
  "KR-28": "인천광역시",
  "KR-29": "광주광역시",
  "KR-30": "대전광역시",
  "KR-31": "울산광역시",
  "KR-36": "세종특별자치시",
  "KR-41": "경기도",
  "KR-42": "강원특별자치도",
  "KR-43": "충청북도",
  "KR-44": "충청남도",
  "KR-45": "전북특별자치도",
  "KR-46": "전라남도",
  "KR-47": "경상북도",
  "KR-48": "경상남도",
  "KR-49": "제주특별자치도",
};

const METRO_SIDOS = new Set([
  "서울특별시", "부산광역시", "대구광역시", "인천광역시",
  "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
]);

/* OSM이 준 이름이 REGIONS 표기와 토씨까지 똑같지 않을 수 있어 부분
   일치까지 시도한다. 그래도 없으면 null - 억지로 아무거나 고르지 않는다. */
function findSigunguMatch(sido, candidate) {
  if (!candidate) return null;
  const list = getSigunguList(sido);
  if (list.includes(candidate)) return candidate;
  return list.find((item) => candidate.includes(item) || item.includes(candidate)) || null;
}

/**
 * @returns {Promise<{sido:string, sigungu:string}|null>} 시/도와 시/군/구를
 *   모두 확실히 판별했을 때만 값을 반환하고, 그 외에는 null(호출 쪽에서
 *   "위치 정보를 가져올 수 없습니다" 처리).
 */
async function reverseGeocodeToRegion(lat, lng) {
  let data;
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lng)}&zoom=14&addressdetails=1&accept-language=ko`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error("역지오코딩 요청 실패:", err);
    return null;
  }

  const address = data && data.address;
  if (!address) return null;

  let sido = ISO_KR_TO_SIDO[address["ISO3166-2-lvl4"]] || null;
  if (!sido) {
    // ISO 코드가 없는 드문 경우, 텍스트 필드로 한 번 더 시도.
    const candidates = [address.state, address.province, address.city].filter(Boolean);
    sido = candidates.find((c) => Object.prototype.hasOwnProperty.call(REGIONS, c)) || null;
  }
  if (!sido) return null;

  let sigungu = null;
  if (sido === "세종특별자치시") {
    sigungu = "세종시"; // REGIONS에 이 값 하나뿐
  } else if (METRO_SIDOS.has(sido)) {
    sigungu = findSigunguMatch(sido, address.borough || address.suburb || address.city_district);
  } else {
    sigungu = findSigunguMatch(sido, address.city || address.county || address.town);
  }

  if (!sigungu) return null;
  return { sido, sigungu };
}
