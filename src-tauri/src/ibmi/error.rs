use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expected_revision: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actual_revision: Option<String>,
}

impl CommandError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            path: None,
            expected_revision: None,
            actual_revision: None,
        }
    }

    pub fn revision_conflict(
        path: &str,
        expected_revision: Option<String>,
        actual_revision: Option<String>,
    ) -> Self {
        Self {
            code: "IBMI_WORKSPACE_REVISION_CONFLICT",
            message: format!("IBM i workspace changed remotely: {path}"),
            path: Some(path.to_owned()),
            expected_revision,
            actual_revision,
        }
    }
}

pub type CommandResult<T> = Result<T, CommandError>;
