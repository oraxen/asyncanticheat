//! Shared authentication utilities for API routes.
//!
//! This module provides common auth functions used across routes to ensure
//! consistent security practices like constant-time comparison.

use axum::http::HeaderMap;
use sha2::Digest;
use subtle::ConstantTimeEq;

/// Extracts and parses a Bearer token from the Authorization header.
///
/// Returns `Some(token)` if a valid "Bearer <token>" header is found,
/// `None` otherwise.
pub fn parse_bearer_token(headers: &HeaderMap) -> Option<String> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .trim();
    let prefix = "bearer ";
    if auth.len() <= prefix.len() {
        return None;
    }
    if !auth[..prefix.len()].eq_ignore_ascii_case(prefix) {
        return None;
    }
    Some(auth[prefix.len()..].trim().to_string())
}

/// Computes SHA-256 hash of the input and returns it as a hex string.
pub fn sha256_hex(input: &str) -> String {
    let mut h = sha2::Sha256::new();
    h.update(input.as_bytes());
    let out = h.finalize();
    hex::encode(out)
}

/// Performs a constant-time comparison of two strings to prevent timing attacks.
///
/// Returns `true` if the strings are equal, `false` otherwise.
/// The comparison time is constant regardless of how many characters match.
pub fn constant_time_eq(a: &str, b: &str) -> bool {
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();

    // Length check is unavoidable, but we still do a comparison
    // to maintain constant time behavior
    let len_match = a_bytes.len() == b_bytes.len();

    if len_match {
        a_bytes.ct_eq(b_bytes).into()
    } else {
        // Do a dummy comparison to maintain constant time
        let dummy = vec![0u8; b_bytes.len()];
        let _ = dummy.as_slice().ct_eq(b_bytes);
        false
    }
}

/// Validates a token hash against a stored hash using constant-time comparison.
///
/// Returns `true` if the hashes match, `false` otherwise.
pub fn validate_token_hash(provided_hash: &str, stored_hash: &str) -> bool {
    constant_time_eq(provided_hash, stored_hash)
}

/// Extract server address for dashboard ping feature.
/// Priority:
/// 1. X-Server-Address header (explicit config from plugin)
/// 2. X-Forwarded-For header (if behind a proxy)
/// 3. X-Real-IP header (common proxy header)
pub fn extract_server_address(headers: &HeaderMap) -> Option<String> {
    // 1. Explicit header from plugin config takes priority
    if let Some(addr) = headers
        .get("x-server-address")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        tracing::debug!(address = %addr, "using explicit X-Server-Address");
        return Some(addr);
    }

    // 2. X-Forwarded-For (first IP in the chain, closest to client)
    if let Some(forwarded) = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
    {
        // X-Forwarded-For can be comma-separated: "client, proxy1, proxy2"
        if let Some(first_ip) = forwarded.split(',').next().map(|s| s.trim()) {
            if !first_ip.is_empty() && !is_local_ip(first_ip) {
                tracing::debug!(ip = %first_ip, "using X-Forwarded-For for server address");
                // Add default MC port
                return Some(format!("{}:25565", first_ip));
            }
        }
    }

    // 3. X-Real-IP (single IP header, common with nginx)
    if let Some(real_ip) = headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty() && !is_local_ip(s))
    {
        tracing::debug!(ip = %real_ip, "using X-Real-IP for server address");
        return Some(format!("{}:25565", real_ip));
    }

    None
}

/// Check if an IP string represents a local/loopback address.
fn is_local_ip(ip: &str) -> bool {
    ip == "127.0.0.1"
        || ip == "::1"
        || ip == "localhost"
        || ip.starts_with("10.")
        || ip.starts_with("192.168.")
        || ip.starts_with("172.16.")
        || ip.starts_with("172.17.")
        || ip.starts_with("172.18.")
        || ip.starts_with("172.19.")
        || ip.starts_with("172.2")
        || ip.starts_with("172.30.")
        || ip.starts_with("172.31.")
}
