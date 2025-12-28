use axum::{
    extract::State,
    http::{header::AUTHORIZATION, Request, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::AppState;

/// Middleware that protects dashboard endpoints with a static bearer token.
/// If `DASHBOARD_TOKEN` is unset, the middleware is a no-op (useful for local dev).
pub async fn require_dashboard<B>(
    State(state): State<AppState>,
    req: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    // No token configured => allow (development)
    let Some(expected) = state.dashboard_token.as_ref() else {
        return Ok(next.run(req).await);
    };

    // Extract bearer token
    let auth = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    let prefix = "bearer ";
    if auth.len() <= prefix.len() || !auth[..prefix.len()].eq_ignore_ascii_case(prefix) {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let provided = auth[prefix.len()..].trim();
    if provided != expected {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(req).await)
}
