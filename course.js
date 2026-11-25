/* 코스 설정: 트랙과 장. 레슨의 ch 는 아래 chapters 의 순번(0부터) */
window.COURSE = {
  id: "iyagi", title: "이야기의 문법",
  tracks: { story: { name: "이야기 설계", short: "이야기", icon: '<path d="M4 4.5h11a3 3 0 0 1 3 3V20H7a3 3 0 0 1-3-3z"/><path d="M18 20a2 2 0 0 0 2-2V7M8 9h6M8 13h5"/>' } },
  chapters: [
    ["이야기의 엔진", "story"], ["인물", "story"], ["구조", "story"], ["장면과 완급", "story"],
    ["시점과 서술", "story"], ["정보 설계", "story"], ["세계와 관계", "story"], ["장편과 연재", "story"],
  ],
  level: (ch) => (ch.no <= 4 ? "기초" : ch.no <= 6 ? "중급" : "고급"),
};
