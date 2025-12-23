//! Webhook notifications for findings
//!
//! Sends Discord/Slack/HTTP webhooks when findings match configured severity levels.

use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// Server webhook settings from the database
#[derive(Debug)]
pub struct WebhookSettings {
    pub webhook_url: Option<String>,
    pub webhook_enabled: bool,
    pub webhook_severity_levels: Vec<String>,
}

/// A finding to potentially notify about
#[derive(Debug, Clone)]
pub struct FindingNotification {
    pub server_id: String,
    pub player_uuid: Option<Uuid>,
    pub player_name: Option<String>,
    pub detector_name: String,
    pub severity: String,
    pub title: String,
    pub description: Option<String>,
    pub occurrences: i32,
}

/// Discord webhook embed structure
#[derive(Debug, Serialize)]
struct DiscordEmbed {
    title: String,
    description: String,
    color: u32,
    fields: Vec<DiscordField>,
    footer: DiscordFooter,
    timestamp: String,
}

#[derive(Debug, Serialize)]
struct DiscordField {
    name: String,
    value: String,
    inline: bool,
}

#[derive(Debug, Serialize)]
struct DiscordFooter {
    text: String,
}

#[derive(Debug, Serialize)]
struct DiscordWebhookPayload {
    embeds: Vec<DiscordEmbed>,
}

/// Generic webhook payload for non-Discord endpoints
#[derive(Debug, Serialize)]
struct GenericWebhookPayload {
    r#type: String,
    source: String,
    server_id: String,
    finding: GenericFinding,
    timestamp: String,
}

#[derive(Debug, Serialize)]
struct GenericFinding {
    player_uuid: Option<String>,
    player_name: Option<String>,
    detector: String,
    severity: String,
    title: String,
    description: Option<String>,
    occurrences: i32,
}

fn severity_color(severity: &str) -> u32 {
    match severity {
        "critical" => 0xDC2626, // Red
        "high" => 0xF97316,     // Orange
        "medium" => 0xEAB308,   // Yellow
        "low" => 0x6366F1,      // Indigo
        _ => 0x6B7280,          // Gray
    }
}

fn severity_emoji(severity: &str) -> &'static str {
    match severity {
        "critical" => "🚨",
        "high" => "⚠️",
        "medium" => "📢",
        "low" => "📝",
        _ => "ℹ️",
    }
}

fn is_discord_webhook(url: &str) -> bool {
    url.starts_with("https://discord.com/api/webhooks/")
        || url.starts_with("https://discordapp.com/api/webhooks/")
}

/// Fetch webhook settings for a server
pub async fn get_webhook_settings(db: &PgPool, server_id: &str) -> Option<WebhookSettings> {
    let row: Option<(Option<String>, bool, Vec<String>)> = sqlx::query_as(
        r#"
        SELECT webhook_url, webhook_enabled, webhook_severity_levels
        FROM public.servers
        WHERE id = $1
        "#,
    )
    .bind(server_id)
    .fetch_optional(db)
    .await
    .ok()?;

    row.map(|(url, enabled, levels)| WebhookSettings {
        webhook_url: url,
        webhook_enabled: enabled,
        webhook_severity_levels: levels,
    })
}

/// Check if a finding should trigger a webhook notification
pub fn should_notify(settings: &WebhookSettings, severity: &str) -> bool {
    settings.webhook_enabled
        && settings.webhook_url.is_some()
        && settings.webhook_severity_levels.iter().any(|s| s == severity)
}

/// Send webhook notification for a finding (fire-and-forget, logs errors)
pub async fn send_finding_notification(
    http_client: &reqwest::Client,
    webhook_url: &str,
    finding: &FindingNotification,
    server_name: Option<&str>,
) {
    let timestamp = chrono::Utc::now().to_rfc3339();

    let payload: Value = if is_discord_webhook(webhook_url) {
        let player_display = finding
            .player_name
            .clone()
            .or_else(|| finding.player_uuid.map(|u| u.to_string()))
            .unwrap_or_else(|| "Unknown".to_string());

        let embed = DiscordEmbed {
            title: format!(
                "{} {} Detection",
                severity_emoji(&finding.severity),
                finding.severity.to_uppercase()
            ),
            description: format!(
                "**{}**: {}",
                finding.detector_name,
                finding.title
            ),
            color: severity_color(&finding.severity),
            fields: vec![
                DiscordField {
                    name: "Player".to_string(),
                    value: player_display.to_string(),
                    inline: true,
                },
                DiscordField {
                    name: "Detector".to_string(),
                    value: finding.detector_name.clone(),
                    inline: true,
                },
                DiscordField {
                    name: "Occurrences".to_string(),
                    value: finding.occurrences.to_string(),
                    inline: true,
                },
            ],
            footer: DiscordFooter {
                text: format!(
                    "AsyncAnticheat • {}",
                    server_name.unwrap_or(&finding.server_id)
                ),
            },
            timestamp,
        };

        serde_json::to_value(DiscordWebhookPayload {
            embeds: vec![embed],
        })
        .unwrap_or_default()
    } else {
        serde_json::to_value(GenericWebhookPayload {
            r#type: "finding".to_string(),
            source: "asyncanticheat".to_string(),
            server_id: finding.server_id.clone(),
            finding: GenericFinding {
                player_uuid: finding.player_uuid.map(|u| u.to_string()),
                player_name: finding.player_name.clone(),
                detector: finding.detector_name.clone(),
                severity: finding.severity.clone(),
                title: finding.title.clone(),
                description: finding.description.clone(),
                occurrences: finding.occurrences,
            },
            timestamp,
        })
        .unwrap_or_default()
    };

    match http_client
        .post(webhook_url)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            if !response.status().is_success() {
                tracing::warn!(
                    server_id = %finding.server_id,
                    status = %response.status(),
                    "webhook request failed"
                );
            }
        }
        Err(e) => {
            tracing::warn!(
                server_id = %finding.server_id,
                error = %e,
                "webhook request error"
            );
        }
    }
}

/// Batch send webhook notifications (spawns background tasks)
pub fn spawn_webhook_notifications(
    http_client: reqwest::Client,
    webhook_url: String,
    findings: Vec<FindingNotification>,
    server_name: Option<String>,
) {
    // Rate limit: don't spam webhooks, batch similar findings
    // For now, send one notification per unique (detector, severity) combo
    use std::collections::HashMap;

    let mut grouped: HashMap<(String, String), FindingNotification> = HashMap::new();
    for f in findings {
        let key = (f.detector_name.clone(), f.severity.clone());
        let entry = grouped.entry(key).or_insert_with(|| f.clone());
        entry.occurrences += f.occurrences;
    }

    for (_, finding) in grouped {
        let client = http_client.clone();
        let url = webhook_url.clone();
        let name = server_name.clone();

        tokio::spawn(async move {
            send_finding_notification(&client, &url, &finding, name.as_deref()).await;
        });
    }
}
