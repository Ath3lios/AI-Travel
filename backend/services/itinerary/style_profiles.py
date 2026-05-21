import unicodedata


STYLE_PROFILES = {
    "bien": {
        "label": "Biển",
        "canonical": "beach",
        "summary": "ưu tiên biển, đảo, sunset, hoạt động ven biển và nhịp đi thư thả",
        "guidance": [
            "Ưu tiên bãi biển đẹp, đảo, cung đường ven biển, viewpoint ngắm hoàng hôn.",
            "Có thể thêm hoạt động như tắm biển, dạo biển sáng sớm, cafe/view biển, hải sản.",
            "Giữ nhịp lịch trình thoáng hơn vào buổi chiều tối để tận dụng cảnh biển và thời tiết đẹp.",
        ],
    },
    "nui rung": {
        "label": "Núi rừng",
        "canonical": "mountain_nature",
        "summary": "ưu tiên cảnh quan tự nhiên, đồi núi, rừng, điểm ngắm cảnh và trải nghiệm ngoài trời",
        "guidance": [
            "Ưu tiên núi, rừng, thác, hồ, đèo, điểm trekking nhẹ và viewpoint.",
            "Sắp xếp thời gian đẹp nhất vào sáng sớm hoặc chiều muộn để tránh nắng gắt và sương mù xấu.",
            "Nếu có cung đường xa, giảm bớt điểm check-in dày đặc để giữ sức và tối ưu di chuyển.",
        ],
    },
    "am thuc": {
        "label": "Ẩm thực",
        "canonical": "food",
        "summary": "ưu tiên món đặc sản, quán địa phương, food crawl và trải nghiệm ăn uống có bản sắc",
        "guidance": [
            "Ưu tiên đặc sản địa phương, quán ăn lâu năm, chợ ẩm thực, cafe signature và món phải thử.",
            "Không chỉ ghi chung chung là ăn uống; hãy nêu món phù hợp từng bữa và bối cảnh trải nghiệm.",
            "Có thể tăng trọng số cho hoạt động buổi tối liên quan ẩm thực, chợ đêm hoặc phố ăn uống.",
        ],
    },
    "check-in": {
        "label": "Check-in",
        "canonical": "checkin",
        "summary": "ưu tiên landmark, background đẹp, điểm chụp ảnh nổi bật và lịch trình có tính thị giác cao",
        "guidance": [
            "Ưu tiên điểm có ảnh đẹp, kiến trúc nổi bật, landmark nổi tiếng, quán cafe decor tốt.",
            "Chọn khung giờ ánh sáng đẹp cho các điểm chụp ảnh quan trọng.",
            "Mỗi ngày nên có ít nhất 1-2 điểm thật sự nổi bật về mặt hình ảnh.",
        ],
    },
    "van hoa": {
        "label": "Văn hóa",
        "canonical": "culture",
        "summary": "ưu tiên làng nghề, kiến trúc bản địa, bảo tàng, chùa chiền và trải nghiệm văn hóa địa phương",
        "guidance": [
            "Ưu tiên hoạt động giúp hiểu đời sống địa phương, văn hóa bản địa, kiến trúc và tín ngưỡng.",
            "Nếu có thể, kết hợp điểm tham quan với câu chuyện văn hóa hoặc lịch sử cụ thể.",
            "Tránh để lịch trình toàn quán ăn/cafe nếu người dùng đã chọn thiên về văn hóa.",
        ],
    },
    "lich su": {
        "label": "Lịch sử",
        "canonical": "history",
        "summary": "ưu tiên di tích, bảo tàng, công trình lịch sử và điểm tham quan có chiều sâu thông tin",
        "guidance": [
            "Ưu tiên di tích, thành cổ, bảo tàng, địa danh gắn với sự kiện hoặc nhân vật lịch sử.",
            "Mô tả nên nhấn vào bối cảnh lịch sử chứ không chỉ vẻ đẹp cảnh quan.",
            "Nếu chọn lịch sử, nên có ít nhất một điểm trọng tâm mỗi ngày mang giá trị kể chuyện rõ ràng.",
        ],
    },
    "phieu luu": {
        "label": "Phiêu lưu",
        "canonical": "adventure",
        "summary": "ưu tiên trải nghiệm năng động, khám phá, hoạt động ngoài trời và nhịp đi giàu năng lượng",
        "guidance": [
            "Ưu tiên hoạt động active như trekking nhẹ, đi thuyền, đạp xe, khám phá cung đường lạ.",
            "Lịch trình có thể dày hơn bình thường nhưng vẫn phải thực tế về thời gian di chuyển.",
            "Nếu thiếu hoạt động mạo hiểm thật sự, chọn các điểm tạo cảm giác khám phá thay vì mua sắm hoặc nghỉ dưỡng.",
        ],
    },
    "gia dinh": {
        "label": "Gia đình",
        "canonical": "family",
        "summary": "ưu tiên an toàn, dễ di chuyển, phù hợp nhiều độ tuổi và có thời gian nghỉ hợp lý",
        "guidance": [
            "Ưu tiên điểm dễ đi, an toàn, sạch sẽ, có chỗ nghỉ chân và phù hợp trẻ em/người lớn tuổi.",
            "Giảm các quãng di chuyển quá dài hoặc lịch trình quá sít.",
            "Nên có điểm ăn uống ổn định, nhà vệ sinh thuận tiện và hoạt động nhẹ nhàng vào buổi tối.",
        ],
    },
    "lang man": {
        "label": "Lãng mạn",
        "canonical": "romantic",
        "summary": "ưu tiên không gian riêng tư, cảnh đẹp, sunset, fine dining và trải nghiệm cho cặp đôi",
        "guidance": [
            "Ưu tiên điểm có không khí riêng tư, lãng mạn, view đẹp, sunset, cafe hoặc bữa tối phù hợp cặp đôi.",
            "Buổi tối nên có nhịp dịu, tránh quá ồn hoặc quá dày hoạt động nếu không có lý do rõ ràng.",
            "Tăng trọng số cho các điểm nhìn cảnh, promenade, du thuyền nhẹ hoặc resort/cafe đẹp.",
        ],
    },
    "mua sam": {
        "label": "Mua sắm",
        "canonical": "shopping",
        "summary": "ưu tiên chợ, phố thương mại, trung tâm mua sắm và điểm mua đặc sản hợp lý",
        "guidance": [
            "Ưu tiên chợ địa phương, phố mua sắm, trung tâm thương mại, điểm mua đặc sản hoặc quà tặng.",
            "Nên đặt mua sắm vào khung chiều hoặc tối thay vì chiếm các giờ đẹp của điểm thiên nhiên.",
            "Gợi ý ngắn về mặc cả, giá cả hoặc món nên mua giúp tăng tính thực dụng.",
        ],
    },
    "nightlife": {
        "label": "Nightlife",
        "canonical": "nightlife",
        "summary": "ưu tiên hoạt động buổi tối, chợ đêm, bar, pub, phố đi bộ và không khí sôi động sau 20h",
        "guidance": [
            "Buổi tối nên có điểm đi chơi thực sự sống động như chợ đêm, phố đi bộ, bar, pub, live music.",
            "Không chỉ kết thúc ở bữa tối nếu destination có nightlife rõ ràng.",
            "Cân bằng giữa an toàn, khoảng cách di chuyển ban đêm và trải nghiệm sôi động.",
        ],
    },
    "nghi duong": {
        "label": "Nghỉ dưỡng",
        "canonical": "relaxation",
        "summary": "ưu tiên thư giãn, spa, cafe chill, resort, điểm nhẹ nhàng và lịch trình thoáng",
        "guidance": [
            "Lịch trình nên thoáng, giảm bớt số điểm nếu cần để tạo cảm giác thư giãn thật sự.",
            "Ưu tiên resort, cafe chill, spa, tắm khoáng, bãi biển/yên tĩnh, điểm ngắm cảnh nhẹ nhàng.",
            "Tránh xếp quá nhiều hoạt động dồn dập nếu người dùng chọn nghỉ dưỡng.",
        ],
    },
}


def _normalize_style(value: str) -> str:
    return (
        unicodedata.normalize("NFD", str(value or ""))
        .lower()
        .replace("đ", "d")
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
    )


def summarize_travel_styles(travel_style: list[str] | None) -> dict:
    raw_styles = [str(item).strip() for item in (travel_style or []) if str(item).strip()]
    selected = []
    seen = set()

    for style in raw_styles:
        key = _normalize_style(style)
        if key in STYLE_PROFILES and key not in seen:
            selected.append(STYLE_PROFILES[key])
            seen.add(key)

    unmatched = [style for style in raw_styles if _normalize_style(style) not in STYLE_PROFILES]
    labels = [item["label"] for item in selected] + unmatched
    canonicals = [item["canonical"] for item in selected]

    if selected:
        semantic_lines = [
            f'- {item["label"]} ({item["canonical"]}): {item["summary"]}.'
            for item in selected
        ]
        guidance_lines = []
        for item in selected:
            for tip in item["guidance"]:
                guidance_lines.append(f'- [{item["canonical"]}] {tip}')
    else:
        semantic_lines = ['- Không có style cụ thể, giữ lịch trình cân bằng giữa tham quan, ăn uống và nghỉ ngơi.']
        guidance_lines = ['- Ưu tiên lịch trình cân bằng, phổ quát, dễ áp dụng cho đa số người dùng.']

    return {
        "labels": labels,
        "canonicals": canonicals,
        "prompt_semantics": "\n".join(semantic_lines),
        "prompt_guidance": "\n".join(guidance_lines),
        "agent_note": ", ".join(canonicals or labels) if (canonicals or labels) else "balanced",
    }
