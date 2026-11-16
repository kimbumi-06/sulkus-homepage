import os, re, csv, json, time, html, dotenv
import requests
import xml.etree.ElementTree as ET


dotenv.load_dotenv(r'C:\sulkus\.env')

BGG_TOKEN = os.environ.get("BGG_TOKEN")
BGGNAME = os.environ.get("BGGNAME")
BASE = "https://boardgamegeek.com/xmlapi2"
CHUNK = 10          # thing 호출당 게임 수 (최대 20)
SLEEP = 2.5         # 호출 간 대기(초)
KO_FILE = "names_translation.json"   # {"BGG ID": "한글명"} 수동 매핑

HEADERS = {
    "Authorization": f"Bearer {BGG_TOKEN}",
    "User-Agent": "Mozilla/5.0 (boardgame-club-sync)",
    "Accept": "application/xml",
}

# (JSON 키, CSV 헤더)
COLUMNS = [
    ("name_ko", "게임명(한국)"), ("id", "BGG ID"), ("name_en", "게임명(영문)"),
    ("rank", "긱 순위"), ("rating", "긱 평점"), ("mechanics", "메커니즘"),
    ("categories", "장르"), ("weight", "난이도"),
    ("min_players", "최소인원"), ("max_players", "최대인원"),
    ("min_time", "최소 플탐"), ("max_time", "최대 플탐"),
    ("has_expansion", "확장"), ("description", "설명"), ("image", "이미지"),
]


def fetch_xml(path, params, retries=8):
    for _ in range(retries):
        r = requests.get(f"{BASE}/{path}", params=params, headers=HEADERS, timeout=30)
        if r.status_code == 202:        # 컬렉션 생성 대기 중
            time.sleep(10)
            continue
        if r.status_code == 429:        # 요청 과다
            time.sleep(15)
            continue
        r.raise_for_status()
        return ET.fromstring(r.content)
    raise RuntimeError(f"{path} 요청 실패(재시도 초과)")


def get_collection_ids():
    root = fetch_xml("collection", {"username": BGGNAME, "showprivate":1, "version": 2})
    return [i.get("objectid") for i in root.findall("item")]


def attr(el, path, name="value", default=""):
    node = el.find(path)
    return node.get(name, default) if node is not None else default


def fmt(x, digits):
    try:
        return f"{float(x):.{digits}f}"
    except (TypeError, ValueError):
        return ""


def parse_item(it, ko_map):
    gid = it.get("id")
    names = it.findall("name")
    name_en = next((n.get("value") for n in names if n.get("type") == "primary"), "")
    # 수동 매핑 우선, 없으면 alternate 이름 중 한글 포함된 것
    name_ko = ko_map.get(gid) or next(
        (n.get("value") for n in names if re.search("[가-힣]", n.get("value", ""))), "")

    rank = attr(it, "statistics/ratings/ranks/rank[@name='boardgame']")
    if not rank or rank == "Not Ranked":
        rank = "N/A"

    links = it.findall("link")
    pick = lambda t: ", ".join(l.get("value") for l in links if l.get("type") == t)

    desc = html.unescape(it.findtext("description") or "")
    desc = re.sub(r"<[^>]+>", "", desc).strip()

    thumb = it.findtext("thumbnail") or ""
    image = it.findtext("image") or it.findtext("thumbnail") or ""
    
    return {
        "name_ko": name_ko,
        "id": gid,
        "name_en": name_en,
        "rank": rank,
        "rating": fmt(attr(it, "statistics/ratings/average"), 1),
        "mechanics": pick("boardgamemechanic"),
        "categories": pick("boardgamecategory"),
        "weight": fmt(attr(it, "statistics/ratings/averageweight"), 2),
        "min_players": attr(it, "minplayers"),
        "max_players": attr(it, "maxplayers"),
        "min_time": attr(it, "minplaytime"),
        "max_time": attr(it, "maxplaytime"),
        "has_expansion": "Yes" if any(l.get("type") == "boardgameexpansion" for l in links) else "No",
        "description": desc,
        "image": image,
    }


def main():
    ko_map = {}
    if os.path.exists(KO_FILE):
        ko_map = json.load(open(KO_FILE, encoding="utf-8"))

    ids = get_collection_ids()
    print(f"찾은 게임 개수: {len(ids)}")
    if not ids:
        print("컬렉션이 비었습니다. 유저네임/공개 설정을 확인하세요.")
        return

    games = {}
    for n in range(0, len(ids), CHUNK):
        chunk = ids[n:n + CHUNK]
        try:
            root = fetch_xml("thing", {"id": ",".join(chunk), "stats": 1})
            for it in root.findall("item"):
                games[it.get("id")] = parse_item(it, ko_map)
            print(f"{n + 1}~{n + len(chunk)} 완료")
        except Exception as e:
            print(f"{n + 1}~{n + len(chunk)} 실패: {e}")
        time.sleep(SLEEP)

    # 컬렉션 순서 유지, 못 받은 건 '데이터 없음'
    rows = [games.get(i) or {"id": i, "name_en": "데이터 없음"} for i in ids]

    with open("games.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    with open("games.csv", "w", encoding="utf-8-sig", newline="") as f:   # 엑셀 한글 깨짐 방지
        w = csv.writer(f)
        w.writerow([h for _, h in COLUMNS])
        for r in rows:
            w.writerow([r.get(k, "") for k, _ in COLUMNS])
    print("전체 작업 종료")


if __name__ == "__main__":
    main()