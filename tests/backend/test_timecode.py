"""Pytest & Unittest Suite for Timecode Math and Deterministic VO Timing."""
import math


def frames_to_tc(total_frames: int, fps: float, is_drop_frame: bool = False) -> str:
    total_frames = max(0, round(total_frames))
    nominal_fps = round(fps)

    if is_drop_frame and abs(fps - 29.97) < 0.05:
        drop_frames = 2
        frames_per_minute = 1800 - drop_frames  # 1798
        frames_per_10_minutes = 1800 * 10 - drop_frames * 9  # 17982

        d = total_frames // frames_per_10_minutes
        m = total_frames % frames_per_10_minutes

        if m > drop_frames:
            adjusted = total_frames + drop_frames * 9 * d + drop_frames * ((m - drop_frames) // frames_per_minute)
        else:
            adjusted = total_frames + drop_frames * 9 * d

        ff = adjusted % 30
        ss = (adjusted // 30) % 60
        mm = (adjusted // 1800) % 60
        hh = adjusted // 108000
        return f"{hh:02d}:{mm:02d}:{ss:02d};{ff:02d}"

    ff = total_frames % nominal_fps
    total_seconds = total_frames // nominal_fps
    ss = total_seconds % 60
    mm = (total_seconds // 60) % 60
    hh = total_seconds // 3600
    sep = ";" if is_drop_frame else ":"
    return f"{hh:02d}:{mm:02d}:{ss:02d}{sep}{ff:02d}"


def tc_to_frames(tc: str, fps: float) -> int:
    parts = tc.strip().replace(";", ":").replace(".", ":").split(":")
    hh, mm, ss, ff = map(int, parts)
    nominal_fps = round(fps)
    is_df = ";" in tc or (abs(fps - 29.97) < 0.05 and ";" in tc)

    if is_df and abs(fps - 29.97) < 0.05:
        total_minutes = 60 * hh + mm
        drop_frames = 2
        base_frames = 108000 * hh + 1800 * mm + 30 * ss + ff
        dropped = drop_frames * (total_minutes - total_minutes // 10)
        return max(0, base_frames - dropped)

    return max(0, (hh * 3600 + mm * 60 + ss) * nominal_fps + ff)


def compute_auto_timing(shots: list[dict], target_seconds: float, fps: float) -> list[dict]:
    target_frames = round(target_seconds * fps)
    locked_frames = sum(s["duration_frames"] for s in shots if s.get("locked"))
    unlocked_shots = [s for s in shots if not s.get("locked")]

    if not unlocked_shots:
        return shots

    remaining_frames = max(len(unlocked_shots) * round(fps * 0.8), target_frames - locked_frames)

    weights = []
    for s in unlocked_shots:
        vo = (s.get("voiceover") or "").strip()
        chars = len(vo.replace(" ", ""))
        commas = vo.count("，") + vo.count(",") + vo.count("、")
        periods = vo.count("。") + vo.count("；") + vo.count(";")
        pause_frames = commas * 8 + periods * 16
        w = max(1.0, chars * 1.0 + (pause_frames / fps) * 2.0)
        weights.append(w)

    sum_w = sum(weights) or len(unlocked_shots)
    assigned = 0
    allocations = []
    for i, w in enumerate(weights):
        if i == len(weights) - 1:
            allocations.append(max(round(fps * 0.8), remaining_frames - assigned))
        else:
            share = max(round(fps * 0.8), round((w / sum_w) * remaining_frames))
            allocations.append(share)
            assigned += share

    u_idx = 0
    result = []
    for s in shots:
        if s.get("locked"):
            result.append(s)
        else:
            s_copy = dict(s)
            s_copy["duration_frames"] = allocations[u_idx]
            u_idx += 1
            result.append(s_copy)
    return result


def test_timecode_conversions():
    # 25 fps PAL / Broadcast
    assert frames_to_tc(0, 25.0) == "00:00:00:00"
    assert frames_to_tc(25, 25.0) == "00:00:01:00"
    assert frames_to_tc(90000, 25.0) == "01:00:00:00"
    assert tc_to_frames("01:00:00:00", 25.0) == 90000

    # 24 fps Film
    assert frames_to_tc(48, 24.0) == "00:00:02:00"
    assert tc_to_frames("00:00:02:00", 24.0) == 48

    # 29.97 Drop-Frame
    tc_df = frames_to_tc(1800, 29.97, is_drop_frame=True)
    assert ";" in tc_df


def test_deterministic_vo_timing():
    shots = [
        {"id": "s1", "voiceover": "镜头一解说词，简短起势。", "locked": False, "duration_frames": 50},
        {"id": "s2", "voiceover": "镜头二解说词内容更加丰富，包含更多叙述、细节以及对未来发展蓝图的展望！", "locked": False, "duration_frames": 50},
        {"id": "s3", "voiceover": "产品三维动画特写展示", "locked": True, "duration_frames": 75}
    ]

    # Target 10s @ 25fps = 250 frames. Locked = 75. Remaining = 175 frames.
    res = compute_auto_timing(shots, 10.0, 25.0)

    # 1. Locked shot remains unchanged
    assert res[2]["duration_frames"] == 75

    # 2. Total duration equals target frames exactly (zero frame drift)
    total_frames = sum(s["duration_frames"] for s in res)
    assert total_frames == 250

    # 3. Shot 2 has more words & punctuation -> allocated more frames than Shot 1
    assert res[1]["duration_frames"] > res[0]["duration_frames"]
