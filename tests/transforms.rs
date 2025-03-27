use async_anticheat_api::transforms::apply_transform;
use flate2::{read::GzDecoder, write::GzEncoder, Compression};
use std::io::Read;

fn gzip(s: &str) -> Vec<u8> {
    let mut out = Vec::new();
    let mut enc = GzEncoder::new(&mut out, Compression::default());
    std::io::Write::write_all(&mut enc, s.as_bytes()).unwrap();
    enc.finish().unwrap();
    out
}

fn gunzip(bytes: &[u8]) -> String {
    let mut dec = GzDecoder::new(bytes);
    let mut s = String::new();
    dec.read_to_string(&mut s).unwrap();
    s
}

#[test]
fn movement_events_v1_includes_on_ground_when_present() {
    let raw = r#"
{"server_id":"s","session_id":"x"}
{"ts":1000,"dir":"serverbound","pkt":"PLAYER_POSITION","uuid":"00000000-0000-0000-0000-000000000001","name":"p","fields":{"x":0.0,"y":64.0,"z":0.0,"on_ground":true}}
{"ts":1050,"dir":"serverbound","pkt":"PLAYER_POSITION","uuid":"00000000-0000-0000-0000-000000000001","name":"p","fields":{"x":1.0,"y":64.0,"z":0.0,"on_ground":false}}
"#
    .trim_start();

    let gz = gzip(raw);
    let out = apply_transform("movement_events_v1_ndjson_gz", &gz).unwrap();
    let text = gunzip(&out);
    assert!(text.contains(r#""on_ground":true"#));
    assert!(text.contains(r#""on_ground":false"#));
}


