/**
 * Representative photos for a society's amenities, until a MovEazy partner
 * uploads real ones taken there (2026-11-17). Freely licensed photos from
 * Wikimedia Commons, hosted with the site (public/amenities), always shown as
 * "Representative image" with their author and licence.
 */
const W = "https://commons.wikimedia.org/wiki/File:";

const PHOTOS = [
  { id: "pool", re: /pool/i, by: "Vic Brincat", license: "CC BY 2.0", page: `${W}Backyardpool.jpg` },
  { id: "gym", re: /\bgym|fitness/i, by: "Tomwsulcer", license: "CC0", page: `${W}Berkeley_Heights_NJ_exercise_room.jpg` },
  { id: "club", re: /club|lounge/i, by: "Jeremy Keith", license: "CC BY 2.0", page: `${W}Virgin_lounge,_Heathrow.jpg` },
  { id: "kids", re: /kid|child|play ?(area|ground)|tot|creche/i, by: "nubobo", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:%E3%83%A1%E3%82%AB%E3%83%AD%E3%83%9C%E3%83%83%E3%83%88%E3%82%B3%E3%83%B3%E3%83%93%E3%83%8D%E3%83%BC%E3%82%B7%E3%83%A7%E3%83%B3_(3885704412).jpg" },
  { id: "walk", re: /jog|walk|track|trail|cycl/i, by: "Wing1990hk", license: "CC BY 3.0", page: `${W}Tuen_Mun_Park_Jogging_Trail_2012.jpg` },
  { id: "garden", re: /garden|landscap|lawn|green|park\b|terrace/i, by: "Apzhe2chow", license: "CC BY-SA 3.0", page: "https://commons.wikimedia.org/wiki/File:HK_Ap_Lei_Chau_Wind_Tower_Park_%E9%B4%A8%E8%84%B7%E6%B4%B2%E9%A2%A8%E4%B9%8B%E8%B0%B7%E5%85%AC%E5%9C%92_visitors_%E7%B7%A9%E8%B7%91%E5%BE%91_Jogging_track_April-2012.JPG" },
  { id: "tennis", re: /tennis/i, by: "Johann Jaritz", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:P%C3%B6rtschach_Johannes-Brahms-Promenade_Werzer-Tennis-Arena_27052017_8932.jpg" },
  { id: "badminton", re: /badminton|squash|indoor (games|sports)/i, by: "Alanands3", license: "CC BY-SA 4.0", page: `${W}Indoor_badminton_court.jpg` },
  { id: "tt", re: /table tennis|ping ?pong|\btt\b|indoor game|games room/i, by: "Ltopzo", license: "CC BY-SA 3.0", page: `${W}HK_Wan_Chai_Lockhart_Road_Municipal_Services_Building_Table_Tennis_Room_2.JPG` },
  { id: "basketball", re: /basketball|court|cricket|football|multi-?purpose/i, by: "Editor5807", license: "CC BY 3.0", page: `${W}Sandown_outdoor_gym_basketball_court.JPG` },
  { id: "yoga", re: /yoga|meditat|aerobic|zen/i, by: "Vahagn", license: "CC BY-SA 3.0", page: `${W}Outdoor_yoga_class_in_Vaduz_Liechtenstein_Himalayan_Yoga_Center.JPG` },
  { id: "hall", re: /hall|party|banquet|community|multipurpose|event/i, by: "Los Angeles", license: "CC BY-SA 3.0", page: `${W}Highland_Park_Masonic_Temple,_Banquet_Hall.jpg` },
  { id: "parking", re: /parking|car park/i, by: "玄史生", license: "CC0", page: `${W}Private_Basement_Car_Park_of_New_Silicon_Valley_Commercial_Building_20140817.jpg` },
  { id: "lift", re: /lift|elevator/i, by: "N509FZ", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:North_lift_lobby_of_Beijing_Chaoyang_Railway_Station_(20210126145900).jpg" },
  { id: "power", re: /power|back-?up|generator|\bdg\b/i, by: "Gregsedits", license: "CC BY-SA 3.0", page: `${W}Caterpillar_(Olympian)_Generator_Set.jpg` },
];

const withUrl = (p) => ({ ...p, url: `/amenities/${p.id}.jpg` });

/** A society's cover until it has a real photo. */
export const COVER_PHOTO = withUrl({ id: "cover", by: "Nikhilb239", license: "CC BY 3.0", page: `${W}Residential_Building,_Hyderabad,_20022015.jpg` });

/** A society's representative cover, varied by its code so a list doesn't repeat one photo. */
export function coverFor(code = "") {
  const pool = [COVER_PHOTO, ...["pool", "garden", "walk", "club"].map((id) => withUrl(PHOTOS.find((p) => p.id === id)))];
  let h = 0;
  for (const ch of String(code)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/** The representative photo for an amenity's name, or null (e.g. "24×7 security"). */
export function amenityPhoto(name) {
  const p = PHOTOS.find((x) => x.re.test(String(name || "")));
  return p ? withUrl(p) : null;
}

/** "Photo: Vic Brincat, CC BY 2.0" */
export const photoCredit = (p) => (p ? `Representative image · ${p.by}, ${p.license}` : "");
