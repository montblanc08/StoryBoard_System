"""
Industry Standard Deliverable & NLE Export Adapters for FrameForge OS.
Generates CMX 3600 EDL, OpenTimelineIO (.otio), SubRip (.srt), and UTF-8 CSV.
"""
from __future__ import annotations

import csv
import io
import json
import math
from typing import Any


def frames_to_smpte(frames: int, fps: float, is_drop_frame: bool = False) -> str:
    """Format frame integer to HH:MM:SS:FF or HH:MM:SS;FF timecode."""
    nominal_fps = int(round(fps))
    ff = frames % nominal_fps
    total_sec = frames // nominal_fps
    ss = total_sec % 60
    mm = (total_sec // 60) % 60
    hh = total_sec // 3600
    sep = ";" if is_drop_frame else ":"
    return f"{hh:02d}:{mm:02d}:{ss:02d}{sep}{ff:02d}"


def frames_to_srt_time(frames: int, fps: float) -> str:
    """Format frame integer to SubRip HH:MM:SS,mmm timestamp."""
    total_ms = int(round((frames / fps) * 1000))
    ms = total_ms % 1000
    total_sec = total_ms // 1000
    ss = total_sec % 60
    mm = (total_sec // 60) % 60
    hh = total_sec // 3600
    return f"{hh:02d}:{mm:02d}:{ss:02d},{ms:03d}"


def generate_cmx3600_edl(shots: list[Any], fps: float = 25.0, is_drop_frame: bool = False, title: str = "FRAMEFORGE_EXPORT") -> str:
    """Generate professional CMX 3600 EDL for DaVinci Resolve / Premiere Pro."""
    lines: list[str] = [
        f"TITLE: {title[:80].upper()}",
        f"FCM: {'DROP FRAME' if is_drop_frame else 'NON-DROP FRAME'}",
        ""
    ]

    record_in = int(round(fps * 3600))  # Start at 01:00:00:00

    for idx, s in enumerate(shots, start=1):
        dur = getattr(s, "duration_frames", 75)
        record_out = record_in + dur

        src_in_str = frames_to_smpte(0, fps, is_drop_frame)
        src_out_str = frames_to_smpte(dur, fps, is_drop_frame)
        rec_in_str = frames_to_smpte(record_in, fps, is_drop_frame)
        rec_out_str = frames_to_smpte(record_out, fps, is_drop_frame)

        event_num = f"{idx:03d}"
        reel = "AX"
        track = "V     C        "

        lines.append(f"{event_num}  {reel}       {track} {src_in_str} {src_out_str} {rec_in_str} {rec_out_str}")

        clip_name = f"SHOT_{getattr(s, 'display_number', idx)}"
        if getattr(s, "name", None):
            clip_name += f"_{getattr(s, 'name')}"
        lines.append(f"* FROM CLIP NAME: {clip_name[:80]}")

        if getattr(s, "voiceover", None):
            lines.append(f"* COMMENT: VO: {getattr(s, 'voiceover')[:120]}")

        lines.append("")
        record_in = record_out

    return "\r\n".join(lines)


def generate_srt(shots: list[Any], fps: float = 25.0) -> str:
    """Generate SubRip (.srt) subtitle cues aligned with shot timecodes."""
    cues: list[str] = []
    current_frame = 0
    cue_idx = 1

    for s in shots:
        dur = getattr(s, "duration_frames", 75)
        vo = getattr(s, "voiceover", "") or getattr(s, "dialogue", "")

        if vo and vo.strip():
            start_time = frames_to_srt_time(current_frame, fps)
            end_time = frames_to_srt_time(current_frame + dur, fps)
            cues.append(f"{cue_idx}\n{start_time} --> {end_time}\n{vo.strip()}\n")
            cue_idx += 1

        current_frame += dur

    return "\n".join(cues)


def generate_otio(shots: list[Any], fps: float = 25.0, title: str = "FrameForge Timeline") -> dict:
    """Generate OpenTimelineIO (.otio) Schema JSON structure."""
    nominal_fps = int(round(fps))
    total_frames = sum(getattr(s, "duration_frames", 75) for s in shots)

    clips: list[dict] = []
    current_f = 0

    for s in shots:
        dur = getattr(s, "duration_frames", 75)
        num = getattr(s, "display_number", "001")
        name = getattr(s, "name", f"Shot {num}")

        clips.append({
            "OTIO_SCHEMA": "Clip.1",
            "name": f"[{num}] {name}",
            "source_range": {
                "OTIO_SCHEMA": "TimeRange.1",
                "start_time": {
                    "OTIO_SCHEMA": "RationalTime.1",
                    "rate": nominal_fps,
                    "value": 0
                },
                "duration": {
                    "OTIO_SCHEMA": "RationalTime.1",
                    "rate": nominal_fps,
                    "value": dur
                }
            },
            "metadata": {
                "frameforge": {
                    "shot_id": getattr(s, "id", ""),
                    "primary_method": getattr(s, "primary_method", "live"),
                    "voiceover": getattr(s, "voiceover", ""),
                    "shot_size": getattr(s, "shot_size", "")
                }
            }
        })
        current_f += dur

    otio_doc = {
        "OTIO_SCHEMA": "Timeline.1",
        "name": title,
        "global_start_time": {
            "OTIO_SCHEMA": "RationalTime.1",
            "rate": nominal_fps,
            "value": int(round(fps * 3600))
        },
        "tracks": {
            "OTIO_SCHEMA": "Stack.1",
            "children": [
                {
                    "OTIO_SCHEMA": "Track.1",
                    "name": "Video Track",
                    "kind": "Video",
                    "children": clips
                }
            ]
        }
    }
    return otio_doc


def generate_csv(shots: list[Any], fps: float = 25.0) -> str:
    """Generate Excel-compatible UTF-8 CSV with complete production columns."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Standard Headers
    writer.writerow([
        "镜号", "标题", "制作方式", "景别", "焦段(mm)", "机位运镜",
        "画面构图与描述", "对应解说词旁白", "时长(秒)", "帧数", "SMPTE时码",
        "责任部门", "负责人", "制作状态", "导演备注"
    ])

    for s in shots:
        dur = getattr(s, "duration_frames", 75)
        sec = f"{dur / fps:.2f}"
        tc = frames_to_smpte(dur, fps)

        writer.writerow([
            getattr(s, "display_number", ""),
            getattr(s, "name", ""),
            getattr(s, "primary_method", "LIVE"),
            getattr(s, "shot_size", ""),
            getattr(s, "lens_mm", ""),
            getattr(s, "movement", ""),
            getattr(s, "description", ""),
            getattr(s, "voiceover", ""),
            sec,
            dur,
            tc,
            getattr(s, "department", ""),
            getattr(s, "owner_id", ""),
            getattr(s, "status", ""),
            getattr(s, "director_notes", "")
        ])

    return "\ufeff" + output.getvalue()
