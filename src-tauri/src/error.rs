use serde::Serialize;
use russh::keys::HashAlg;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyPrompt {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PuckErrorPayload {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
    pub host_key: Option<HostKeyPrompt>,
}

#[derive(Debug, Clone)]
pub enum PuckError {
    Message(String),
    HostKeyUnknown(HostKeyPrompt),
    Coded {
        code: &'static str,
        message: String,
        details: Option<String>,
    },
}

impl std::fmt::Display for PuckError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.clone().to_payload().message)
    }
}

impl std::error::Error for PuckError {}

impl PuckError {
    pub fn auth_failed(message: impl Into<String>) -> Self {
        Self::Coded {
            code: "auth_failed",
            message: message.into(),
            details: None,
        }
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::Coded {
            code: "network_error",
            message: message.into(),
            details: None,
        }
    }

    pub fn config(message: impl Into<String>) -> Self {
        Self::Coded {
            code: "config_error",
            message: message.into(),
            details: None,
        }
    }

    pub fn protocol(message: impl Into<String>) -> Self {
        Self::Coded {
            code: "protocol_error",
            message: message.into(),
            details: None,
        }
    }

    pub fn to_payload(self) -> PuckErrorPayload {
        match self {
            Self::Message(message) => PuckErrorPayload {
                code: "unknown_error".into(),
                message,
                details: None,
                host_key: None,
            },
            Self::HostKeyUnknown(prompt) => PuckErrorPayload {
                code: "host_key_unknown".into(),
                message: "Unknown SSH host key".into(),
                details: None,
                host_key: Some(prompt),
            },
            Self::Coded {
                code,
                message,
                details,
            } => PuckErrorPayload {
                code: code.into(),
                message,
                details,
                host_key: None,
            },
        }
    }
}

impl From<std::io::Error> for PuckError {
    fn from(value: std::io::Error) -> Self {
        Self::network(value.to_string())
    }
}

impl From<russh::Error> for PuckError {
    fn from(value: russh::Error) -> Self {
        Self::network(value.to_string())
    }
}

impl From<russh_keys::Error> for PuckError {
    fn from(value: russh_keys::Error) -> Self {
        Self::auth_failed(value.to_string())
    }
}

impl From<String> for PuckError {
    fn from(value: String) -> Self {
        Self::config(value)
    }
}

pub type PuckResult<T> = Result<T, PuckError>;

pub fn puck_err<T>(error: PuckError) -> Result<T, String> {
    let payload = error.to_payload();
    Err(serde_json::to_string(&payload).unwrap_or(payload.message))
}

pub fn host_key_prompt(
    host: &str,
    port: u16,
    public_key: &russh::keys::PublicKey,
) -> HostKeyPrompt {
    HostKeyPrompt {
        host: host.to_string(),
        port,
        key_type: format!("{:?}", public_key.algorithm()),
        fingerprint: public_key.fingerprint(HashAlg::Sha256).to_string(),
        public_key: public_key.to_openssh().unwrap_or_default(),
    }
}
