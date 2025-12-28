//! Standard batch transforms applied by the ingest API before dispatching to modules.
//! 
//! Transforms convert raw packet data into higher-level event streams optimized for
//! specific types of anticheat checks.
//!
//! ## Available Transforms
//!
//! - `raw_ndjson_gz`: Pass-through, no transformation
//! - `movement_events_v1_ndjson_gz`: Normalized movement events with deltas and speed
//! - `combat_events_v1_ndjson_gz`: Attack events with timing and target info for killaura/reach

pub fn apply_transform(transform: &str, raw_gz_ndjson: &[u8]) -> anyhow::Result<Vec<u8>> {
    let t = transform.trim();
    if t.is_empty() || t.eq_ignore_ascii_case("raw_ndjson_gz") {
        return Ok(raw_gz_ndjson.to_vec());
    }

    if t.eq_ignore_ascii_case("movement_events_v1_ndjson_gz") {
        return movement_events_v1(raw_gz_ndjson);
    }

    if t.eq_ignore_ascii_case("combat_events_v1_ndjson_gz") {
        return combat_events_v1(raw_gz_ndjson);
    }

    if t.eq_ignore_ascii_case("ncp_fight_v1_ndjson_gz") {
        return ncp_fight_v1(raw_gz_ndjson);
    }

    anyhow::bail!("unsupported transform: {}", transform)
}

fn movement_events_v1(raw_gz_ndjson: &[u8]) -> anyhow::Result<Vec<u8>> {
    use flate2::{read::GzDecoder, write::GzEncoder, Compression};
    use serde_json::Value;
    use std::collections::HashMap;
    use std::io::{BufRead, BufReader, Write};
    use uuid::Uuid;

    #[derive(Clone, Copy)]
    struct LastPos {
        ts: u64,
        x: f64,
        y: f64,
        z: f64,
    }

    let decoder = GzDecoder::new(raw_gz_ndjson);
    let mut reader = BufReader::new(decoder);

    let mut out = Vec::new();
    let mut encoder = GzEncoder::new(&mut out, Compression::default());

    let mut buf = String::new();
    let mut line_no = 0usize;
    // (kept for future metrics: output event count)
    let mut last: HashMap<Uuid, LastPos> = HashMap::new();

    while {
        buf.clear();
        reader.read_line(&mut buf)?
    } != 0
    {
        line_no += 1;
        let line = buf.trim_end_matches(&['\n', '\r'][..]);
        if line.is_empty() {
            continue;
        }

        // First line: pass through, but annotate transform.
        if line_no == 1 {
            let mut meta: Value = serde_json::from_str(line).unwrap_or(Value::Object(Default::default()));
            if let Some(obj) = meta.as_object_mut() {
                obj.insert("transform".to_string(), Value::String("movement_events_v1".to_string()));
            }
            writeln!(encoder, "{}", serde_json::to_string(&meta)?)?;
            continue;
        }

        let v: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let uuid = v
            .get("uuid")
            .and_then(|x| x.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());
        let ts = v.get("ts").and_then(|x| x.as_u64());
        let Some(uuid) = uuid else { continue };
        let Some(ts) = ts else { continue };

        let fields = v.get("fields").and_then(|x| x.as_object());
        let Some(fields) = fields else { continue };
        let x = fields.get("x").and_then(|x| x.as_f64());
        let y = fields.get("y").and_then(|x| x.as_f64());
        let z = fields.get("z").and_then(|x| x.as_f64());
        let on_ground = fields.get("on_ground").and_then(|x| x.as_bool());
        let (Some(x), Some(y), Some(z)) = (x, y, z) else { continue };

        // Skip packets with NaN/Infinity coordinates (malicious input).
        if !x.is_finite() || !y.is_finite() || !z.is_finite() {
            continue;
        }

        let mut obj = serde_json::Map::new();
        obj.insert("ts".to_string(), Value::Number(ts.into()));
        obj.insert("uuid".to_string(), Value::String(uuid.to_string()));
        obj.insert("x".to_string(), json_f64(x));
        obj.insert("y".to_string(), json_f64(y));
        obj.insert("z".to_string(), json_f64(z));
        if let Some(og) = on_ground {
            obj.insert("on_ground".to_string(), Value::Bool(og));
        }

        if let Some(prev) = last.get(&uuid).copied() {
            if ts > prev.ts {
                let dt_ms = (ts - prev.ts) as f64;
                let dx = x - prev.x;
                let dy = y - prev.y;
                let dz = z - prev.z;
                let dist = (dx * dx + dy * dy + dz * dz).sqrt();
                // Avoid division by zero; if dt_ms is 0, skip speed calculation.
                let bps = if dt_ms > 0.0 { dist / (dt_ms / 1000.0) } else { 0.0 };
                obj.insert("dt_ms".to_string(), json_f64(dt_ms));
                obj.insert("dx".to_string(), json_f64(dx));
                obj.insert("dy".to_string(), json_f64(dy));
                obj.insert("dz".to_string(), json_f64(dz));
                obj.insert("speed_bps".to_string(), json_f64(bps));
            }
        }

        last.insert(uuid, LastPos { ts, x, y, z });
        writeln!(encoder, "{}", Value::Object(obj))?;
    }

    encoder.finish()?;
    Ok(out)
}

/// Transform for combat/killaura detection.
///
/// Extracts attack events (INTERACT_ENTITY with action=ATTACK) and enriches them with:
/// - Time since last attack (for attack speed checks)
/// - Yaw/pitch changes between attacks (for angle/killaura detection)
/// - Target switching patterns
///
/// Based on NoCheatPlus checks:
/// - Angle: Tracks yaw changes when switching targets rapidly
/// - Speed: Tracks attacks per second
/// - Reach: Would need entity position data (not available in packets alone)
fn combat_events_v1(raw_gz_ndjson: &[u8]) -> anyhow::Result<Vec<u8>> {
    use flate2::{read::GzDecoder, write::GzEncoder, Compression};
    use serde_json::Value;
    use std::collections::HashMap;
    use std::io::{BufRead, BufReader, Write};
    use uuid::Uuid;

    #[derive(Clone)]
    struct LastAttack {
        ts: u64,
        target_entity_id: i64,
        yaw: Option<f64>,
        pitch: Option<f64>,
    }

    let decoder = GzDecoder::new(raw_gz_ndjson);
    let mut reader = BufReader::new(decoder);

    let mut out = Vec::new();
    let mut encoder = GzEncoder::new(&mut out, Compression::default());

    let mut buf = String::new();
    let mut line_no = 0usize;
    let mut last_attacks: HashMap<Uuid, LastAttack> = HashMap::new();
    // Track last known position/rotation per player (from position packets)
    let mut last_pos: HashMap<Uuid, (f64, f64, f64, f64, f64)> = HashMap::new(); // (x, y, z, yaw, pitch)

    while {
        buf.clear();
        reader.read_line(&mut buf)?
    } != 0
    {
        line_no += 1;
        let line = buf.trim_end_matches(&['\n', '\r'][..]);
        if line.is_empty() {
            continue;
        }

        // First line: pass through, but annotate transform.
        if line_no == 1 {
            let mut meta: Value = serde_json::from_str(line).unwrap_or(Value::Object(Default::default()));
            if let Some(obj) = meta.as_object_mut() {
                obj.insert("transform".to_string(), Value::String("combat_events_v1".to_string()));
            }
            writeln!(encoder, "{}", serde_json::to_string(&meta)?)?;
            continue;
        }

        let v: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };
        
        let uuid = v
            .get("uuid")
            .and_then(|x| x.as_str())
            .and_then(|s| Uuid::parse_str(s).ok());
        let ts = v.get("ts").and_then(|x| x.as_u64());
        let pkt = v.get("pkt").and_then(|x| x.as_str()).unwrap_or("");
        
        let Some(uuid) = uuid else { continue };
        let Some(ts) = ts else { continue };

        let fields = v.get("fields").and_then(|x| x.as_object());

        // Track position updates for context
        if pkt.contains("POSITION") || pkt.contains("ROTATION") {
            if let Some(fields) = fields {
                let x = fields.get("x").and_then(|v| v.as_f64());
                let y = fields.get("y").and_then(|v| v.as_f64());
                let z = fields.get("z").and_then(|v| v.as_f64());
                let yaw = fields.get("yaw").and_then(|v| v.as_f64());
                let pitch = fields.get("pitch").and_then(|v| v.as_f64());
                
                if let Some(prev) = last_pos.get(&uuid).copied() {
                    last_pos.insert(uuid, (
                        x.unwrap_or(prev.0),
                        y.unwrap_or(prev.1),
                        z.unwrap_or(prev.2),
                        yaw.unwrap_or(prev.3),
                        pitch.unwrap_or(prev.4),
                    ));
                } else if let (Some(x), Some(y), Some(z)) = (x, y, z) {
                    last_pos.insert(uuid, (x, y, z, yaw.unwrap_or(0.0), pitch.unwrap_or(0.0)));
                }
            }
            continue;
        }

        // Only emit attack events
        if !pkt.contains("INTERACT") && !pkt.contains("USE_ENTITY") {
            continue;
        }

        let Some(fields) = fields else { continue };
        let action = fields.get("action").and_then(|x| x.as_str()).unwrap_or("");
        if action != "ATTACK" {
            continue;
        }

        let entity_id = fields.get("entity_id").and_then(|x| x.as_i64()).unwrap_or(-1);
        let sneaking = fields.get("sneaking").and_then(|x| x.as_bool()).unwrap_or(false);

        let mut obj = serde_json::Map::new();
        obj.insert("ts".to_string(), Value::Number(ts.into()));
        obj.insert("uuid".to_string(), Value::String(uuid.to_string()));
        obj.insert("entity_id".to_string(), Value::Number(entity_id.into()));
        obj.insert("sneaking".to_string(), Value::Bool(sneaking));

        // Add player position/rotation context
        if let Some((x, y, z, yaw, pitch)) = last_pos.get(&uuid).copied() {
            obj.insert("player_x".to_string(), json_f64(x));
            obj.insert("player_y".to_string(), json_f64(y));
            obj.insert("player_z".to_string(), json_f64(z));
            obj.insert("player_yaw".to_string(), json_f64(yaw));
            obj.insert("player_pitch".to_string(), json_f64(pitch));
        }

        // Calculate deltas from last attack (for NCP-style checks)
        if let Some(prev) = last_attacks.get(&uuid).cloned() {
            let dt_ms = ts.saturating_sub(prev.ts) as f64;
            obj.insert("dt_ms".to_string(), json_f64(dt_ms));
            
            // Attacks per second based on this interval
            if dt_ms > 0.0 {
                let aps = 1000.0 / dt_ms;
                obj.insert("attacks_per_second".to_string(), json_f64(aps));
            }

            // Target switching detection (key for angle/killaura checks)
            let target_changed = entity_id != prev.target_entity_id;
            obj.insert("target_switched".to_string(), Value::Bool(target_changed));

            // Yaw difference (critical for angle check)
            if let (Some(prev_yaw), Some((_, _, _, curr_yaw, _))) = (prev.yaw, last_pos.get(&uuid).copied()) {
                let yaw_diff = yaw_difference(curr_yaw, prev_yaw);
                obj.insert("yaw_diff".to_string(), json_f64(yaw_diff));
            }
        }

        // Store this attack as the new "last attack"
        last_attacks.insert(uuid, LastAttack {
            ts,
            target_entity_id: entity_id,
            yaw: last_pos.get(&uuid).map(|p| p.3),
            pitch: last_pos.get(&uuid).map(|p| p.4),
        });

        writeln!(encoder, "{}", Value::Object(obj))?;
    }

    encoder.finish()?;
    Ok(out)
}

fn json_f64(v: f64) -> serde_json::Value {
    serde_json::Value::Number(serde_json::Number::from_f64(v).unwrap_or_else(|| serde_json::Number::from(0)))
}

/// Calculate the absolute yaw difference, handling wraparound at 360°
fn yaw_difference(yaw1: f64, yaw2: f64) -> f64 {
    let mut diff = (yaw1 - yaw2).abs();
    if diff > 180.0 {
        diff = 360.0 - diff;
    }
    diff
}

/// NCP-oriented fight transform.
///
/// Outputs *enriched attack events* with best-effort target position tracking using
/// clientbound entity spawn/teleport/relative-move packets within the batch.
///
/// Why:
/// - NCP Reach/Direction rely on (player eye → target) geometry.
/// - The ingest API can cheaply provide `reach_distance` and `aim_off` so modules remain simple.
///
/// Output lines (after meta):
/// ```json
/// {"ts":..., "uuid":"...", "entity_id":123, "player_x":..., "player_y":..., "player_z":..., "player_yaw":..., "player_pitch":..., "target_x":..., "target_y":..., "target_z":..., "reach_distance":..., "aim_off":...}
/// ```
fn ncp_fight_v1(raw_gz_ndjson: &[u8]) -> anyhow::Result<Vec<u8>> {
    use flate2::{read::GzDecoder, write::GzEncoder, Compression};
    use serde_json::Value;
    use std::collections::HashMap;
    use std::io::{BufRead, BufReader, Write};
    use uuid::Uuid;

    #[derive(Clone, Copy)]
    struct Pos {
        x: f64,
        y: f64,
        z: f64,
    }

    #[derive(Clone, Copy)]
    struct PlayerPose {
        x: f64,
        y: f64,
        z: f64,
        yaw: f64,
        pitch: f64,
    }

    // 1.62 is a good default eye height for standing players (NCP uses Bukkit eye height).
    const DEFAULT_EYE_HEIGHT: f64 = 1.62;

    let decoder = GzDecoder::new(raw_gz_ndjson);
    let mut reader = BufReader::new(decoder);

    let mut out = Vec::new();
    let mut encoder = GzEncoder::new(&mut out, Compression::default());

    let mut buf = String::new();
    let mut line_no = 0usize;

    // Within-batch trackers.
    let mut entity_pos: HashMap<i64, Pos> = HashMap::new();
    let mut player_pose: HashMap<Uuid, PlayerPose> = HashMap::new();

    while {
        buf.clear();
        reader.read_line(&mut buf)?
    } != 0
    {
        line_no += 1;
        let line = buf.trim_end_matches(&['\n', '\r'][..]);
        if line.is_empty() {
            continue;
        }

        // First line: pass through, but annotate transform.
        if line_no == 1 {
            let mut meta: Value = serde_json::from_str(line).unwrap_or(Value::Object(Default::default()));
            if let Some(obj) = meta.as_object_mut() {
                obj.insert("transform".to_string(), Value::String("ncp_fight_v1".to_string()));
            }
            writeln!(encoder, "{}", serde_json::to_string(&meta)?)?;
            continue;
        }

        let v: Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let ts = v.get("ts").and_then(|x| x.as_u64());
        let pkt = v.get("pkt").and_then(|x| x.as_str()).unwrap_or("");
        let dir = v.get("dir").and_then(|x| x.as_str()).unwrap_or("");
        let fields = v.get("fields").and_then(|x| x.as_object());
        let Some(ts) = ts else { continue };
        let Some(fields) = fields else { continue };

        // --- Track entity position from clientbound packets ---
        if dir == "clientbound" {
            // Spawn / teleport are absolute (x,y,z)
            if pkt.contains("SPAWN") || pkt.contains("ENTITY_TELEPORT") {
                let entity_id = fields.get("entity_id").and_then(|x| x.as_i64());
                let x = fields.get("x").and_then(|x| x.as_f64());
                let y = fields.get("y").and_then(|x| x.as_f64());
                let z = fields.get("z").and_then(|x| x.as_f64());
                if let (Some(entity_id), Some(x), Some(y), Some(z)) = (entity_id, x, y, z) {
                    entity_pos.insert(entity_id, Pos { x, y, z });
                }
                continue;
            }

            // Relative move: dx,dy,dz
            if pkt.contains("ENTITY_RELATIVE_MOVE") {
                let entity_id = fields.get("entity_id").and_then(|x| x.as_i64());
                let dx = fields.get("dx").and_then(|x| x.as_f64()).unwrap_or(0.0);
                let dy = fields.get("dy").and_then(|x| x.as_f64()).unwrap_or(0.0);
                let dz = fields.get("dz").and_then(|x| x.as_f64()).unwrap_or(0.0);
                if let Some(entity_id) = entity_id {
                    if let Some(p) = entity_pos.get_mut(&entity_id) {
                        p.x += dx;
                        p.y += dy;
                        p.z += dz;
                    }
                }
                continue;
            }

            if pkt.contains("DESTROY_ENTITIES") {
                if let Some(arr) = fields.get("entity_ids").and_then(|x| x.as_array()) {
                    for id in arr.iter().filter_map(|v| v.as_i64()) {
                        entity_pos.remove(&id);
                    }
                }
                continue;
            }
        }

        // --- Track player pose from serverbound movement packets ---
        if dir == "serverbound" && (pkt.contains("POSITION") || pkt.contains("ROTATION") || pkt.contains("FLYING")) {
            let uuid = v
                .get("uuid")
                .and_then(|x| x.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());
            let Some(uuid) = uuid else { continue };

            // Get position/rotation fields from packet
            let x = fields.get("x").and_then(|x| x.as_f64());
            let y = fields.get("y").and_then(|x| x.as_f64());
            let z = fields.get("z").and_then(|x| x.as_f64());
            let yaw = fields.get("yaw").and_then(|x| x.as_f64());
            let pitch = fields.get("pitch").and_then(|x| x.as_f64());

            // Update pose, but only if we have real position data
            // Avoid seeding bogus (0,0,0) positions from rotation-only packets
            if let Some(prev) = player_pose.get(&uuid).copied() {
                // Update with new values, keeping old ones for missing fields
                player_pose.insert(uuid, PlayerPose {
                    x: x.unwrap_or(prev.x),
                    y: y.unwrap_or(prev.y),
                    z: z.unwrap_or(prev.z),
                    yaw: yaw.unwrap_or(prev.yaw),
                    pitch: pitch.unwrap_or(prev.pitch),
                });
            } else if let (Some(x), Some(y), Some(z)) = (x, y, z) {
                // First pose - only create if we have actual position coordinates
                // This prevents seeding (0,0,0) from rotation-only packets
                player_pose.insert(uuid, PlayerPose {
                    x,
                    y,
                    z,
                    yaw: yaw.unwrap_or(0.0),
                    pitch: pitch.unwrap_or(0.0),
                });
            }
            // If no previous pose and no position coords, skip - don't seed bogus values
            continue;
        }

        // --- Emit enriched attack events ---
        if dir == "serverbound" && (pkt.contains("INTERACT_ENTITY") || pkt.contains("USE_ENTITY")) {
            let action = fields.get("action").and_then(|x| x.as_str()).unwrap_or("");
            if action != "ATTACK" {
                continue;
            }
            let uuid = v
                .get("uuid")
                .and_then(|x| x.as_str())
                .and_then(|s| Uuid::parse_str(s).ok());
            let entity_id = fields.get("entity_id").and_then(|x| x.as_i64());
            let (Some(uuid), Some(entity_id)) = (uuid, entity_id) else { continue };

            let pose = player_pose.get(&uuid).copied();
            if pose.is_none() {
                continue; // can't enrich without pose
            }
            let pose = pose.unwrap();

            let target = entity_pos.get(&entity_id).copied();

            let mut obj = serde_json::Map::new();
            obj.insert("ts".to_string(), Value::Number(ts.into()));
            obj.insert("uuid".to_string(), Value::String(uuid.to_string()));
            obj.insert("entity_id".to_string(), Value::Number(entity_id.into()));
            obj.insert("player_x".to_string(), json_f64(pose.x));
            obj.insert("player_y".to_string(), json_f64(pose.y));
            obj.insert("player_z".to_string(), json_f64(pose.z));
            obj.insert("player_yaw".to_string(), json_f64(pose.yaw));
            obj.insert("player_pitch".to_string(), json_f64(pose.pitch));

            if let Some(t) = target {
                obj.insert("target_x".to_string(), json_f64(t.x));
                obj.insert("target_y".to_string(), json_f64(t.y));
                obj.insert("target_z".to_string(), json_f64(t.z));

                // Geometry-based values.
                let eye = Pos {
                    x: pose.x,
                    y: pose.y + DEFAULT_EYE_HEIGHT,
                    z: pose.z,
                };
                let r = Pos {
                    x: t.x - eye.x,
                    y: t.y - eye.y,
                    z: t.z - eye.z,
                };
                let dist = (r.x * r.x + r.y * r.y + r.z * r.z).sqrt();
                obj.insert("reach_distance".to_string(), json_f64(dist));

                // View direction from yaw/pitch (degrees).
                // Minecraft: yaw rotates around Y, pitch up/down.
                let yaw_rad = (pose.yaw as f64).to_radians();
                let pitch_rad = (pose.pitch as f64).to_radians();
                let d = Pos {
                    x: -pitch_rad.cos() * yaw_rad.sin(),
                    y: -pitch_rad.sin(),
                    z: pitch_rad.cos() * yaw_rad.cos(),
                };
                let d_len = (d.x * d.x + d.y * d.y + d.z * d.z).sqrt().max(1e-9);
                let cross = Pos {
                    x: r.y * d.z - r.z * d.y,
                    y: r.z * d.x - r.x * d.z,
                    z: r.x * d.y - r.y * d.x,
                };
                let off = ((cross.x * cross.x + cross.y * cross.y + cross.z * cross.z).sqrt()) / d_len;
                obj.insert("aim_off".to_string(), json_f64(off));
            }

            writeln!(encoder, "{}", Value::Object(obj))?;
        }
    }

    encoder.finish()?;
    Ok(out)
}

