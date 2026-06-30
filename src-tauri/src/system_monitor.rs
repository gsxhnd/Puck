use std::sync::{Mutex, OnceLock};
use std::time::Instant;

use serde::Deserialize;
use serde::Serialize;
use sysinfo::{Disk, Disks, System};

use crate::runtime::block_on;
use crate::ssh::exec_remote_command;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskStats {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_used: u64,
    pub memory_total: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub primary_disk: Option<DiskStats>,
    pub load_average: Option<[f64; 3]>,
}

struct MonitorState {
    system: System,
    last_cpu_refresh: Option<Instant>,
}

static MONITOR: OnceLock<Mutex<MonitorState>> = OnceLock::new();

fn monitor_state() -> &'static Mutex<MonitorState> {
    MONITOR.get_or_init(|| {
        let mut system = System::new();
        system.refresh_memory();
        Mutex::new(MonitorState {
            system,
            last_cpu_refresh: None,
        })
    })
}

fn disk_stats(disk: &Disk) -> DiskStats {
    DiskStats {
        name: disk.name().to_string_lossy().into_owned(),
        mount_point: disk.mount_point().to_string_lossy().into_owned(),
        total_bytes: disk.total_space(),
        available_bytes: disk.available_space(),
    }
}

fn primary_disk(disks: &Disks) -> Option<DiskStats> {
    let mut candidates: Vec<&Disk> = disks
        .iter()
        .filter(|disk| disk.total_space() > 0)
        .collect();

    candidates.sort_by(|left, right| {
        let left_root = left.mount_point().to_string_lossy() == "/";
        let right_root = right.mount_point().to_string_lossy() == "/";
        right_root
            .cmp(&left_root)
            .then_with(|| right.total_space().cmp(&left.total_space()))
    });

    candidates.first().map(|disk| disk_stats(disk))
}

#[tauri::command]
pub fn get_system_stats() -> SystemStats {
    let mut state = monitor_state()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let now = Instant::now();

    let should_refresh_cpu = match state.last_cpu_refresh {
        Some(last) => now.duration_since(last) >= sysinfo::MINIMUM_CPU_UPDATE_INTERVAL,
        None => true,
    };

    if should_refresh_cpu {
        state.system.refresh_cpu_usage();
        state.last_cpu_refresh = Some(now);
    }

    state.system.refresh_memory();

    let load = System::load_average();
    let load_average = if load.one >= 0.0 {
        Some([load.one, load.five, load.fifteen])
    } else {
        None
    };

    let disks = Disks::new_with_refreshed_list();

    SystemStats {
        cpu_usage: state.system.global_cpu_usage(),
        memory_used: state.system.used_memory(),
        memory_total: state.system.total_memory(),
        swap_used: state.system.used_swap(),
        swap_total: state.system.total_swap(),
        primary_disk: primary_disk(&disks),
        load_average,
    }
}

const REMOTE_STATS_COMMAND: &str = r#"sh -c 'if [ ! -r /proc/meminfo ]; then echo "{\"unsupported\":true}"; exit 0; fi; read _ u1 n1 s1 i1 iw1 irq1 sft1 _ </proc/stat; a1=$((u1+n1+s1)); t1=$((u1+n1+s1+i1+iw1+irq1+sft1)); sleep 1; read _ u2 n2 s2 i2 iw2 irq2 sft2 _ </proc/stat; a2=$((u2+n2+s2)); t2=$((u2+n2+s2+i2+iw2+irq2+sft2)); dt=$((t2-t1)); du=$((a2-a1)); if [ "$dt" -gt 0 ]; then cpu=$(awk -v d="$du" -v t="$dt" "BEGIN{printf \"%.1f\", d*100/t}"); else cpu=0; fi; mt=$(awk "/MemTotal/{print \$2*1024}" /proc/meminfo); ma=$(awk "/MemAvailable/{print \$2*1024}" /proc/meminfo); mu=$((mt-ma)); st=$(awk "/SwapTotal/{print \$2*1024}" /proc/meminfo); sf=$(awk "/SwapFree/{print \$2*1024}" /proc/meminfo); su=$((st-sf)); dm=$(df -B1 --output=target / 2>/dev/null | awk "NR==2{print \$1}"); dtb=$(df -B1 --output=size / 2>/dev/null | awk "NR==2{print \$1}"); da=$(df -B1 --output=avail / 2>/dev/null | awk "NR==2{print \$1}"); la1=$(awk "{print \$1}" /proc/loadavg); la5=$(awk "{print \$2}" /proc/loadavg); la15=$(awk "{print \$3}" /proc/loadavg); printf "{\"cpuUsage\":%s,\"memoryUsed\":%s,\"memoryTotal\":%s,\"swapUsed\":%s,\"swapTotal\":%s,\"primaryDisk\":{\"name\":\"%s\",\"mountPoint\":\"%s\",\"totalBytes\":%s,\"availableBytes\":%s},\"loadAverage\":[%s,%s,%s]}\n" "$cpu" "$mu" "$mt" "$su" "$st" "$dm" "$dm" "$dtb" "$da" "$la1" "$la5" "$la15"'"#;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteStatsPayload {
    cpu_usage: f32,
    memory_used: u64,
    memory_total: u64,
    swap_used: u64,
    swap_total: u64,
    primary_disk: Option<DiskStats>,
    load_average: Option<[f64; 3]>,
    #[serde(default)]
    unsupported: bool,
}

async fn get_remote_system_stats_async(session_id: String) -> Result<SystemStats, String> {
    let output = exec_remote_command(&session_id, REMOTE_STATS_COMMAND).await?;
    let payload: RemoteStatsPayload =
        serde_json::from_str(&output).map_err(|error| format!("invalid remote stats: {error}"))?;

    if payload.unsupported {
        return Err("remote host does not expose Linux /proc stats".into());
    }

    Ok(SystemStats {
        cpu_usage: payload.cpu_usage,
        memory_used: payload.memory_used,
        memory_total: payload.memory_total,
        swap_used: payload.swap_used,
        swap_total: payload.swap_total,
        primary_disk: payload.primary_disk,
        load_average: payload.load_average,
    })
}

#[tauri::command]
pub fn get_remote_system_stats(session_id: String) -> Result<SystemStats, String> {
    block_on(get_remote_system_stats_async(session_id))
}
