use tauri::State;

use super::error::{CommandError, CommandResult};
use super::model::{
    ConnectionRequest, ConnectionResult, LibraryObjectsRequest, LibraryObjectsResult,
    SourceMemberReadRequest, SourceMemberReadResult, SourceMembersRequest, SourceMembersResult,
    WorkspaceReadRequest, WorkspaceReadResult, WorkspaceWriteRequest, WorkspaceWriteResult,
};
use super::session_store::IbmiSessionStore;

#[tauri::command]
pub async fn ibmi_connect(
    state: State<'_, IbmiSessionStore>,
    request: ConnectionRequest,
) -> CommandResult<ConnectionResult> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.connect(request))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}

#[tauri::command]
pub async fn ibmi_disconnect(
    state: State<'_, IbmiSessionStore>,
    session_id: String,
) -> CommandResult<()> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.disconnect(&session_id))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}

#[tauri::command]
pub async fn ibmi_library_objects(
    state: State<'_, IbmiSessionStore>,
    request: LibraryObjectsRequest,
) -> CommandResult<LibraryObjectsResult> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.list_library_objects(request))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}

#[tauri::command]
pub async fn ibmi_source_members(
    state: State<'_, IbmiSessionStore>,
    request: SourceMembersRequest,
) -> CommandResult<SourceMembersResult> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.list_source_members(request))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}

#[tauri::command]
pub async fn ibmi_source_member_read(
    state: State<'_, IbmiSessionStore>,
    request: SourceMemberReadRequest,
) -> CommandResult<SourceMemberReadResult> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.read_source_member(request))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}

#[tauri::command]
pub async fn ibmi_workspace_read(
    state: State<'_, IbmiSessionStore>,
    request: WorkspaceReadRequest,
) -> CommandResult<WorkspaceReadResult> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.read_workspace(request))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}

#[tauri::command]
pub async fn ibmi_workspace_write(
    state: State<'_, IbmiSessionStore>,
    request: WorkspaceWriteRequest,
) -> CommandResult<WorkspaceWriteResult> {
    let store = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || store.write_workspace(request))
        .await
        .map_err(|error| CommandError::new("IBMI_COMMAND_TASK", error.to_string()))?
}
