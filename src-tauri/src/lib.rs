mod ibmi;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ibmi::session_store::IbmiSessionStore::default())
        .invoke_handler(tauri::generate_handler![
            ibmi::commands::ibmi_connect,
            ibmi::commands::ibmi_disconnect,
            ibmi::commands::ibmi_library_objects,
            ibmi::commands::ibmi_source_member_read,
            ibmi::commands::ibmi_source_members,
            ibmi::commands::ibmi_workspace_read,
            ibmi::commands::ibmi_workspace_write,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run IronTerm Studio");
}
