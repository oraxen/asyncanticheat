use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BuiltinTier {
    Core,
    Advanced,
}

#[derive(Debug, Clone, Serialize)]
pub struct BuiltinModuleInfo {
    pub name: String,
    pub tier: BuiltinTier,
    pub default_port: u16,
    pub default_base_url: String,
    pub short_description: String,
    pub full_description: String,
    pub checks: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct BuiltinModuleDef {
    pub name: &'static str,
    pub tier: BuiltinTier,
    pub default_port: u16,
    pub short_description: &'static str,
    pub full_description: &'static str,
    pub checks: &'static [&'static str],
}

pub const BUILTIN_MODULES: &[BuiltinModuleDef] = &[
    BuiltinModuleDef {
        name: "Movement Core",
        tier: BuiltinTier::Core,
        default_port: 4030,
        short_description: "Blatant movement cheats",
        full_description:
            "Pareto tier: Catches obvious flight, blatant speed, nofall exploits, and ground spoofing with minimal false positives.",
        checks: &[
            "movement_core_flight_ascend",
            "movement_core_speed_blatant",
            "movement_core_nofall_ground",
            "movement_core_groundspoof_fall",
            "movement_core_groundspoof_ascend",
        ],
    },
    BuiltinModuleDef {
        name: "Movement Advanced",
        tier: BuiltinTier::Advanced,
        default_port: 4031,
        short_description: "Subtle movement analysis",
        full_description:
            "Y-prediction physics, hovering detection, sprint/sneak speed limits, timer manipulation, step height, and noslow bypass.",
        checks: &[
            "movement_advanced_flight_ypred",
            "movement_advanced_flight_hover",
            "movement_advanced_speed_sprint",
            "movement_advanced_speed_sneak",
            "movement_advanced_timer_fast",
            "movement_advanced_timer_slow",
            "movement_advanced_step_height",
            "movement_advanced_noslow_item",
        ],
    },
    BuiltinModuleDef {
        name: "Combat Core",
        tier: BuiltinTier::Core,
        default_port: 4032,
        short_description: "High-signal combat cheats",
        full_description:
            "Pareto tier: Simple checks catching 80% of combat cheaters. High CPS, critical reach, multi-target switching, and missing arm animations.",
        checks: &[
            "combat_core_autoclicker_cps",
            "combat_core_reach_critical",
            "combat_core_killaura_multi",
            "combat_core_noswing",
        ],
    },
    BuiltinModuleDef {
        name: "Combat Advanced",
        tier: BuiltinTier::Advanced,
        default_port: 4033,
        short_description: "Statistical combat analysis",
        full_description:
            "Statistical analysis of aim patterns, autoclicker timing distributions, GCD sensitivity checks, and subtle reach accumulation.",
        checks: &[
            "combat_advanced_aim_headsnap",
            "combat_advanced_aim_pitchspread",
            "combat_advanced_aim_sensitivity",
            "combat_advanced_aim_modulo",
            "combat_advanced_aim_dirswitch",
            "combat_advanced_aim_repeated_yaw",
            "combat_advanced_autoclicker_timing",
            "combat_advanced_autoclicker_variance",
            "combat_advanced_autoclicker_kurtosis",
            "combat_advanced_autoclicker_tickalign",
            "combat_advanced_killaura_post",
            "combat_advanced_reach_distance",
        ],
    },
    BuiltinModuleDef {
        name: "Player Core",
        tier: BuiltinTier::Core,
        default_port: 4034,
        short_description: "Obvious packet abuse",
        full_description:
            "Pareto tier: Invalid packets (pitch, NaN, slots), impossible abilities, critical fast place/break, and airborne scaffolding.",
        checks: &[
            "player_core_badpackets_pitch",
            "player_core_badpackets_nan",
            "player_core_badpackets_abilities",
            "player_core_badpackets_slot",
            "player_core_fastplace_critical",
            "player_core_fastbreak_critical",
            "player_core_scaffold_airborne",
        ],
    },
    BuiltinModuleDef {
        name: "Player Advanced",
        tier: BuiltinTier::Advanced,
        default_port: 4035,
        short_description: "Complex interaction analysis",
        full_description:
            "Interaction angles, rapid inventory clicks, fast place/break accumulation, and sprint-while-bridging detection.",
        checks: &[
            "player_advanced_interact_angle",
            "player_advanced_interact_impossible",
            "player_advanced_inventory_fast",
            "player_advanced_fastplace",
            "player_advanced_fastbreak",
            "player_advanced_scaffold_sprint",
        ],
    },
];

pub fn default_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

pub fn builtin_modules_info() -> Vec<BuiltinModuleInfo> {
    BUILTIN_MODULES
        .iter()
        .map(|m| BuiltinModuleInfo {
            name: m.name.to_string(),
            tier: m.tier,
            default_port: m.default_port,
            default_base_url: default_base_url(m.default_port),
            short_description: m.short_description.to_string(),
            full_description: m.full_description.to_string(),
            checks: m.checks.iter().map(|c| (*c).to_string()).collect(),
        })
        .collect()
}

pub fn builtin_by_name(name: &str) -> Option<&'static BuiltinModuleDef> {
    BUILTIN_MODULES.iter().find(|m| m.name == name)
}

