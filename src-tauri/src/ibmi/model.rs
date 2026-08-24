use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionProfileRequest {
    #[serde(rename = "id")]
    pub profile_id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub authentication: AuthenticationMethod,
    pub default_library: String,
    pub library_list: Vec<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AuthenticationMethod {
    Agent,
    PrivateKey,
    Password,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionRequest {
    pub profile: ConnectionProfileRequest,
    pub secret: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionResult {
    pub id: String,
    pub system_name: String,
    pub release: Option<String>,
    pub job_name: Option<String>,
    pub current_library: String,
    pub library_list: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryObjectsRequest {
    pub session_id: String,
    pub library: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryObjectEntry {
    pub name: String,
    pub object_type: String,
    pub is_source_file: bool,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
}

#[derive(Serialize)]
pub struct LibraryObjectsResult {
    pub library: String,
    pub objects: Vec<LibraryObjectEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMembersRequest {
    pub session_id: String,
    pub library: String,
    pub source_file: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMemberEntry {
    pub name: String,
    pub source_type: String,
    pub size: Option<u64>,
    pub modified_at: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMembersResult {
    pub library: String,
    pub source_file: String,
    pub members: Vec<SourceMemberEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMemberReadRequest {
    pub session_id: String,
    pub library: String,
    pub source_file: String,
    pub member: String,
    #[serde(default = "default_source_ccsid")]
    pub source_ccsid: String,
}

fn default_source_ccsid() -> String {
    "*FILE".to_owned()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMemberReadResult {
    pub library: String,
    pub source_file: String,
    pub member: String,
    pub text: String,
    pub revision: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceReadRequest {
    pub session_id: String,
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceReadResult {
    pub text: String,
    pub revision: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceWriteRequest {
    pub session_id: String,
    pub path: String,
    pub text: String,
    pub expected_revision: Option<String>,
}

#[derive(Serialize)]
pub struct WorkspaceWriteResult {
    pub revision: String,
}
